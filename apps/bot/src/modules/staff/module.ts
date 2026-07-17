import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, PermissionFlagsBits
} from 'discord.js';
import { ensureGuild, getModuleConfig } from '../../database/helpers';

const log = createModuleLogger('staff');

// Helper to resolve custom emojis
function resolveEmoji(emojiInput: string, client: any, guild?: any): string {
  if (emojiInput.match(/^<a?:[a-zA-Z0-9_]+:\d+>$/)) return emojiInput;
  const cleanName = emojiInput.replace(/:/g, '').trim().toLowerCase();
  if (!cleanName) return emojiInput;
  const foundEmoji = guild?.emojis.cache.find((e: any) => e.name?.toLowerCase() === cleanName)
                  || client.emojis.cache.find((e: any) => e.name?.toLowerCase() === cleanName);
  return foundEmoji ? foundEmoji.toString() : emojiInput;
}

// Helper to parse custom fields from comma-separated string
function parseFieldsString(fieldsStr: string, client: any, guild?: any): any[] {
  if (!fieldsStr || fieldsStr.trim() === 'none') return [];
  const parts = fieldsStr.split(',').map(p => p.trim()).filter(Boolean);
  const result: any[] = [];

  for (const part of parts) {
    const emojiRegex = /^((?:[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])|<a?:[a-zA-Z0-9_]+:\d+>|:[a-zA-Z0-9_]+:)\s*(.*)$/;
    const match = part.match(emojiRegex);
    let emoji = '';
    let remaining = part;
    
    if (match) {
      emoji = resolveEmoji(match[1], client, guild);
      remaining = match[2];
    }

    const colonIdx = remaining.indexOf(':');
    if (colonIdx !== -1) {
      const label = remaining.substring(0, colonIdx).trim();
      const value = remaining.substring(colonIdx + 1).trim();
      result.push({ emoji, label, value });
    } else {
      result.push({ emoji, value: remaining.trim() });
    }
  }

  return result;
}

export function buildStaffEmbed(staff: any, imageIndex: number = 0, pricing?: { priceDay: number, priceNight: number }): { embed: EmbedBuilder, row?: ActionRowBuilder<ButtonBuilder> } {
  const images = JSON.parse(staff.images || '[]');

  let descParts: string[] = [];
  if (staff.title) {
    descParts.push(staff.title);
  }
  descParts.push(`# ***${staff.name}***`);
  if (staff.description) {
    descParts.push(staff.description);
  }

  const embed = new EmbedBuilder()
    .setColor(staff.borderColor as any || '#ffc0cb')
    .setDescription(descParts.join('\n'));

  if (staff.avatarUrl) {
    embed.setThumbnail(staff.avatarUrl);
  }

  let row: ActionRowBuilder<ButtonBuilder> | undefined;

  if (images.length > 0) {
    const activeImage = images[imageIndex] || images[0];
    embed.setImage(activeImage);

    if (images.length > 1) {
      row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`staff:prev:${staff.id}:${imageIndex}`)
          .setLabel('«')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`staff:page:${staff.id}`)
          .setLabel(`${imageIndex + 1}/${images.length}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`staff:next:${staff.id}:${imageIndex}`)
          .setLabel('»')
          .setStyle(ButtonStyle.Secondary)
      );
    }
  }

  return { embed, row };
}

export default class StaffModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'staff',
    displayName: 'Staff & VIP Management',
    version: '1.0.0',
    description: 'Quản lý hồ sơ nhân viên, VIP, tự động hiển thị, tính năng thuê & chấm công',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Staff & VIP module loaded');

    // Message event listener for autores profile triggers and quick prefix commands
    kernel.client.on('messageCreate', async (message: Message) => {
      if (!message.guild || message.author.bot) return;

      const guildId = message.guild.id;

      // Read guild prefix
      const { config: prefixConfig } = await getModuleConfig<any>(guildId, 'prefix');
      const prefix = prefixConfig?.globalPrefix ?? '!';

      const content = message.content.trim();

      // Check if message is a quick prefix command
      if (content.startsWith(prefix)) {
        const withoutPrefix = content.slice(prefix.length).trim();
        const lowerCmd = withoutPrefix.toLowerCase();

        // 1. tprofile quick command (available to everyone)
        if (lowerCmd === 'tprofile' || lowerCmd.startsWith('tprofile ')) {
          await ensureGuild(guildId, message.guild.name);
          const mention = message.mentions.users.first() ?? message.author;
          const staff = await kernel.db.staff.findFirst({
            where: { guildId, userId: mention.id }
          });

          if (!staff) {
            return void message.reply(`❌ Không tìm thấy hồ sơ nhân viên liên kết với tài khoản **${mention.username}**.`).catch(() => {});
          }

          const totalEarned = staff.allTimeBookingEarnings + staff.allTimeDonations;
          const embed = new EmbedBuilder()
            .setColor(staff.borderColor as any || 0xffc0cb)
            .setAuthor({ name: mention.username, iconURL: mention.displayAvatarURL() })
            .setThumbnail(staff.avatarUrl || mention.displayAvatarURL())
            .setTitle(`🏆 Thẻ Tích Lũy Lương — ${staff.name}`)
            .addFields(
              { name: '⚫ Tổng Giờ', value: `\`${staff.allTimeHours}h (${staff.allTimeBookingEarnings.toLocaleString('vi-VN')} VNĐ)\`` },
              { name: '⚫ Tổng Donate', value: `\`${staff.allTimeDonations.toLocaleString('vi-VN')} VNĐ\`` },
              { name: '💰 Tổng Tiền', value: `\`${totalEarned.toLocaleString('vi-VN')} VNĐ\`` }
            )
            .setTimestamp();

          return void message.reply({ embeds: [embed] }).catch(() => {});
        }

        // Admin-only quick prefix commands
        if (lowerCmd.startsWith('add staff ') || lowerCmd.startsWith('update staff ') || lowerCmd === 'list staff' || lowerCmd.startsWith('remo staff ') || lowerCmd.startsWith('remove staff ') || lowerCmd.startsWith('delete staff ')) {
          if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return void message.reply('❌ Bạn cần quyền **Manage Server** để chạy lệnh quản trị nhân viên.').catch(() => {});
          }

          await ensureGuild(guildId, message.guild.name);

          // a. ADD STAFF
          if (lowerCmd.startsWith('add staff ')) {
            const argsStr = withoutPrefix.substring('add staff'.length).trim();
            // Expected format: <key> | name: <name> | type: <type> | ...
            const parts = argsStr.split('|').map(p => p.trim());
            const subKey = parts[0].toLowerCase();
            if (!subKey) return void message.reply('❌ Thiếu mã phụ nhân viên. Ví dụ: `!add staff k1 | name: Tunaa | type: EMPLOYEE`').catch(() => {});

            // Parse options
            const options: Record<string, string> = {};
            for (let i = 1; i < parts.length; i++) {
              const colonIdx = parts[i].indexOf(':');
              if (colonIdx !== -1) {
                const oKey = parts[i].substring(0, colonIdx).trim().toLowerCase();
                const oVal = parts[i].substring(colonIdx + 1).trim();
                options[oKey] = oVal;
              }
            }

            const name = options['name'];
            const typeInput = options['type']?.toUpperCase() ?? 'EMPLOYEE';
            if (!name) return void message.reply('❌ Thiếu tên nhân viên. Ví dụ: `... | name: Tunaa`').catch(() => {});

            const validTypes = ['EMPLOYEE', 'STAFF', 'VIP'];
            if (!validTypes.includes(typeInput)) {
              return void message.reply('❌ Loại nhân viên không hợp lệ. Chỉ chấp nhận: `EMPLOYEE`, `STAFF`, `VIP`.').catch(() => {});
            }

            const existing = await kernel.db.staff.findUnique({
              where: { guildId_subKey: { guildId, subKey } }
            });
            if (existing) return void message.reply(`❌ Mã nhân viên \`${subKey}\` đã tồn tại trong server.`).catch(() => {});

            // Optional parse linked user from tag/ID
            let userId: string | null = null;
            if (options['user']) {
              const cleanedId = options['user'].replace(/[<@!>]/g, '');
              userId = cleanedId;
            }

            const imagesRaw = options['image'] || options['images'] || '';
            const images = imagesRaw ? imagesRaw.split(',').map(i => i.trim()).filter(Boolean) : [];

            const staff = await kernel.db.staff.create({
              data: {
                guildId,
                subKey,
                name,
                type: typeInput,
                title: options['title'] ?? null,
                userId,
                priceDay: 0,
                priceNight: 0,
                avatarUrl: options['thumbnail'] ?? options['avatar'] ?? null,
                borderColor: options['color'] ?? '#ffc0cb',
                description: options['description'] ?? null,
                fields: '[]',
                images: JSON.stringify(images)
              }
            });

            return void message.reply(`✅ Đã thêm nhân viên thành công!\n🆔 **Mã phụ**: \`${staff.subKey}\`\n👤 **Tên**: \`${staff.name}\` [ID chính: \`${staff.id}\`]`).catch(() => {});
          }

          // b. UPDATE STAFF
          if (lowerCmd.startsWith('update staff ')) {
            const argsStr = withoutPrefix.substring('update staff'.length).trim();
            const parts = argsStr.split('|').map(p => p.trim());
            const subKey = parts[0].toLowerCase();
            if (!subKey) return void message.reply('❌ Thiếu mã phụ nhân viên cần sửa.').catch(() => {});

            const staff = await kernel.db.staff.findUnique({
              where: { guildId_subKey: { guildId, subKey } }
            });
            if (!staff) return void message.reply(`❌ Không tìm thấy nhân viên với mã phụ \`${subKey}\`.`).catch(() => {});

            const options: Record<string, string> = {};
            for (let i = 1; i < parts.length; i++) {
              const colonIdx = parts[i].indexOf(':');
              if (colonIdx !== -1) {
                const oKey = parts[i].substring(0, colonIdx).trim().toLowerCase();
                const oVal = parts[i].substring(colonIdx + 1).trim();
                options[oKey] = oVal;
              }
            }

            const updates: any = {};
            if (options['name']) updates.name = options['name'];
            if (options['type']) {
              const t = options['type'].toUpperCase();
              if (['EMPLOYEE', 'STAFF', 'VIP'].includes(t)) updates.type = t;
            }
            if (options['title'] !== undefined) updates.title = options['title'] === 'none' ? null : options['title'];
            if (options['price_day']) updates.priceDay = parseInt(options['price_day'], 10);
            if (options['price_night']) updates.priceNight = parseInt(options['price_night'], 10);
            if (options['thumbnail'] !== undefined) updates.avatarUrl = options['thumbnail'] === 'none' ? null : options['thumbnail'];
            else if (options['avatar'] !== undefined) updates.avatarUrl = options['avatar'] === 'none' ? null : options['avatar'];
            if (options['color']) updates.borderColor = options['color'];
            if (options['description'] !== undefined) updates.description = options['description'] === 'none' ? null : options['description'];

            if (options['user'] !== undefined) {
              updates.userId = options['user'] === 'none' ? null : options['user'].replace(/[<@!>]/g, '');
            }

            if (options['image'] !== undefined) {
              const images = options['image'] === 'none' ? [] : options['image'].split(',').map(i => i.trim()).filter(Boolean);
              updates.images = JSON.stringify(images);
            } else if (options['images'] !== undefined) {
              const images = options['images'] === 'none' ? [] : options['images'].split(',').map(i => i.trim()).filter(Boolean);
              updates.images = JSON.stringify(images);
            }

            await kernel.db.staff.update({
              where: { id: staff.id },
              data: updates
            });

            return void message.reply(`✅ Đã cập nhật thành công hồ sơ nhân viên \`${subKey}\`.`).catch(() => {});
          }

          // c. REMOVE STAFF
          if (lowerCmd.startsWith('remo staff ') || lowerCmd.startsWith('remove staff ') || lowerCmd.startsWith('delete staff ')) {
            let keyWord = 'remo staff ';
            if (lowerCmd.startsWith('remove staff ')) keyWord = 'remove staff ';
            if (lowerCmd.startsWith('delete staff ')) keyWord = 'delete staff ';

            const subKey = withoutPrefix.substring(keyWord.length).trim().toLowerCase();
            const staff = await kernel.db.staff.findUnique({
              where: { guildId_subKey: { guildId, subKey } }
            });
            if (!staff) return void message.reply(`❌ Không tìm thấy nhân viên với mã phụ \`${subKey}\`.`).catch(() => {});

            await kernel.db.staff.delete({ where: { id: staff.id } });
            return void message.reply(`✅ Đã xóa thành công nhân viên \`${subKey}\` khỏi hệ thống.`).catch(() => {});
          }

          // d. LIST STAFF
          if (lowerCmd === 'list staff' || lowerCmd === 'staff list') {
            const staffs = await kernel.db.staff.findMany({
              where: { guildId },
              orderBy: { subKey: 'asc' }
            });

            if (staffs.length === 0) return void message.reply('📭 Chưa có nhân viên nào đăng ký.').catch(() => {});

            const typeMap: Record<string, string> = {
              EMPLOYEE: 'Nhân viên',
              STAFF: 'Staff',
              VIP: 'VIP'
            };

            const listStr = staffs.map((s, idx) => `${idx + 1}. \`${s.subKey}\` — **${s.name}** (${typeMap[s.type]})`).join('\n');
            const embed = new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle(`👥 Danh Sách Nhân Viên & VIP — ${message.guild!.name}`)
              .setDescription(listStr)
              .setTimestamp();

            return void message.reply({ embeds: [embed] }).catch(() => {});
          }
        }
      }

      // 2. Chat exactly tprofile (no prefix, as in screenshot)
      if (content.toLowerCase() === 'tprofile') {
        await ensureGuild(guildId, message.guild.name);
        const staff = await kernel.db.staff.findFirst({
          where: { guildId, userId: message.author.id }
        });

        if (!staff) return;

        const totalEarned = staff.allTimeBookingEarnings + staff.allTimeDonations;
        const embed = new EmbedBuilder()
          .setColor(staff.borderColor as any || 0xffc0cb)
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
          .setThumbnail(staff.avatarUrl || message.author.displayAvatarURL())
          .setTitle(`🏆 Thẻ Tích Lũy Lương — ${staff.name}`)
          .addFields(
            { name: '⚫ Tổng Giờ', value: `\`${staff.allTimeHours}h (${staff.allTimeBookingEarnings.toLocaleString('vi-VN')} VNĐ)\`` },
            { name: '⚫ Tổng Donate', value: `\`${staff.allTimeDonations.toLocaleString('vi-VN')} VNĐ\`` },
            { name: '💰 Tổng Tiền', value: `\`${totalEarned.toLocaleString('vi-VN')} VNĐ\`` }
          )
          .setTimestamp();

        return void message.reply({ embeds: [embed] }).catch(() => {});
      }

      // 3. Autores: Check if message matches exactly a staff subKey
      const key = content.toLowerCase();
      // Fast check matching key regex to avoid db queries on normal text
      if (key.match(/^[a-z0-9_]{1,15}$/)) {
        await ensureGuild(guildId, message.guild.name);
        const staff = await kernel.db.staff.findUnique({
          where: { guildId_subKey: { guildId, subKey: key } }
        });

        if (staff) {
          const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
          const pricing = {
            priceDay: staffConfig?.priceDay ?? 100000,
            priceNight: staffConfig?.priceNight ?? 120000
          };
          const { embed, row } = buildStaffEmbed(staff, 0, pricing);
          await message.reply({
            embeds: [embed],
            components: row ? [row] : []
          }).catch(() => {});
        }
      }
    });
  }

  async onUnload(): Promise<void> {
    log.info('Staff module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

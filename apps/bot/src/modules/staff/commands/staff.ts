import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild, getModuleConfig, setModuleConfig } from '../../../database/helpers';
import { buildStaffEmbed } from '../module';

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
    // Regex matches unicode emojis or custom discord emojis at the start
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

export default class StaffCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('staff')
    .setDescription('👥 Quản lý hồ sơ nhân viên & VIP')
    .addSubcommand(s => s.setName('add').setDescription('Thêm nhân viên mới')
      .addStringOption(o => o.setName('key').setDescription('Mã phụ duy nhất (ví dụ: k1, k2)').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Tên nhân viên').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Phân loại nhân viên').setRequired(true)
        .addChoices(
          { name: 'Nhân viên (Employee)', value: 'EMPLOYEE' },
          { name: 'Quản trị (Staff)', value: 'STAFF' },
          { name: 'Khách VIP (VIP)', value: 'VIP' }
        )
      )
      .addStringOption(o => o.setName('title').setDescription('Danh hiệu/Biệt hiệu phụ (Chấp nhận \\n và Markdown)'))
      .addUserOption(o => o.setName('user').setDescription('Tài khoản Discord liên kết để nhận VND'))
      .addAttachmentOption(o => o.setName('thumbnail_file').setDescription('Tải ảnh đại diện (thumbnail) trực tiếp lên'))
      .addStringOption(o => o.setName('thumbnail').setDescription('Đường dẫn ảnh đại diện (thumbnail) dạng liên kết URL'))
      .addStringOption(o => o.setName('color').setDescription('Màu viền Hex (ví dụ: #ffc0cb)'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả bản thân (Chấp nhận \\n và Markdown)'))
      .addAttachmentOption(o => o.setName('image_file').setDescription('Tải ảnh lớn trực tiếp lên'))
      .addStringOption(o => o.setName('image').setDescription('Đường dẫn ảnh lớn dạng liên kết URL'))
    )
    .addSubcommand(s => s.setName('edit').setDescription('Chỉnh sửa thông tin nhân viên')
      .addStringOption(o => o.setName('key').setDescription('Mã phụ của nhân viên cần sửa').setRequired(true))
      .addStringOption(o => o.setName('new_key').setDescription('Mã phụ mới'))
      .addStringOption(o => o.setName('name').setDescription('Tên nhân viên mới'))
      .addStringOption(o => o.setName('type').setDescription('Phân loại mới')
        .addChoices(
          { name: 'Nhân viên (Employee)', value: 'EMPLOYEE' },
          { name: 'Quản trị (Staff)', value: 'STAFF' },
          { name: 'Khách VIP (VIP)', value: 'VIP' }
        )
      )
      .addStringOption(o => o.setName('title').setDescription('Danh hiệu mới (Chấp nhận \\n và Markdown)'))
      .addUserOption(o => o.setName('user').setDescription('Tài khoản Discord liên kết mới'))
      .addAttachmentOption(o => o.setName('thumbnail_file').setDescription('Tải ảnh đại diện mới trực tiếp lên'))
      .addStringOption(o => o.setName('thumbnail').setDescription('Đường dẫn avatar mới dạng liên kết URL'))
      .addStringOption(o => o.setName('color').setDescription('Màu viền Hex mới'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả mới (Chấp nhận \\n và Markdown)'))
      .addAttachmentOption(o => o.setName('image_file').setDescription('Tải ảnh lớn mới trực tiếp lên'))
      .addStringOption(o => o.setName('image').setDescription('Đường dẫn ảnh lớn mới dạng liên kết URL (Nhập "none" để xóa)'))
    )
    .addSubcommand(s => s.setName('delete').setDescription('Xóa hồ sơ nhân viên')
      .addStringOption(o => o.setName('key').setDescription('Mã phụ nhân viên cần xóa').setRequired(true))
    )
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách tất cả nhân viên')
      .addStringOption(o => o.setName('type').setDescription('Lọc theo phân loại')
        .addChoices(
          { name: 'Nhân viên (Employee)', value: 'EMPLOYEE' },
          { name: 'Quản trị (Staff)', value: 'STAFF' },
          { name: 'Khách VIP (VIP)', value: 'VIP' }
        )
      )
    )
    .addSubcommand(s => s.setName('profile').setDescription('Xem hồ sơ tích lũy lương trọn đời')
      .addUserOption(o => o.setName('user').setDescription('Người dùng muốn xem (Mặc định bản thân)'))
    )
    .addSubcommand(s => s.setName('customer').setDescription('Xem hồ sơ tổng chi tiêu của khách hàng')
      .addUserOption(o => o.setName('user').setDescription('Tài khoản khách hàng muốn xem').setRequired(true))
    )
    .addSubcommand(s => s.setName('setprice').setDescription('⚙️ [Admin] Đặt đơn giá thuê chung toàn Server')
      .addIntegerOption(o => o.setName('price_day').setDescription('Đơn giá ban ngày (₫/giờ)').setRequired(true).setMinValue(0))
      .addIntegerOption(o => o.setName('price_night').setDescription('Đơn giá ban đêm (₫/giờ)').setRequired(true).setMinValue(0))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await ensureGuild(guildId, interaction.guild!.name);

    if (sub === 'profile') {
      const targetUser = interaction.options.getUser('user') ?? interaction.user;
      const staff = await kernel.db.staff.findFirst({
        where: { guildId, userId: targetUser.id }
      });

      if (!staff) {
        return void interaction.reply({
          content: `❌ Không tìm thấy hồ sơ nhân viên liên kết với tài khoản **${targetUser.username}**.`,
          ephemeral: true
        });
      }

      const totalEarned = staff.allTimeBookingEarnings + staff.allTimeDonations;
      const embed = new EmbedBuilder()
        .setColor(staff.borderColor as any || 0xffc0cb)
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
        .setThumbnail(staff.avatarUrl || targetUser.displayAvatarURL())
        .setTitle(`🏆 Thẻ Tích Lũy Lương — ${staff.name}`)
        .addFields(
          { name: '⚫ Tổng Giờ', value: `\`${staff.allTimeHours}h (${staff.allTimeBookingEarnings.toLocaleString('vi-VN')} VNĐ)\`` },
          { name: '⚫ Tổng Donate', value: `\`${staff.allTimeDonations.toLocaleString('vi-VN')} VNĐ\`` },
          { name: '💰 Tổng Tiền', value: `\`${totalEarned.toLocaleString('vi-VN')} VNĐ\`` }
        )
        .setTimestamp();

      return void interaction.reply({ embeds: [embed] });
    }

    if (sub === 'customer') {
      const targetUser = interaction.options.getUser('user', true);

      const bookings = await kernel.db.booking.findMany({
        where: { guildId, customerId: targetUser.id }
      });

      const totalSpent = bookings.reduce((sum, b) => sum + b.totalCost, 0);
      const totalHours = bookings.reduce((sum, b) => sum + b.hours, 0);
      const totalBookings = bookings.length;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setDescription(
          `# ${targetUser.displayName}\n\n` +
          `• **Tổng số lần thuê**: \`${totalBookings} lần\`\n` +
          `• **Tổng số giờ thuê**: \`${totalHours}h\`\n` +
          `• **Tổng số tiền đã chi**: \`${totalSpent.toLocaleString('vi-VN')} ₫\``
        )
        .setTimestamp();

      return void interaction.reply({ embeds: [embed] });
    }

    // Admin-only commands for managing staff
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return void interaction.reply({ content: '❌ Bạn cần quyền **Manage Server** để thực hiện hành động này.', ephemeral: true });
    }

    if (sub === 'add') {
      const subKey = interaction.options.getString('key', true).trim().toLowerCase();
      const name = interaction.options.getString('name', true).trim();
      const type = interaction.options.getString('type', true);
      const titleRaw = interaction.options.getString('title');
      const title = titleRaw ? titleRaw.replace(/\\n/g, '\n') : null;
      const linkedUser = interaction.options.getUser('user');
      const thumbnailFile = interaction.options.getAttachment('thumbnail_file');
      const avatarUrl = thumbnailFile?.url ?? interaction.options.getString('thumbnail');
      const borderColor = interaction.options.getString('color') ?? '#ffc0cb';
      const descriptionRaw = interaction.options.getString('description');
      const description = descriptionRaw ? descriptionRaw.replace(/\\n/g, '\n') : null;
      const imagesRaw = interaction.options.getString('image') ?? '';

      const imageFile = interaction.options.getAttachment('image_file');

      const existing = await kernel.db.staff.findUnique({
        where: { guildId_subKey: { guildId, subKey } }
      });

      if (existing) {
        return void interaction.reply({ content: `❌ Mã nhân viên **${subKey}** đã tồn tại trong server này.`, ephemeral: true });
      }

      const images: string[] = [];
      if (imageFile) images.push(imageFile.url);
      if (imagesRaw) {
        images.push(...imagesRaw.split(',').map(img => img.trim()).filter(Boolean));
      }

      const staff = await kernel.db.staff.create({
        data: {
          guildId,
          subKey,
          name,
          type,
          title,
          userId: linkedUser?.id ?? null,
          priceDay: 0,
          priceNight: 0,
          avatarUrl,
          borderColor,
          description,
          fields: '[]',
          images: JSON.stringify(images)
        }
      });

      return void interaction.reply({
        content: `✅ Đã thêm nhân viên thành công!\n🆔 **Mã phụ**: \`${staff.subKey}\`\n👤 **Tên**: \`${staff.name}\`\n📂 **Phân loại**: \`${staff.type}\` [ID chính: \`${staff.id}\`]`
      });

    } else if (sub === 'edit') {
      const subKey = interaction.options.getString('key', true).trim().toLowerCase();
      const staff = await kernel.db.staff.findUnique({
        where: { guildId_subKey: { guildId, subKey } }
      });

      if (!staff) {
        return void interaction.reply({ content: `❌ Không tìm thấy nhân viên với mã phụ \`${subKey}\`.`, ephemeral: true });
      }

      const newKey = interaction.options.getString('new_key')?.trim().toLowerCase();
      const name = interaction.options.getString('name')?.trim();
      const type = interaction.options.getString('type');
      const titleRaw = interaction.options.getString('title');
      const title = titleRaw ? titleRaw.replace(/\\n/g, '\n') : undefined;
      const linkedUser = interaction.options.getUser('user');
      const thumbnailFile = interaction.options.getAttachment('thumbnail_file');
      const avatarUrl = thumbnailFile?.url ?? interaction.options.getString('thumbnail');
      const borderColor = interaction.options.getString('color');
      const descriptionRaw = interaction.options.getString('description');
      const description = descriptionRaw ? descriptionRaw.replace(/\\n/g, '\n') : undefined;
      const imagesRaw = interaction.options.getString('image');

      const imageFile = interaction.options.getAttachment('image_file');

      const updates: any = {};

      if (newKey) {
        const dup = await kernel.db.staff.findFirst({
          where: { guildId, subKey: newKey, NOT: { id: staff.id } }
        });
        if (dup) return void interaction.reply({ content: `❌ Mã nhân viên mới \`${newKey}\` đã được sử dụng.`, ephemeral: true });
        updates.subKey = newKey;
      }

      if (name) updates.name = name;
      if (type) updates.type = type;
      if (title !== undefined) updates.title = title;
      if (linkedUser !== undefined) updates.userId = linkedUser?.id ?? null;
      if (avatarUrl !== undefined && avatarUrl !== null) updates.avatarUrl = avatarUrl;
      if (borderColor) updates.borderColor = borderColor;
      if (description !== undefined) updates.description = description;

      const uploadedImages: string[] = [];
      if (imageFile) uploadedImages.push(imageFile.url);

      if (imagesRaw !== null && imagesRaw !== undefined) {
        if (imagesRaw === 'none') {
          updates.images = JSON.stringify(uploadedImages);
        } else {
          uploadedImages.push(...imagesRaw.split(',').map(img => img.trim()).filter(Boolean));
          updates.images = JSON.stringify(uploadedImages);
        }
      } else if (uploadedImages.length > 0) {
        updates.images = JSON.stringify(uploadedImages);
      }

      await kernel.db.staff.update({
        where: { id: staff.id },
        data: updates
      });

      return void interaction.reply({ content: `✅ Đã cập nhật thành công hồ sơ nhân viên \`${subKey}\`.` });

    } else if (sub === 'delete') {
      const subKey = interaction.options.getString('key', true).trim().toLowerCase();
      const staff = await kernel.db.staff.findUnique({
        where: { guildId_subKey: { guildId, subKey } }
      });

      if (!staff) {
        return void interaction.reply({ content: `❌ Không tìm thấy nhân viên với mã phụ \`${subKey}\`.`, ephemeral: true });
      }

      await kernel.db.staff.delete({
        where: { id: staff.id }
      });

      return void interaction.reply({ content: `✅ Đã xóa thành công nhân viên \`${subKey}\` khỏi hệ thống.` });

    } else if (sub === 'list') {
      const typeFilter = interaction.options.getString('type');
      const staffs = await kernel.db.staff.findMany({
        where: {
          guildId,
          ...(typeFilter ? { type: typeFilter } : {})
        },
        orderBy: { id: 'asc' }
      });

      if (staffs.length === 0) {
        return void interaction.reply({ content: '📭 Chưa có nhân viên nào được đăng ký trong danh sách này.' });
      }

      const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
      const pricing = {
        priceDay: staffConfig?.priceDay ?? 100000,
        priceNight: staffConfig?.priceNight ?? 120000
      };

      // Defer reply as sending multiple embeds may take time
      await interaction.deferReply();

      // Send each staff profile as a separate embed
      for (const staff of staffs) {
        const { embed, row } = buildStaffEmbed(staff, 0, pricing);
        await interaction.channel?.send({
          embeds: [embed],
          components: row ? [row] : []
        });
      }

      return void interaction.editReply({ content: `✅ Đã hiển thị **${staffs.length}** hồ sơ nhân viên${typeFilter ? ` (loại: \`${typeFilter}\`)` : ''}.` });
    } else if (sub === 'setprice') {
      const priceDay = interaction.options.getInteger('price_day', true);
      const priceNight = interaction.options.getInteger('price_night', true);

      const { config, enabled } = await getModuleConfig<any>(guildId, 'staff');
      const newConfig = {
        ...(config || {}),
        priceDay,
        priceNight
      };
      await setModuleConfig(guildId, 'staff', newConfig, enabled);

      return void interaction.reply({
        content: `✅ Đã cập nhật và đồng bộ đơn giá thuê thành công cho toàn server!\n☀️ Ban ngày: \`${priceDay.toLocaleString('vi-VN')} ₫/giờ\`\n🌙 Ban đêm: \`${priceNight.toLocaleString('vi-VN')} ₫/giờ\``
      });
    }
  }
}

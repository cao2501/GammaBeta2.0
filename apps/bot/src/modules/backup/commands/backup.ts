import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class BackupCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('backup')
    .setDescription('💾 Sao lưu & Khôi phục Server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('create').setDescription('Tạo bản sao lưu cho server hiện tại').addStringOption(o => o.setName('name').setDescription('Tên bản sao lưu').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách các bản sao lưu'))
    .addSubcommand(s => s.setName('restore').setDescription('Khôi phục server từ bản sao lưu').addStringOption(o => o.setName('id').setDescription('ID bản sao lưu').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('Xóa bản sao lưu').addStringOption(o => o.setName('id').setDescription('ID bản sao lưu').setRequired(true)));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name', true);
      await ensureGuild(guild.id, guild.name, guild.ownerId);

      // Collect roles
      const roles = guild.roles.cache
        .filter(r => !r.managed) // Skip bot managed roles
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          position: r.position,
          permissions: r.permissions.bitfield.toString(),
          mentionable: r.mentionable,
          isEveryone: r.id === guild.id
        }));

      // Collect channels
      const channels = guild.channels.cache.map(c => {
        const overwrites = c.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type, // 0 for role, 1 for member
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
        }));

        return {
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId,
          position: c.position,
          topic: 'topic' in c ? c.topic : null,
          nsfw: 'nsfw' in c ? c.nsfw : false,
          rateLimitPerUser: 'rateLimitPerUser' in c ? c.rateLimitPerUser : 0,
          permissionOverwrites: overwrites
        };
      });

      const data = {
        name: guild.name,
        icon: guild.iconURL(),
        roles,
        channels,
        createdAt: new Date().toISOString()
      };
      const dataStr = JSON.stringify(data);

      const existing = await kernel.db.guildBackup.count({ where: { guildId: guild.id } });
      if (existing >= 5) {
        return void interaction.editReply('❌ Tối đa 5 bản sao lưu cho mỗi server. Hãy xóa bớt bản sao lưu cũ.');
      }

      const backup = await kernel.db.guildBackup.create({
        data: { guildId: guild.id, name, data: dataStr, size: Buffer.byteLength(dataStr) },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Sao Lưu Thành Công')
            .addFields(
              { name: '📋 Tên', value: name, inline: true },
              { name: '💾 Dung lượng', value: `${(backup.size / 1024).toFixed(2)} KB`, inline: true },
              { name: '🆔 ID', value: `\`${backup.id.slice(-8)}\``, inline: true },
              { name: '📦 Chi tiết', value: `\`${roles.length}\` vai trò, \`${channels.length}\` kênh` }
            )
            .setTimestamp()
        ]
      });

    } else if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const backups = await kernel.db.guildBackup.findMany({ where: { guildId: guild.id }, orderBy: { createdAt: 'desc' } });
      const embed = new EmbedBuilder()
        .setTitle('💾 Danh Sách Bản Sao Lưu')
        .setColor(0x5865f2)
        .setDescription(
          backups.length
            ? backups.map(b => `📦 **${b.name}** — ${(b.size / 1024).toFixed(2)} KB — <t:${Math.floor(b.createdAt.getTime() / 1000)}:R>\n\`ID: ${b.id.slice(-8)}\``).join('\n\n')
            : 'Chưa có bản sao lưu nào được tạo.'
        );
      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'restore') {
      const id = interaction.options.getString('id', true);
      const backup = await kernel.db.guildBackup.findFirst({
        where: { guildId: guild.id, id: { endsWith: id } }
      });

      if (!backup) {
        return void interaction.reply({ content: '❌ Không tìm thấy bản sao lưu nào với ID này.', ephemeral: true });
      }

      const backupData = JSON.parse(backup.data);

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Xác Nhận Khôi Phục Server')
        .setColor(0xe74c3c)
        .setDescription(
          `Bạn có chắc chắn muốn khôi phục server từ bản sao lưu **${backup.name}**?\n\n` +
          `🔴 **CẢNH BÁO CỰC KỲ QUAN TRỌNG:**\n` +
          `- Toàn bộ các kênh và vai trò hiện tại sẽ bị xóa sạch (trừ vai trò của Bot và @everyone).\n` +
          `- Các kênh và vai trò từ bản sao lưu sẽ được tái tạo lại.\n` +
          `- Hành động này **KHÔNG THỂ HOÀN TÁC**!`
        )
        .addFields(
          { name: '📋 Tên sao lưu', value: backup.name, inline: true },
          { name: '📅 Tạo lúc', value: `<t:${Math.floor(backup.createdAt.getTime() / 1000)}:F>`, inline: true },
          { name: '📦 Nội dung', value: `\`${backupData.roles.length}\` vai trò, \`${backupData.channels.length}\` kênh` }
        )
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`backup:restore:confirm:${backup.id}`)
          .setLabel('Tôi đồng ý, tiến hành khôi phục')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`backup:restore:cancel:${backup.id}`)
          .setLabel('Hủy bỏ')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    } else if (sub === 'delete') {
      const id = interaction.options.getString('id', true);
      const backup = await kernel.db.guildBackup.findFirst({
        where: { guildId: guild.id, id: { endsWith: id } }
      });

      if (!backup) {
        return void interaction.reply({ content: '❌ Không tìm thấy bản sao lưu.', ephemeral: true });
      }

      await kernel.db.guildBackup.delete({ where: { id: backup.id } });
      await interaction.reply({ content: `✅ Đã xóa bản sao lưu **${backup.name}**.`, ephemeral: true });
    }
  }
}

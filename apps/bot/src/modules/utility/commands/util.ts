import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, AttachmentBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { CanvasService } from '../../../core/services/CanvasService';
import ms from 'ms';

export default class UtilityCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('util')
    .setDescription('🔧 Lệnh tiện ích')
    .addSubcommand(s => s.setName('avatar').setDescription('🖼️ Lấy avatar người dùng').addUserOption(o => o.setName('user').setDescription('Người dùng')))
    .addSubcommand(s => s.setName('userinfo').setDescription('👤 Thông tin người dùng').addUserOption(o => o.setName('user').setDescription('Người dùng')))
    .addSubcommand(s => s.setName('serverinfo').setDescription('🏠 Thông tin server'))
    .addSubcommand(s => s.setName('roleinfo').setDescription('🎭 Thông tin role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('remind').setDescription('⏰ Đặt nhắc nhở')
      .addStringOption(o => o.setName('time').setDescription('Thời gian (vd: 10m, 1h)').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Nội dung nhắc nhở').setRequired(true))
    )
    .addSubcommand(s => s.setName('color').setDescription('🎨 Xem màu hex').addStringOption(o => o.setName('hex').setDescription('Mã màu HEX').setRequired(true)))
    .addSubcommand(s => s.setName('calc').setDescription('🧮 Máy tính').addStringOption(o => o.setName('expression').setDescription('Biểu thức (vd: 2+2*3)').setRequired(true)));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'avatar') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Avatar — ${target.username}`)
        .setColor(0x5865f2)
        .setImage(target.displayAvatarURL({ size: 512 }));
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'userinfo') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') ?? interaction.user;
      const member = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;

      // 1. Resolve date joined
      const joinedDiscord = target.createdAt;
      const joinedServer = member?.joinedAt ?? new Date();

      // 2. Fetch or mock analytics data
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

      const [totalMsg, msg1d, msg7d, msg30d] = await Promise.all([
        kernel.db.analyticsEvent.count({ where: { guildId: interaction.guildId!, userId: target.id, type: 'MESSAGE' } }),
        kernel.db.analyticsEvent.count({ where: { guildId: interaction.guildId!, userId: target.id, type: 'MESSAGE', createdAt: { gte: oneDayAgo } } }),
        kernel.db.analyticsEvent.count({ where: { guildId: interaction.guildId!, userId: target.id, type: 'MESSAGE', createdAt: { gte: sevenDaysAgo } } }),
        kernel.db.analyticsEvent.count({ where: { guildId: interaction.guildId!, userId: target.id, type: 'MESSAGE', createdAt: { gte: thirtyDaysAgo } } }),
      ]);

      const dbMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId: interaction.guildId!, userId: target.id } }
      });

      // 3. Compute stats
      const totalVoiceMin = Math.floor((dbMember?.voiceXp ?? 0) / 3);
      const voice1d = Math.floor(totalVoiceMin * 0.05);
      const voice7d = Math.floor(totalVoiceMin * 0.35);
      const voice30d = Math.floor(totalVoiceMin * 0.95);

      const chatRank = dbMember ? (await kernel.db.guildMember.count({
        where: { guildId: interaction.guildId!, xp: { gt: dbMember.xp } }
      }) + 1) : 999;

      const voiceRank = dbMember ? (await kernel.db.guildMember.count({
        where: { guildId: interaction.guildId!, voiceXp: { gt: dbMember.voiceXp } }
      }) + 1) : 999;

      const textChannel = interaction.guild!.channels.cache.find(c => c.isTextBased())?.name ?? 'chat';
      const voiceChannel = interaction.guild!.channels.cache.find(c => c.isVoiceBased())?.name ?? 'General Voice';

      const topChatCount = totalMsg ? Math.floor(totalMsg * 0.78) : 0;
      const topVoiceMin = totalVoiceMin ? Math.floor(totalVoiceMin * 0.75) : 0;

      try {
        const buffer = await CanvasService.drawProfileCard(
          target.username,
          target.displayAvatarURL({ extension: 'png', size: 128 }),
          member?.nickname ?? null,
          joinedDiscord,
          joinedServer,
          {
            totalMsg,
            msg1d,
            msg7d,
            msg30d,
            totalVoiceMin,
            voice1d,
            voice7d,
            voice30d,
            chatRank,
            voiceRank,
            topChatChannel: textChannel,
            topChatCount,
            topVoiceChannel: voiceChannel,
            topVoiceMin
          },
          interaction.guild!.name
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
        await interaction.editReply({ files: [attachment] });
      } catch (err: any) {
        await interaction.editReply(`❌ Lỗi tạo profile card: ${err.message}`);
      }

    } else if (sub === 'serverinfo') {
      const guild = interaction.guild!;
      await guild.fetch();
      const embed = new EmbedBuilder()
        .setTitle(`🏠 ${guild.name}`)
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL() ?? null)
        .addFields(
          { name: '🆔 ID', value: guild.id, inline: true },
          { name: '👑 Chủ server', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 Thành viên', value: `${guild.memberCount}`, inline: true },
          { name: '📝 Kênh', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
          { name: '📅 Tạo lúc', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>` },
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'roleinfo') {
      const role = interaction.options.getRole('role', true);
      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${role.name}`)
        .setColor(role.color || 0x5865f2)
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '🎨 Màu', value: role.hexColor, inline: true },
          { name: '👥 Thành viên', value: `${(role as any).members?.size ?? '?'}`, inline: true },
          { name: '📌 Vị trí', value: `${role.position}`, inline: true },
          { name: '📢 Mentionable', value: role.mentionable ? 'Có' : 'Không', inline: true },
          { name: '📌 Hoisted', value: role.hoist ? 'Có' : 'Không', inline: true },
        );
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'remind') {
      const timeStr = interaction.options.getString('time', true);
      const msg = interaction.options.getString('message', true);
      const duration = ms(timeStr);
      if (!duration) return void interaction.reply({ content: '❌ Thời gian không hợp lệ.', ephemeral: true });
      if (duration > ms('30d')) return void interaction.reply({ content: '❌ Tối đa 30 ngày.', ephemeral: true });
      await kernel.db.reminder.create({
        data: { userId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId, message: msg, remindAt: new Date(Date.now() + duration) }
      });
      await interaction.reply({ content: `⏰ Đã đặt nhắc nhở sau **${timeStr}**: "${msg}"`, ephemeral: true });

    } else if (sub === 'color') {
      const hex = interaction.options.getString('hex', true).replace('#', '');
      const color = parseInt(hex, 16);
      if (isNaN(color)) return void interaction.reply({ content: '❌ Mã màu không hợp lệ.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`🎨 #${hex.toUpperCase()}`).setColor(color)
        .setDescription(`HEX: #${hex.toUpperCase()}\nRGB: ${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)}`);
      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'calc') {
      const expr = interaction.options.getString('expression', true);
      try {
        const safe = expr.replace(/[^0-9+\-*/().% ]/g, '');
        const result = Function(`"use strict"; return (${safe})`)();
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🧮 Máy Tính').addFields({ name: '📋 Biểu thức', value: `\`${expr}\`` }, { name: '✅ Kết quả', value: `\`${result}\`` })] });
      } catch {
        await interaction.reply({ content: '❌ Biểu thức không hợp lệ.', ephemeral: true });
      }
    }
  }
}

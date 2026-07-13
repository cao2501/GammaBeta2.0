import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, GuildMember,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';
import ms from 'ms';

export default class BanCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Ban thành viên khỏi server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Thành viên cần ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Lý do ban'))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Xóa tin nhắn (ngày)').setMinValue(0).setMaxValue(7))
    .addStringOption(o => o.setName('duration').setDescription('Thời gian (ví dụ: 7d, 1h) — để trống = vĩnh viễn'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const target = interaction.options.getMember('user') as GuildMember | null;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'Không có lý do';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const durationStr = interaction.options.getString('duration');

    if (!target && !user) return void interaction.editReply('❌ Không tìm thấy thành viên.');
    if (target?.id === interaction.user.id) return void interaction.editReply('❌ Bạn không thể ban chính mình.');
    if (target?.roles.highest.comparePositionTo((interaction.member as GuildMember).roles.highest) >= 0) {
      return void interaction.editReply('❌ Bạn không có quyền ban thành viên này.');
    }

    await ensureGuild(interaction.guildId!, interaction.guild!.name);

    const duration = durationStr ? ms(durationStr) : null;
    const expiresAt = duration ? new Date(Date.now() + duration) : null;

    // Get next case number
    const lastCase = await kernel.db.moderationCase.findFirst({
      where: { guildId: interaction.guildId! },
      orderBy: { caseNumber: 'desc' },
    });
    const caseNumber = (lastCase?.caseNumber ?? 0) + 1;

    await kernel.db.moderationCase.create({
      data: {
        guildId: interaction.guildId!,
        caseNumber,
        type: duration ? 'TEMPBAN' : 'BAN',
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
        expiresAt,
        active: true,
      },
    });

    try {
      // DM user
      await user.send({
        embeds: [new EmbedBuilder()
          .setTitle(`🔨 Bạn đã bị ban khỏi ${interaction.guild!.name}`)
          .setColor(0xe74c3c)
          .addFields(
            { name: '📋 Lý do', value: reason },
            { name: '⏱️ Thời hạn', value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Vĩnh viễn' }
          )
        ],
      }).catch(() => {});

      await interaction.guild!.members.ban(user, {
        reason: `[Case #${caseNumber}] ${reason} | By: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      kernel.eventBus.emit('moderation:ban', {
        guildId: interaction.guildId!,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
      });

      const embed = new EmbedBuilder()
        .setTitle(`🔨 Ban — Case #${caseNumber}`)
        .setColor(0xe74c3c)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '👤 Người dùng', value: `${user.tag} (${user.id})`, inline: true },
          { name: '🛡️ Người thực hiện', value: `${interaction.user.tag}`, inline: true },
          { name: '📋 Lý do', value: reason },
          { name: '⏱️ Thời hạn', value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Vĩnh viễn', inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply('❌ Không thể ban người dùng này. Kiểm tra quyền bot.');
    }
  }
}

import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, GuildMember,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import ms from 'ms';

export default class TimeoutCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('⏱️ Timeout thành viên')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Thời gian (vd: 10m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Lý do'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const target = interaction.options.getMember('user') as GuildMember;
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') ?? 'Không có lý do';

    if (!target) return void interaction.editReply('❌ Không tìm thấy thành viên.');

    const duration = ms(durationStr);
    if (!duration || duration > ms('28d')) {
      return void interaction.editReply('❌ Thời gian không hợp lệ (tối đa 28 ngày).');
    }

    try {
      await target.timeout(duration, reason);

      kernel.eventBus.emit('moderation:timeout', {
        guildId: interaction.guildId!,
        userId: target.id,
        moderatorId: interaction.user.id,
        duration: duration / 1000,
        reason,
      });

      const embed = new EmbedBuilder()
        .setTitle('⏱️ Timeout')
        .setColor(0xf39c12)
        .addFields(
          { name: '👤 Người dùng', value: `${target.user.tag}`, inline: true },
          { name: '⏱️ Thời gian', value: durationStr, inline: true },
          { name: '📋 Lý do', value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('❌ Không thể timeout thành viên này.');
    }
  }
}

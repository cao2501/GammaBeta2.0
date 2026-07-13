import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
  PermissionFlagsBits, GuildMember,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class KickCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 Kick thành viên khỏi server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Thành viên cần kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Lý do kick'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const target = interaction.options.getMember('user') as GuildMember;
    const reason = interaction.options.getString('reason') ?? 'Không có lý do';

    if (!target) return void interaction.editReply('❌ Không tìm thấy thành viên.');
    if (target.id === interaction.user.id) return void interaction.editReply('❌ Bạn không thể kick chính mình.');
    if (!target.kickable) return void interaction.editReply('❌ Bot không có quyền kick thành viên này.');

    const lastCase = await kernel.db.moderationCase.findFirst({
      where: { guildId: interaction.guildId! }, orderBy: { caseNumber: 'desc' }
    });
    const caseNumber = (lastCase?.caseNumber ?? 0) + 1;

    await kernel.db.moderationCase.create({
      data: { guildId: interaction.guildId!, caseNumber, type: 'KICK', userId: target.id, moderatorId: interaction.user.id, reason }
    });

    await target.send({ embeds: [new EmbedBuilder().setTitle(`👢 Bạn đã bị kick khỏi ${interaction.guild!.name}`).setColor(0xe67e22).addFields({ name: '📋 Lý do', value: reason })] }).catch(() => {});
    await target.kick(`[Case #${caseNumber}] ${reason} | By: ${interaction.user.tag}`);

    kernel.eventBus.emit('moderation:kick', { guildId: interaction.guildId!, userId: target.id, moderatorId: interaction.user.id, reason });

    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`👢 Kick — Case #${caseNumber}`).setColor(0xe67e22).addFields({ name: '👤 Người dùng', value: target.user.tag, inline: true }, { name: '📋 Lý do', value: reason }).setTimestamp()] });
  }
}

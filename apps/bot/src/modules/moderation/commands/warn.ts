import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class WarnCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('⚠️ Cảnh báo thành viên')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName('add').setDescription('Thêm cảnh báo')
      .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Lý do').setRequired(true))
      .addIntegerOption(o => o.setName('points').setDescription('Điểm vi phạm (1-5)').setMinValue(1).setMaxValue(5))
    )
    .addSubcommand(s => s.setName('remove').setDescription('Xóa cảnh báo')
      .addStringOption(o => o.setName('id').setDescription('ID cảnh báo').setRequired(true))
    )
    .addSubcommand(s => s.setName('list').setDescription('Xem lịch sử cảnh báo')
      .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
    )
    .addSubcommand(s => s.setName('clear').setDescription('Xóa tất cả cảnh báo')
      .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const points = interaction.options.getInteger('points') ?? 1;

      const warning = await kernel.db.warning.create({
        data: { guildId: interaction.guildId!, userId: target.id, moderator: interaction.user.id, reason, points },
      });

      const totalWarnings = await kernel.db.warning.count({ where: { guildId: interaction.guildId!, userId: target.id, active: true } });
      const totalPoints = await kernel.db.warning.aggregate({ where: { guildId: interaction.guildId!, userId: target.id, active: true }, _sum: { points: true } });

      kernel.eventBus.emit('moderation:warn', { guildId: interaction.guildId!, userId: target.id, moderatorId: interaction.user.id, reason, points });

      // DM user
      await target.send({ embeds: [new EmbedBuilder().setTitle(`⚠️ Bạn đã nhận cảnh báo tại ${interaction.guild!.name}`).setColor(0xf1c40f).addFields({ name: '📋 Lý do', value: reason }, { name: '📊 Tổng cảnh báo', value: `${totalWarnings} | ${totalPoints._sum.points ?? 0} điểm` })] }).catch(() => {});

      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚠️ Cảnh Báo — ID: ${warning.id.slice(-6)}`).setColor(0xf1c40f).addFields({ name: '👤 Người dùng', value: target.tag, inline: true }, { name: '📊 Điểm', value: `${points}`, inline: true }, { name: '📋 Lý do', value: reason }, { name: '📈 Tổng', value: `${totalWarnings} cảnh báo | ${totalPoints._sum.points ?? 0} điểm` }).setTimestamp()] });
    } else if (sub === 'remove') {
      const warnId = interaction.options.getString('id', true);
      const warning = await kernel.db.warning.findFirst({ where: { guildId: interaction.guildId!, id: { endsWith: warnId } } });
      if (!warning) return void interaction.reply({ content: '❌ Không tìm thấy cảnh báo.', ephemeral: true });
      await kernel.db.warning.update({ where: { id: warning.id }, data: { active: false } });
      await interaction.reply({ content: `✅ Đã xóa cảnh báo \`${warnId}\`.`, ephemeral: true });
    } else if (sub === 'list') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user', true);
      const warnings = await kernel.db.warning.findMany({ where: { guildId: interaction.guildId!, userId: target.id, active: true }, orderBy: { createdAt: 'desc' }, take: 10 });
      const embed = new EmbedBuilder().setTitle(`⚠️ Cảnh Báo — ${target.tag}`).setColor(0xf1c40f)
        .setDescription(warnings.length ? warnings.map((w, i) => `\`${i + 1}.\` **${w.reason}** — ${w.points}pts — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n') : 'Không có cảnh báo nào.')
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'clear') {
      const target = interaction.options.getUser('user', true);
      const count = await kernel.db.warning.updateMany({ where: { guildId: interaction.guildId!, userId: target.id, active: true }, data: { active: false } });
      await interaction.reply({ content: `✅ Đã xóa **${count.count}** cảnh báo của ${target.tag}.`, ephemeral: true });
    }
  }
}

import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class PremiumCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('premium')
    .setDescription('💎 Quản lý Premium')
    .addSubcommand(s => s.setName('info').setDescription('Xem trạng thái premium server'))
    .addSubcommand(s => s.setName('activate').setDescription('[Owner] Kích hoạt premium cho server')
      .addStringOption(o => o.setName('guild_id').setDescription('Server ID').setRequired(true))
      .addIntegerOption(o => o.setName('days').setDescription('Số ngày').setRequired(true).setMinValue(1).setMaxValue(365))
      .addStringOption(o => o.setName('plan').setDescription('Gói').addChoices(
        { name: '🥈 Basic (1 tháng)', value: 'BASIC' },
        { name: '🥇 Pro (3 tháng)', value: 'PRO' },
        { name: '💎 Ultimate (1 năm)', value: 'ULTIMATE' },
      ))
    )
    .addSubcommand(s => s.setName('revoke').setDescription('[Owner] Thu hồi premium')
      .addStringOption(o => o.setName('guild_id').setDescription('Server ID').setRequired(true))
    )
    .addSubcommand(s => s.setName('list').setDescription('[Owner] Danh sách premium servers'));

  ownerOnly = false; // check manually for owner subcommands

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'info') {
      const guild = await kernel.db.guild.findUnique({ where: { id: guildId }, include: { premiumRecord: true } });
      const isPremium = guild?.premium ?? false;
      const record = (guild as any)?.premiumRecord;

      const embed = new EmbedBuilder()
        .setTitle('💎 Premium Status')
        .setColor(isPremium ? 0xf1c40f : 0x5865f2)
        .addFields(
          { name: '✨ Trạng thái', value: isPremium ? '💎 Premium Active' : '⚪ Free Plan', inline: true },
          { name: '📋 Gói', value: record?.plan ?? 'N/A', inline: true },
          { name: '📅 Hết hạn', value: record?.expiresAt ? `<t:${Math.floor(record.expiresAt.getTime() / 1000)}:R>` : 'N/A', inline: true },
        )
        .setFooter({ text: isPremium ? '🎉 Cảm ơn bạn đã sử dụng Premium!' : 'Liên hệ bot owner để kích hoạt Premium.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'activate') {
      if (!kernel.isOwner(interaction.user.id)) return void interaction.reply({ content: '❌ Chỉ owner bot mới dùng được.', ephemeral: true });
      const targetGuildId = interaction.options.getString('guild_id', true);
      const days = interaction.options.getInteger('days', true);
      const plan = interaction.options.getString('plan') ?? 'BASIC';
      const expiresAt = new Date(Date.now() + days * 86400000);

      await kernel.db.guild.upsert({
        where: { id: targetGuildId },
        create: { id: targetGuildId, name: `Guild ${targetGuildId}`, premium: true },
        update: { premium: true },
      });

      await kernel.db.premiumRecord.upsert({
        where: { guildId: targetGuildId },
        create: { guildId: targetGuildId, plan, expiresAt, activatedBy: interaction.user.id, active: true },
        update: { plan, expiresAt, activatedBy: interaction.user.id, active: true },
      });

      await interaction.reply({ content: `✅ Đã kích hoạt **${plan}** Premium cho server \`${targetGuildId}\` — ${days} ngày (hết hạn <t:${Math.floor(expiresAt.getTime() / 1000)}:R>).`, ephemeral: true });

    } else if (sub === 'revoke') {
      if (!kernel.isOwner(interaction.user.id)) return void interaction.reply({ content: '❌ Chỉ owner bot.', ephemeral: true });
      const targetGuildId = interaction.options.getString('guild_id', true);
      await kernel.db.guild.update({ where: { id: targetGuildId }, data: { premium: false } }).catch(() => {});
      await kernel.db.premiumRecord.updateMany({ where: { guildId: targetGuildId }, data: { active: false } });
      await interaction.reply({ content: `✅ Đã thu hồi Premium của server \`${targetGuildId}\`.`, ephemeral: true });

    } else if (sub === 'list') {
      if (!kernel.isOwner(interaction.user.id)) return void interaction.reply({ content: '❌ Chỉ owner bot.', ephemeral: true });
      const premiumGuilds = await kernel.db.premiumRecord.findMany({ where: { active: true }, orderBy: { expiresAt: 'asc' }, take: 20 });
      const embed = new EmbedBuilder()
        .setTitle('💎 Premium Servers')
        .setColor(0xf1c40f)
        .setDescription(
          premiumGuilds.length
            ? premiumGuilds.map(r => `🏠 \`${r.guildId}\` — **${r.plan}** — Hết hạn <t:${Math.floor(r.expiresAt.getTime() / 1000)}:R>`).join('\n')
            : 'Không có server premium nào.'
        )
        .setFooter({ text: `Tổng: ${premiumGuilds.length} servers` });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

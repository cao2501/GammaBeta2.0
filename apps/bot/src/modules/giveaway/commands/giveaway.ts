import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';
import ms from 'ms';

export default class GiveawayCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Hệ thống Giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('start').setDescription('Bắt đầu giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Giải thưởng').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Thời gian (vd: 1h, 1d)').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Số người thắng').setMinValue(1).setMaxValue(20))
    )
    .addSubcommand(s => s.setName('end').setDescription('Kết thúc giveaway sớm').addStringOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll người thắng').addStringOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('pause').setDescription('Tạm dừng giveaway').addStringOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách giveaways'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'start') {
      const prize = interaction.options.getString('prize', true);
      const durationStr = interaction.options.getString('duration', true);
      const winnerCount = interaction.options.getInteger('winners') ?? 1;
      const duration = ms(durationStr);
      if (!duration) return void interaction.editReply('❌ Thời gian không hợp lệ.');
      const endsAt = new Date(Date.now() + duration);

      await ensureGuild(guildId, interaction.guild!.name);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY — ${prize}`)
        .setColor(0xf1c40f)
        .addFields(
          { name: '🏆 Giải thưởng', value: prize, inline: true },
          { name: '👥 Số người thắng', value: `${winnerCount}`, inline: true },
          { name: '⏱️ Kết thúc', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '🎯 Tham gia', value: 'Nhấn nút 🎉 bên dưới để tham gia!' }
        )
        .setTimestamp(endsAt)
        .setFooter({ text: `Kết thúc lúc` });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('giveaway:enter:PLACEHOLDER').setLabel('🎉 Tham Gia').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('giveaway:list:PLACEHOLDER').setLabel('👥 Xem DS').setStyle(ButtonStyle.Secondary),
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const giveaway = await kernel.db.giveaway.create({
        data: { guildId, channelId: interaction.channelId, messageId: (msg as any).id, hostId: interaction.user.id, prize, winnerCount, endsAt },
      });

      // Update button custom IDs with real ID
      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`giveaway:enter:${giveaway.id}`).setLabel('🎉 Tham Gia').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`giveaway:list:${giveaway.id}`).setLabel('👥 Xem DS').setStyle(ButtonStyle.Secondary),
      );
      await (msg as any).edit({ embeds: [embed], components: [updatedRow] });
    } else if (sub === 'list') {
      const giveaways = await kernel.db.giveaway.findMany({ where: { guildId, status: 'ACTIVE' }, orderBy: { endsAt: 'asc' }, take: 10 });
      const embed = new EmbedBuilder().setTitle('🎉 Giveaways Đang Diễn Ra').setColor(0xf1c40f)
        .setDescription(giveaways.length ? giveaways.map(g => `**${g.prize}** — ${JSON.parse(g.entries ?? '[]').length} người — <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`).join('\n') : 'Không có giveaway nào đang diễn ra.');
      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'reroll') {
      const id = interaction.options.getString('id', true);
      const gw = await kernel.db.giveaway.findFirst({ where: { guildId, id: { endsWith: id } } });
      if (!gw) return void interaction.editReply('❌ Không tìm thấy giveaway.');
      const entries: string[] = JSON.parse(gw.entries ?? '[]');
      if (!entries.length) return void interaction.editReply('❌ Không có người tham gia.');
      const winner = entries[Math.floor(Math.random() * entries.length)]!;
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🎲 Reroll! Người thắng mới: <@${winner}>`)] });
    } else if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      const gw = await kernel.db.giveaway.findFirst({ where: { guildId, id: { endsWith: id }, status: 'ACTIVE' } });
      if (!gw) return void interaction.editReply('❌ Không tìm thấy giveaway đang active.');
      const mod = kernel.client.modules.get('giveaway') as any;
      if (mod?.endGiveaway) await mod.endGiveaway(kernel, gw);
      await interaction.editReply('✅ Giveaway đã kết thúc.');
    } else if (sub === 'pause') {
      const id = interaction.options.getString('id', true);
      await kernel.db.giveaway.updateMany({ where: { guildId, id: { endsWith: id } }, data: { status: 'PAUSED' } });
      await interaction.editReply('✅ Giveaway đã tạm dừng.');
    }
  }
}

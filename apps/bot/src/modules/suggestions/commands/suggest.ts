import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class SuggestionCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('💡 Hệ thống góp ý')
    .addSubcommand(s => s.setName('add').setDescription('Gửi đề xuất')
      .addStringOption(o => o.setName('content').setDescription('Nội dung đề xuất').setRequired(true))
      .addBooleanOption(o => o.setName('anonymous').setDescription('Ẩn danh?'))
    )
    .addSubcommand(s => s.setName('approve').setDescription('Chấp nhận đề xuất').addStringOption(o => o.setName('id').setDescription('ID đề xuất').setRequired(true)).addStringOption(o => o.setName('note').setDescription('Ghi chú')))
    .addSubcommand(s => s.setName('reject').setDescription('Từ chối đề xuất').addStringOption(o => o.setName('id').setDescription('ID đề xuất').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Lý do')))
    .addSubcommand(s => s.setName('consider').setDescription('Đang xem xét').addStringOption(o => o.setName('id').setDescription('ID đề xuất').setRequired(true)))
    .addSubcommand(s => s.setName('setup').setDescription('Cấu hình kênh đề xuất').addChannelOption(o => o.setName('channel').setDescription('Kênh').setRequired(true)));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    
    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const content = interaction.options.getString('content', true);
      const anonymous = interaction.options.getBoolean('anonymous') ?? false;

      const { config } = await import('../../../database/helpers').then(m => m.getModuleConfig(guildId, 'suggestions'));
      const cfg = config as any;
      if (!cfg.channelId) return void interaction.editReply('❌ Admin chưa cấu hình kênh đề xuất. Dùng `/suggest setup`.');

      await ensureGuild(guildId, interaction.guild!.name);

      const embed = new EmbedBuilder()
        .setTitle('💡 Đề Xuất Mới')
        .setColor(0xf39c12)
        .setDescription(content)
        .addFields({ name: '👤 Người đề xuất', value: anonymous ? '🔒 Ẩn danh' : interaction.user.tag })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('suggest:upvote:PLACEHOLDER').setLabel('👍 0').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggest:downvote:PLACEHOLDER').setLabel('👎 0').setStyle(ButtonStyle.Danger),
      );

      const ch = kernel.client.channels.cache.get(cfg.channelId);
      if (!ch?.isTextBased()) return void interaction.editReply('❌ Kênh đề xuất không hợp lệ.');
      const msg = await (ch as any).send({ embeds: [embed], components: [row] });

      const sug = await kernel.db.suggestion.create({
        data: { guildId, channelId: cfg.channelId, messageId: msg.id, authorId: anonymous ? 'anonymous' : interaction.user.id, content, anonymous }
      });

      const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`suggest:upvote:${sug.id}`).setLabel('👍 0').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`suggest:downvote:${sug.id}`).setLabel('👎 0').setStyle(ButtonStyle.Danger),
      );
      await msg.edit({ components: [updatedRow] });

      await interaction.editReply(`✅ Đề xuất của bạn đã được gửi!`);
    } else if (sub === 'approve' || sub === 'reject' || sub === 'consider') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return void interaction.reply({ content: '❌ Bạn cần quyền Manage Server.', ephemeral: true });
      const id = interaction.options.getString('id', true);
      const note = interaction.options.getString('note') ?? interaction.options.getString('reason') ?? undefined;
      const status = sub === 'approve' ? 'APPROVED' : sub === 'reject' ? 'REJECTED' : 'CONSIDERED';
      const sug = await kernel.db.suggestion.findFirst({ where: { guildId, id: { endsWith: id } } });
      if (!sug) return void interaction.reply({ content: '❌ Không tìm thấy đề xuất.', ephemeral: true });
      await kernel.db.suggestion.update({ where: { id: sug.id }, data: { status, reviewNote: note, reviewedBy: interaction.user.id } });
      const colors: Record<string, number> = { APPROVED: 0x2ecc71, REJECTED: 0xe74c3c, CONSIDERED: 0xf39c12 };
      const icons: Record<string, string> = { APPROVED: '✅', REJECTED: '❌', CONSIDERED: '🤔' };
      const ch = kernel.client.channels.cache.get(sug.channelId);
      if (sug.messageId && ch?.isTextBased()) {
        const msg = await (ch as any).messages.fetch(sug.messageId).catch(() => null);
        if (msg) {
          const updated = new EmbedBuilder(msg.embeds[0]?.toJSON() ?? {}).setColor(colors[status] ?? 0x5865f2).addFields({ name: `${icons[status]} Trạng thái`, value: `${status}${note ? ` — ${note}` : ''}` });
          await msg.edit({ embeds: [updated], components: [] });
        }
      }
      await interaction.reply({ content: `✅ Đề xuất đã được cập nhật: **${status}**`, ephemeral: true });
    } else if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      await import('../../../database/helpers').then(m => m.setModuleConfig(guildId, 'suggestions', { channelId: channel.id }));
      await interaction.reply({ content: `✅ Kênh đề xuất → <#${channel.id}>`, ephemeral: true });
    }
  }
}

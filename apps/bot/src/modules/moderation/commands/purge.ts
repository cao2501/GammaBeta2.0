import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, Message,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class PurgeCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('purge')
    .setDescription('🗑️ Xóa tin nhắn hàng loạt')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('all').setDescription('Xóa tất cả tin nhắn')
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('user').setDescription('Xóa tin nhắn của user')
      .addUserOption(o => o.setName('user').setDescription('Người dùng').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng').setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('bot').setDescription('Xóa tin nhắn của bot')
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng').setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('link').setDescription('Xóa tin nhắn có link')
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng').setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('attachment').setDescription('Xóa tin nhắn có file đính kèm')
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng').setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('regex').setDescription('Xóa tin nhắn khớp regex')
      .addStringOption(o => o.setName('pattern').setDescription('Regex pattern').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Số lượng').setMinValue(1).setMaxValue(100)));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger('amount') ?? 50;
    const channel = interaction.channel!;

    if (!channel.isTextBased() || channel.isDMBased()) {
      return void interaction.editReply('❌ Lệnh này chỉ dùng được trong server.');
    }

    const fetched = await (channel as any).messages.fetch({ limit: Math.min(amount + 1, 100) });
    let toDelete: Message[] = Array.from(fetched.values());

    // Filter based on subcommand
    if (sub === 'user') {
      const targetUser = interaction.options.getUser('user', true);
      toDelete = toDelete.filter(m => m.author.id === targetUser.id);
    } else if (sub === 'bot') {
      toDelete = toDelete.filter(m => m.author.bot);
    } else if (sub === 'link') {
      toDelete = toDelete.filter(m => /https?:\/\//.test(m.content));
    } else if (sub === 'attachment') {
      toDelete = toDelete.filter(m => m.attachments.size > 0);
    } else if (sub === 'regex') {
      const pattern = interaction.options.getString('pattern', true);
      const regex = new RegExp(pattern, 'i');
      toDelete = toDelete.filter(m => regex.test(m.content));
    }

    // Discord only allows bulk delete for messages < 14 days old
    const twoWeeks = Date.now() - 14 * 24 * 60 * 60 * 1000;
    toDelete = toDelete.filter(m => m.createdTimestamp > twoWeeks).slice(0, amount);

    if (toDelete.length === 0) return void interaction.editReply('❌ Không có tin nhắn nào phù hợp để xóa.');

    const deleted = await (channel as any).bulkDelete(toDelete, true);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Purge')
      .setColor(0xe74c3c)
      .addFields(
        { name: '✅ Đã xóa', value: `${deleted.size} tin nhắn`, inline: true },
        { name: '📋 Loại', value: sub, inline: true },
        { name: '👤 Thực hiện bởi', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

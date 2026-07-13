import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';
import ms from 'ms';

export default class PollCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 Tạo poll')
    .addSubcommand(s => s.setName('create').setDescription('Tạo poll mới')
      .addStringOption(o => o.setName('question').setDescription('Câu hỏi').setRequired(true))
      .addStringOption(o => o.setName('options').setDescription('Lựa chọn, phân cách bằng | (vd: A|B|C)').setRequired(true))
      .addBooleanOption(o => o.setName('anonymous').setDescription('Ẩn danh?'))
      .addBooleanOption(o => o.setName('multi').setDescription('Nhiều lựa chọn?'))
      .addStringOption(o => o.setName('duration').setDescription('Thời gian tự kết thúc (vd: 1h)'))
    )
    .addSubcommand(s => s.setName('end').setDescription('Kết thúc poll').addStringOption(o => o.setName('id').setDescription('Poll ID').setRequired(true)));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      await interaction.deferReply();
      const question = interaction.options.getString('question', true);
      const optionsRaw = interaction.options.getString('options', true).split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
      const anonymous = interaction.options.getBoolean('anonymous') ?? false;
      const multi = interaction.options.getBoolean('multi') ?? false;
      const durationStr = interaction.options.getString('duration');
      const endsAt = durationStr ? new Date(Date.now() + ms(durationStr)) : null;

      await ensureGuild(interaction.guildId!, interaction.guild!.name);

      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setColor(0x3498db)
        .setDescription(optionsRaw.map((opt, i) => `${emojis[i]} ${opt}`).join('\n'))
        .setFooter({ text: `${anonymous ? '🔒 Ẩn danh' : '👀 Công khai'} | ${multi ? 'Nhiều lựa chọn' : 'Một lựa chọn'}${endsAt ? ` | Kết thúc <t:${Math.floor(endsAt.getTime()/1000)}:R>` : ''}` });

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      const chunks = [];
      for (let i = 0; i < optionsRaw.length; i += 5) chunks.push(optionsRaw.slice(i, i + 5));
      chunks.forEach((chunk, ci) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        chunk.forEach((opt, i) => {
          row.addComponents(new ButtonBuilder().setCustomId(`poll:vote:PLACEHOLDER:${ci * 5 + i}`).setLabel(`${emojis[ci * 5 + i]} ${opt.slice(0, 50)}`).setStyle(ButtonStyle.Secondary));
        });
        rows.push(row);
      });

      const msg = await interaction.editReply({ embeds: [embed], components: rows });

      const poll = await kernel.db.poll.create({
        data: { guildId: interaction.guildId!, channelId: interaction.channelId, messageId: (msg as any).id, creatorId: interaction.user.id, question, options: JSON.stringify(optionsRaw), anonymous, multiChoice: multi, endsAt },
      });

      // Update button IDs
      const updatedRows: ActionRowBuilder<ButtonBuilder>[] = [];
      chunks.forEach((chunk, ci) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        chunk.forEach((opt, i) => {
          row.addComponents(new ButtonBuilder().setCustomId(`poll:vote:${poll.id}:${ci * 5 + i}`).setLabel(`${emojis[ci * 5 + i]} ${opt.slice(0, 50)}`).setStyle(ButtonStyle.Secondary));
        });
        updatedRows.push(row);
      });
      await (msg as any).edit({ embeds: [embed], components: updatedRows });
    } else if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      const poll = await kernel.db.poll.findFirst({ where: { guildId: interaction.guildId!, id: { endsWith: id }, status: 'ACTIVE' } });
      if (!poll) return void interaction.reply({ content: '❌ Không tìm thấy poll.', ephemeral: true });
      await kernel.db.poll.update({ where: { id: poll.id }, data: { status: 'ENDED' } });
      await interaction.reply({ content: '✅ Poll đã kết thúc.', ephemeral: true });
    }
  }
}

import { Interaction, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { logger } from '../../../core/logger/Logger';

export default class PollInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('poll:vote:')) return;

    const parts = interaction.customId.split(':');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3], 10);

    const poll = await kernel.db.poll.findUnique({
      where: { id: pollId }
    });

    if (!poll || poll.status !== 'ACTIVE') {
      return void interaction.reply({ content: '❌ Cuộc bình chọn này đã kết thúc hoặc không tồn tại.', ephemeral: true });
    }

    const userId = interaction.user.id;
    const votes: Record<string, string[]> = JSON.parse(poll.votes ?? '{}');
    const options: string[] = JSON.parse(poll.options ?? '[]');
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    // Ensure all options are initialized in votes object
    options.forEach((_, idx) => {
      if (!votes[idx]) votes[idx] = [];
    });

    const alreadyVotedThisOption = votes[optionIndex].includes(userId);

    if (poll.multiChoice) {
      // Multiple choice poll: Toggle vote
      if (alreadyVotedThisOption) {
        votes[optionIndex] = votes[optionIndex].filter(id => id !== userId);
      } else {
        votes[optionIndex].push(userId);
      }
    } else {
      // Single choice poll: Remove from all other options, toggle for current
      options.forEach((_, idx) => {
        votes[idx] = votes[idx].filter(id => id !== userId);
      });

      if (!alreadyVotedThisOption) {
        votes[optionIndex].push(userId);
      }
    }

    // Save back to DB
    await kernel.db.poll.update({
      where: { id: poll.id },
      data: { votes: JSON.stringify(votes) }
    });

    // Re-render description
    const total = Object.values(votes).reduce((a, b) => a + b.length, 0);
    const description = options.map((opt, i) => {
      const count = votes[i]?.length ?? 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      
      // Progress bar
      const barLength = 10;
      const filledLength = total ? Math.round((count / total) * barLength) : 0;
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      
      let line = `${emojis[i]} **${opt}**\n` +
                 `➡️ ${bar} **${count}** phiếu (${pct}%)`;
                 
      if (!poll.anonymous && count > 0) {
        const votersList = votes[i].map(vId => `<@${vId}>`).join(', ');
        line += `\n└ *Người bình chọn:* ${votersList}`;
      }
      return line;
    }).join('\n\n');

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setDescription(description);

    await interaction.update({ embeds: [updatedEmbed] });
  }
}

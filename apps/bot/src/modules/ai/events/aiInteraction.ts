import { Interaction } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class AIInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('ai:clear:')) return;

    const userId = interaction.customId.split(':')[2];
    if (interaction.user.id !== userId) {
      return void interaction.reply({ content: '❌ Đây không phải lịch sử của bạn.', ephemeral: true });
    }

    // Import and clear conversation
    await interaction.reply({ content: '✅ Đã xóa lịch sử trò chuyện AI.', ephemeral: true });
    kernel.eventBus.emit('ai:clear_history', { userId });
  }
}

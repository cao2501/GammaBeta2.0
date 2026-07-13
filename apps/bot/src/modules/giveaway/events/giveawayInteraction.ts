import { Interaction, ButtonInteraction } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { ensureMember } from '../../../database/helpers';

export default class GiveawayInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    const [ns, action, id] = interaction.customId.split(':');
    if (ns !== 'giveaway') return;

    if (action === 'enter') {
      await interaction.deferReply({ ephemeral: true });
      const gw = await kernel.db.giveaway.findUnique({ where: { id } });
      if (!gw || gw.status !== 'ACTIVE') return void interaction.editReply('❌ Giveaway này không còn active.');
      const entries: string[] = JSON.parse(gw.entries ?? '[]');
      if (entries.includes(interaction.user.id)) return void interaction.editReply('✅ Bạn đã tham gia giveaway này rồi!');
      entries.push(interaction.user.id);
      await kernel.db.giveaway.update({ where: { id }, data: { entries: JSON.stringify(entries) } });
      kernel.eventBus.emit('giveaway:enter', { guildId: gw.guildId, giveawayId: id, userId: interaction.user.id });
      await interaction.editReply(`🎉 Bạn đã tham gia giveaway! Tổng: **${entries.length}** người.`);
    }
  }
}

import { Message, OldMessage, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class MessageDeleteEvent implements IEvent<'messageDelete'> {
  name = 'messageDelete' as const;

  async execute(kernel: Kernel, message: Message | any): Promise<void> {
    if (!message.guild || message.author?.bot) return;

    const logChannel = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId: message.guildId, eventType: 'MESSAGE_DELETE' } },
    });
    if (!logChannel?.enabled) return;

    const channel = kernel.client.channels.cache.get(logChannel.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor(0xe74c3c)
      .addFields(
        { name: '👤 Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
        { name: '📝 Channel', value: `<#${message.channelId}>`, inline: true },
        { name: '💬 Content', value: message.content?.slice(0, 1024) || '*No text content*' }
      )
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

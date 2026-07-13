import { Message, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class MessageEditLogEvent implements IEvent<'messageUpdate'> {
  name = 'messageUpdate' as const;

  async execute(kernel: Kernel, oldMsg: Message | any, newMsg: Message | any): Promise<void> {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const logChannel = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId: newMsg.guildId, eventType: 'MESSAGE_EDIT' } },
    });
    if (!logChannel?.enabled) return;

    const channel = kernel.client.channels.cache.get(logChannel.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor(0xf39c12)
      .addFields(
        { name: '👤 Author', value: `${newMsg.author?.tag ?? 'Unknown'} (${newMsg.author?.id})`, inline: true },
        { name: '📝 Channel', value: `<#${newMsg.channelId}>`, inline: true },
        { name: '🔗 Jump', value: `[Go to message](${newMsg.url})`, inline: true },
        { name: '📜 Before', value: (oldMsg.content?.slice(0, 500) || '*Empty*') },
        { name: '📝 After', value: (newMsg.content?.slice(0, 500) || '*Empty*') },
      )
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

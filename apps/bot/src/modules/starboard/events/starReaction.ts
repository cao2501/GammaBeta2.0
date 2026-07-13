import { MessageReaction, User, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig } from '../../../database/helpers';

export default class StarboardReactionEvent implements IEvent<'messageReactionAdd'> {
  name = 'messageReactionAdd' as const;

  async execute(kernel: Kernel, reaction: MessageReaction, user: User): Promise<void> {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const guild = reaction.message.guild;
    if (!guild) return;

    const { enabled, config } = await getModuleConfig<any>(guild.id, 'starboard');
    if (!enabled || !config.channelId) return;

    const emoji = config.emoji ?? '⭐';
    const threshold = config.threshold ?? 3;
    const ignoredChannels: string[] = config.ignoredChannels ?? [];

    // Check emoji matches
    const reactionEmoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    if (reactionEmoji !== emoji && reaction.emoji.name !== emoji) return;

    // Check ignored channels
    if (ignoredChannels.includes(reaction.message.channelId)) return;

    const count = reaction.count ?? 0;
    if (count < threshold) return;

    // Check or create starboard entry
    const existing = await kernel.db.starboardEntry.findUnique({ where: { guildId_messageId: { guildId: guild.id, messageId: reaction.message.id } } });
    const sbChannel = kernel.client.channels.cache.get(config.channelId);
    if (!sbChannel?.isTextBased()) return;

    const message = reaction.message;
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setAuthor({ name: message.author?.tag ?? 'Unknown', iconURL: message.author?.displayAvatarURL() })
      .setDescription(message.content?.slice(0, 2000) || null)
      .addFields(
        { name: '📌 Original', value: `[Jump to message](${message.url})`, inline: true },
        { name: '📝 Channel', value: `<#${message.channelId}>`, inline: true },
      )
      .setTimestamp(message.createdAt);

    if (message.attachments.first()) {
      embed.setImage(message.attachments.first()!.url);
    }

    if (!existing) {
      const sbMsg = await (sbChannel as any).send({
        content: `${emoji} **${count}** | <#${message.channelId}>`,
        embeds: [embed],
      });
      await kernel.db.starboardEntry.create({
        data: { guildId: guild.id, messageId: message.id, starboardMessageId: sbMsg.id, channelId: message.channelId, authorId: message.author?.id ?? 'unknown', starCount: count },
      });
    } else {
      // Update star count
      await kernel.db.starboardEntry.update({ where: { guildId_messageId: { guildId: guild.id, messageId: message.id } }, data: { starCount: count } });
      const sbMsg = await (sbChannel as any).messages.fetch(existing.starboardMessageId).catch(() => null);
      if (sbMsg) {
        await sbMsg.edit({ content: `${emoji} **${count}** | <#${message.channelId}>`, embeds: [embed] });
      }
    }
  }
}

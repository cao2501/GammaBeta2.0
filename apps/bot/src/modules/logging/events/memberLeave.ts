import { GuildMember, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class MemberLeaveLogEvent implements IEvent<'guildMemberRemove'> {
  name = 'guildMemberRemove' as const;

  async execute(kernel: Kernel, member: GuildMember): Promise<void> {
    const logChannel = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId: member.guild.id, eventType: 'MEMBER_LEAVE' } },
    });
    if (!logChannel?.enabled) return;

    const channel = kernel.client.channels.cache.get(logChannel.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('👋 Member Left')
      .setColor(0xe74c3c)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '👤 User', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: '🎭 Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.toString()).slice(0, 5).join(', ') || 'None', inline: true },
        { name: '📥 Joined', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : 'Unknown', inline: true },
        { name: '👥 Remaining Members', value: `${member.guild.memberCount}`, inline: true },
      )
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

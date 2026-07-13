import { GuildMember, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class MemberJoinLogEvent implements IEvent<'guildMemberAdd'> {
  name = 'guildMemberAdd' as const;

  async execute(kernel: Kernel, member: GuildMember): Promise<void> {
    const logChannel = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId: member.guild.id, eventType: 'MEMBER_JOIN' } },
    });
    if (!logChannel?.enabled) return;

    const channel = kernel.client.channels.cache.get(logChannel.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('✅ Member Joined')
      .setColor(0x2ecc71)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '👤 User', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Server Members', value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

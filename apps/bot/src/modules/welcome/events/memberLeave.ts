import { GuildMember, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig } from '../../../database/helpers';

export default class WelcomeLeaveEvent implements IEvent<'guildMemberRemove'> {
  name = 'guildMemberRemove' as const;

  async execute(kernel: Kernel, member: GuildMember): Promise<void> {
    const { enabled, config } = await getModuleConfig<any>(member.guild.id, 'welcome');
    if (!enabled || !config.leaveEnabled || !config.leaveChannelId) return;

    const replaceVars = (str: string) => str
      .replace(/{user}/g, member.user.tag)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, String(member.guild.memberCount));

    const ch = kernel.client.channels.cache.get(config.leaveChannelId);
    if (ch?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setDescription(replaceVars(config.leaveMessage ?? '👋 **{user}** đã rời khỏi server. Còn **{count}** thành viên.'))
        .setColor(0xe74c3c)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await (ch as any).send({ embeds: [embed] }).catch(() => {});
    }
  }
}

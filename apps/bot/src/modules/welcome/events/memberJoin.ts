import { GuildMember, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig, ensureGuild, ensureMember } from '../../../database/helpers';

export default class WelcomeJoinEvent implements IEvent<'guildMemberAdd'> {
  name = 'guildMemberAdd' as const;

  async execute(kernel: Kernel, member: GuildMember): Promise<void> {
    const { enabled, config } = await getModuleConfig<any>(member.guild.id, 'welcome');
    if (!enabled) return;
    
    // Ensure DB records
    await ensureMember(member.guild.id, member.id).catch(() => {});

    const replaceVars = (str: string) => str
      .replace(/{user}/g, member.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, String(member.guild.memberCount))
      .replace(/{tag}/g, member.user.tag);

    // Welcome channel message
    if (config.welcomeEnabled && config.welcomeChannelId) {
      const ch = kernel.client.channels.cache.get(config.welcomeChannelId);
      if (ch?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setDescription(replaceVars(config.welcomeMessage ?? '👋 Chào mừng {user} đến với **{server}**!'))
          .setColor(0x2ecc71)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        await (ch as any).send({ embeds: [embed] }).catch(() => {});
      }
    }

    // DM welcome
    if (config.dmEnabled && config.dmMessage) {
      await member.send({ embeds: [new EmbedBuilder()
        .setDescription(replaceVars(config.dmMessage))
        .setColor(0x5865f2)
      ]}).catch(() => {});
    }

    // Auto-assign verify role if configured
    if (config.joinRoleId) {
      await member.roles.add(config.joinRoleId).catch(() => {});
    }
  }
}

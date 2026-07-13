import { VoiceState, ChannelType, PermissionFlagsBits } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig } from '../../../database/helpers';

export default class VoiceStateUpdateEvent implements IEvent<'voiceStateUpdate'> {
  name = 'voiceStateUpdate' as const;

  async execute(kernel: Kernel, oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!newState.guild) return;
    const { enabled, config } = await getModuleConfig<any>(newState.guild.id, 'temp-voice');
    if (!enabled || !config.hubChannelId) return;

    // User joined hub channel → create temp channel
    if (newState.channelId === config.hubChannelId && newState.member) {
      const channel = await newState.guild.channels.create({
        name: config.nameTemplate?.replace('{user}', newState.member.user.username) ?? `🔊 ${newState.member.user.username}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel?.parentId,
        userLimit: config.defaultLimit ?? 0,
        permissionOverwrites: [
          { id: newState.member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }
        ],
      });

      await kernel.db.tempChannel.create({
        data: { guildId: newState.guild.id, channelId: channel.id, ownerId: newState.member.id, name: channel.name }
      });

      await newState.member.voice.setChannel(channel);
    }

    // User left a temp channel → delete if empty
    if (oldState.channelId && oldState.channelId !== config.hubChannelId) {
      const temp = await kernel.db.tempChannel.findUnique({ where: { channelId: oldState.channelId } });
      if (temp) {
        const ch = oldState.guild.channels.cache.get(oldState.channelId);
        if (ch && 'members' in ch && ch.members.size === 0) {
          await ch.delete();
          await kernel.db.tempChannel.delete({ where: { channelId: oldState.channelId } });
        }
      }
    }
  }
}

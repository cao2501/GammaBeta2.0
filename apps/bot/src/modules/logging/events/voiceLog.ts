import { VoiceState, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class VoiceLogEvent implements IEvent<'voiceStateUpdate'> {
  name = 'voiceStateUpdate' as const;

  async execute(kernel: Kernel, oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!newState.guild || newState.member?.user.bot) return;

    let eventType: string | null = null;
    let description = '';
    let color = 0x3498db;

    if (!oldState.channelId && newState.channelId) {
      eventType = 'VOICE_JOIN';
      description = `🎙️ ${newState.member} đã tham gia <#${newState.channelId}>`;
      color = 0x2ecc71;
    } else if (oldState.channelId && !newState.channelId) {
      eventType = 'VOICE_LEAVE';
      description = `🔇 ${newState.member} đã rời <#${oldState.channelId}>`;
      color = 0xe74c3c;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      eventType = 'VOICE_MOVE';
      description = `🔀 ${newState.member} chuyển từ <#${oldState.channelId}> → <#${newState.channelId}>`;
      color = 0xf39c12;
    } else if (!oldState.serverMute && newState.serverMute) {
      eventType = 'VOICE_MUTE';
      description = `🔇 ${newState.member} bị server mute`;
      color = 0xe74c3c;
    } else if (oldState.serverMute && !newState.serverMute) {
      eventType = 'VOICE_MUTE';
      description = `🔊 ${newState.member} được unmute`;
      color = 0x2ecc71;
    } else if (!oldState.serverDeaf && newState.serverDeaf) {
      eventType = 'VOICE_DEAF';
      description = `🔕 ${newState.member} bị server deaf`;
      color = 0xe74c3c;
    }

    if (!eventType) return;

    const logChannel = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId: newState.guild.id, eventType } },
    });
    if (!logChannel?.enabled) return;

    const channel = kernel.client.channels.cache.get(logChannel.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder().setColor(color).setDescription(description).setTimestamp();
    await (channel as any).send({ embeds: [embed] }).catch(() => {});
  }
}

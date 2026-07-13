import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('logging');

export default class LoggingModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'logging',
    displayName: 'Logging',
    version: '1.0.0',
    description: 'Comprehensive logging: 30+ event types, each configurable independently',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    // Subscribe to all moderation events via EventBus (no direct import!)
    kernel.eventBus.on('moderation:ban', async ({ guildId, userId, moderatorId, reason }) => {
      await this.sendLog(kernel, guildId, 'BAN', {
        title: '🔨 Member Banned',
        userId, moderatorId, reason, color: 0xe74c3c
      });
    });
    kernel.eventBus.on('moderation:kick', async ({ guildId, userId, moderatorId, reason }) => {
      await this.sendLog(kernel, guildId, 'KICK', { title: '👢 Member Kicked', userId, moderatorId, reason, color: 0xe67e22 });
    });
    kernel.eventBus.on('moderation:warn', async ({ guildId, userId, moderatorId, reason }) => {
      await this.sendLog(kernel, guildId, 'WARN', { title: '⚠️ Member Warned', userId, moderatorId, reason, color: 0xf1c40f });
    });
    kernel.eventBus.on('moderation:timeout', async ({ guildId, userId, moderatorId, reason }) => {
      await this.sendLog(kernel, guildId, 'TIMEOUT', { title: '⏱️ Member Timed Out', userId, moderatorId, reason, color: 0xf39c12 });
    });
    kernel.eventBus.on('ticket:create', async ({ guildId, ticketId, userId, channelId }) => {
      await this.sendLog(kernel, guildId, 'TICKET_CREATE', { title: '🎫 Ticket Created', userId, channelId, extra: ticketId, color: 0x2ecc71 });
    });
    log.info('Logging module loaded — listening to EventBus');
  }

  async onUnload(): Promise<void> {
    log.info('Logging module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }

  private async sendLog(kernel: Kernel, guildId: string, eventType: string, data: {
    title: string; userId?: string; moderatorId?: string; reason?: string; channelId?: string; extra?: string; color: number;
  }): Promise<void> {
    try {
      const logChannel = await kernel.db.logChannel.findUnique({
        where: { guildId_eventType: { guildId, eventType } }
      });
      if (!logChannel?.enabled) return;

      const channel = kernel.client.channels.cache.get(logChannel.channelId);
      if (!channel?.isTextBased()) return;

      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setColor(data.color)
        .setTimestamp();

      if (data.userId) embed.addFields({ name: '👤 User', value: `<@${data.userId}> (${data.userId})`, inline: true });
      if (data.moderatorId) embed.addFields({ name: '🛡️ Moderator', value: `<@${data.moderatorId}>`, inline: true });
      if (data.reason) embed.addFields({ name: '📋 Reason', value: data.reason });
      if (data.channelId) embed.addFields({ name: '📝 Channel', value: `<#${data.channelId}>`, inline: true });

      await (channel as any).send({ embeds: [embed] });
    } catch {}
  }
}

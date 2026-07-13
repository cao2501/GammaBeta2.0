import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('antinuke');

interface DeleteEvent { guildId: string; type: string; moderatorId: string; timestamp: number; }

const actionLog = new Map<string, DeleteEvent[]>();

export default class AntiNukeModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'antinuke', displayName: 'Anti-Nuke', version: '1.0.0',
    description: 'Chống nuke: mass channel delete, mass role delete, mass ban, mass kick, webhook abuse, bot add',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Anti-Nuke module loaded');

    // Channel delete protection
    kernel.client.on('channelDelete', async (channel: any) => {
      if (!channel.guild) return;
      await this.handleAction(kernel, channel.guild.id, 'CHANNEL_DELETE', channel.guild);
    });

    // Role delete protection
    kernel.client.on('roleDelete', async (role: any) => {
      await this.handleAction(kernel, role.guild.id, 'ROLE_DELETE', role.guild);
    });

    // Guild ban add (mass ban detection)
    kernel.client.on('guildBanAdd', async (ban: any) => {
      await this.handleAction(kernel, ban.guild.id, 'BAN', ban.guild, ban.guild.members.cache.get(ban.user.id));
    });

    // Guild member remove (mass kick detection)
    kernel.client.on('guildMemberRemove', async (member: any) => {
      // Only track if kicked (not left)
      // We can't easily distinguish, so track all removes
      await this.handleAction(kernel, member.guild.id, 'KICK', member.guild);
    });

    // Webhook create (anti-webhook abuse)
    kernel.client.on('webhookUpdate', async (channel: any) => {
      if (!channel.guild) return;
      const config = await this.getConfig(kernel, channel.guild.id);
      if (!config.enabled || !config.antiWebhook) return;
      log.warn(`[Anti-Nuke] Webhook updated in ${channel.guild.name} #${channel.name}`);
      // Log to nuke channel
      await this.sendAlert(kernel, channel.guild.id, '🔗 Webhook Updated', `Webhook được cập nhật trong <#${channel.id}>`, channel.guild);
    });

    log.info('Anti-Nuke event listeners registered');
  }

  async onUnload(): Promise<void> { log.info('Anti-Nuke module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }

  private async getConfig(kernel: Kernel, guildId: string): Promise<any> {
    try {
      const record = await kernel.db.moduleConfig.findUnique({ where: { guildId_module: { guildId, module: 'antinuke' } } });
      if (!record) return { enabled: false };
      return { enabled: record.enabled, ...JSON.parse(record.config) };
    } catch { return { enabled: false }; }
  }

  private async handleAction(kernel: Kernel, guildId: string, type: string, guild: any, moderator?: any): Promise<void> {
    const config = await this.getConfig(kernel, guildId);
    if (!config.enabled) return;

    const key = `${guildId}:${type}`;
    const now = Date.now();
    const window = config.window ?? 10000; // 10 seconds
    const threshold = config.thresholds?.[type] ?? this.defaultThresholds(type);

    const events = (actionLog.get(key) ?? []).filter(e => now - e.timestamp < window);
    events.push({ guildId, type, moderatorId: moderator?.id ?? 'unknown', timestamp: now });
    actionLog.set(key, events);

    if (events.length >= threshold) {
      log.warn(`[Anti-Nuke] THRESHOLD REACHED: ${type} x${events.length} in ${guild.name}`);
      actionLog.delete(key); // Reset counter

      // Find who did this from audit log
      let perpetratorId: string | null = null;
      try {
        await guild.fetchAuditLogs({ limit: 5, type: this.auditType(type) }).then((audit: any) => {
          const entry = audit.entries.first();
          if (entry && now - entry.createdTimestamp < 5000) {
            perpetratorId = entry.executor?.id;
          }
        });
      } catch {}

      // Take action on perpetrator
      if (perpetratorId && perpetratorId !== guild.ownerId && config.action !== 'LOG_ONLY') {
        try {
          const member = await guild.members.fetch(perpetratorId).catch(() => null);
          if (member && !member.permissions.has(8n)) { // Not admin
            if (config.action === 'BAN' || !config.action) {
              await guild.bans.create(perpetratorId, { reason: `[Anti-Nuke] Mass ${type} detected` });
              log.warn(`[Anti-Nuke] Banned perpetrator: ${perpetratorId} for ${type}`);
            } else if (config.action === 'KICK') {
              await member.kick(`[Anti-Nuke] Mass ${type} detected`);
            } else if (config.action === 'STRIP') {
              await member.roles.set([], '[Anti-Nuke] Role stripped — mass action detected');
            }
          }
        } catch (err) {
          log.error(`[Anti-Nuke] Failed to take action on perpetrator`, { error: err });
        }
      }

      await this.sendAlert(kernel, guildId, `🚨 Nuke Detected: ${type}`,
        `**${events.length}x ${type}** trong ${window / 1000}s\n${perpetratorId ? `👤 Thủ phạm nghi vấn: <@${perpetratorId}>` : '👤 Không xác định được thủ phạm'}\n⚡ Đã thực thi: **${config.action ?? 'BAN'}**`,
        guild
      );

      // Lockdown if configured
      if (config.autoLockdown) {
        kernel.eventBus.emit('antinuke:lockdown', { guildId, reason: `Mass ${type} detected`, perpetratorId });
      }
    }
  }

  private defaultThresholds(type: string): number {
    const defaults: Record<string, number> = {
      CHANNEL_DELETE: 3, ROLE_DELETE: 3, BAN: 5, KICK: 5, WEBHOOK: 2,
    };
    return defaults[type] ?? 3;
  }

  private auditType(type: string): number {
    const map: Record<string, number> = {
      CHANNEL_DELETE: 12, ROLE_DELETE: 32, BAN: 22, KICK: 20,
    };
    return map[type] ?? 12;
  }

  private async sendAlert(kernel: Kernel, guildId: string, title: string, description: string, guild: any): Promise<void> {
    try {
      const config = await this.getConfig(kernel, guildId);
      const channelId = config.alertChannelId;
      if (!channelId) return;
      const ch = kernel.client.channels.cache.get(channelId);
      if (!ch?.isTextBased()) return;
      const { EmbedBuilder } = await import('discord.js');
      await (ch as any).send({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle(title).setDescription(description).setTimestamp()],
      });
    } catch {}
  }
}

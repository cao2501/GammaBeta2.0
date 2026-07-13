import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('scam-detection');

// Known scam domains
const SCAM_DOMAINS = [
  'discordnitro-free.com', 'discord-gift.com', 'steamgift.com', 'free-nitro.gg',
  'nitrogift.xyz', 'discordapp.gift', 'dlscord.com', 'dicsord.com',
  'steamcommunity.gift', 'csgo-skins.com', 'free-discord-nitro',
];

const SCAM_PATTERNS = [
  /free\s*nitro/i, /claim\s*your\s*nitro/i, /discord\s*gift/i,
  /steam\s*gift\s*card/i, /free\s*steam/i, /airdrop.*crypto/i,
  /click\s*here.*free/i, /you\s*won.*nitro/i,
];

export default class ScamDetectionModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'scam-detection', displayName: 'Scam Detection', version: '1.0.0',
    description: 'Phát hiện link scam, fake nitro, crypto scam, phishing links',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Scam Detection module loaded');

    kernel.client.on('messageCreate', async (message: any) => {
      if (!message.guild || message.author.bot) return;
      // Skip mods
      if (message.member?.permissions.has(8n)) return;

      const content = message.content.toLowerCase();
      let isScam = false;
      let reason = '';

      // Check scam domains
      for (const domain of SCAM_DOMAINS) {
        if (content.includes(domain)) {
          isScam = true;
          reason = `Scam domain: ${domain}`;
          break;
        }
      }

      // Check scam patterns
      if (!isScam) {
        for (const pattern of SCAM_PATTERNS) {
          if (pattern.test(message.content)) {
            isScam = true;
            reason = `Scam pattern: ${pattern.source}`;
            break;
          }
        }
      }

      if (!isScam) return;

      try {
        await message.delete();
        log.warn(`[Scam] Deleted message from ${message.author.tag}: ${reason}`);

        await message.channel.send({
          content: `⚠️ ${message.author} — Tin nhắn của bạn bị xóa vì chứa nội dung nghi ngờ lừa đảo. Nếu không cố ý, tài khoản của bạn có thể bị xâm phạm!`,
        });

        // Auto-warn
        kernel.eventBus.emit('moderation:warn', {
          guildId: message.guildId,
          userId: message.author.id,
          moderatorId: kernel.client.user!.id,
          reason: `[Auto-Scam] ${reason}`,
        });

        // Log to mod channel
        const logChannel = await kernel.db.logChannel.findUnique({
          where: { guildId_eventType: { guildId: message.guildId, eventType: 'AUTOMOD' } },
        }).catch(() => null);

        if (logChannel?.enabled) {
          const ch = kernel.client.channels.cache.get(logChannel.channelId);
          if (ch?.isTextBased()) {
            const { EmbedBuilder } = await import('discord.js');
            await (ch as any).send({
              embeds: [new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('🚨 Scam Phát Hiện')
                .addFields(
                  { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                  { name: '📝 Channel', value: `<#${message.channelId}>`, inline: true },
                  { name: '⚠️ Lý do', value: reason },
                  { name: '💬 Nội dung', value: message.content.slice(0, 500) },
                )
                .setTimestamp()
              ],
            });
          }
        }
      } catch {}
    });
  }

  async onUnload(): Promise<void> { log.info('Scam Detection module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

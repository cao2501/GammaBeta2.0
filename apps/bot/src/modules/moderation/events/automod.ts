import { Message, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig } from '../../../database/helpers';

interface AutomodConfig {
  spamDetection: { enabled: boolean; limit: number; interval: number };
  mentionSpam: { enabled: boolean; limit: number };
  inviteBlock: { enabled: boolean; whitelist: string[] };
  linkBlock: { enabled: boolean; whitelist: string[] };
  badWordFilter: { enabled: boolean; words: string[] };
  advertisementFilter: { enabled: boolean };
}

const messageTracker = new Map<string, { count: number; resetAt: number }>();

export default class AutomodMessageEvent implements IEvent<'messageCreate'> {
  name = 'messageCreate' as const;

  async execute(kernel: Kernel, message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const { enabled, config } = await getModuleConfig<AutomodConfig>(message.guildId!, 'moderation');
    if (!enabled) return;

    const automod = config as AutomodConfig;

    // Spam Detection
    if (automod.spamDetection?.enabled) {
      const key = `${message.guildId}:${message.author.id}`;
      const limit = automod.spamDetection.limit ?? 5;
      const interval = automod.spamDetection.interval ?? 5000;
      const now = Date.now();

      if (!messageTracker.has(key) || messageTracker.get(key)!.resetAt < now) {
        messageTracker.set(key, { count: 1, resetAt: now + interval });
      } else {
        messageTracker.get(key)!.count++;
        if (messageTracker.get(key)!.count > limit) {
          await this.handleViolation(kernel, message, 'SPAM', `Gửi ${messageTracker.get(key)!.count} tin nhắn trong ${interval / 1000}s`);
          messageTracker.delete(key);
          return;
        }
      }
    }

    // Mention Spam
    if (automod.mentionSpam?.enabled) {
      const limit = automod.mentionSpam.limit ?? 5;
      if (message.mentions.users.size + message.mentions.roles.size > limit) {
        await this.handleViolation(kernel, message, 'MENTION_SPAM', `Mention ${message.mentions.users.size + message.mentions.roles.size} người/role`);
        return;
      }
    }

    // Invite Block
    if (automod.inviteBlock?.enabled) {
      const inviteRegex = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[\w-]+/i;
      if (inviteRegex.test(message.content)) {
        const whitelist = automod.inviteBlock.whitelist ?? [];
        const match = message.content.match(/discord\.gg\/([\w-]+)/i);
        if (match && !whitelist.includes(match[1])) {
          await this.handleViolation(kernel, message, 'INVITE', 'Chia sẻ invite Discord');
          return;
        }
      }
    }

    // Bad Word Filter
    if (automod.badWordFilter?.enabled && automod.badWordFilter.words?.length) {
      const content = message.content.toLowerCase();
      const found = automod.badWordFilter.words.find(w => content.includes(w.toLowerCase()));
      if (found) {
        await this.handleViolation(kernel, message, 'BAD_WORD', `Từ vi phạm: ${found}`);
        return;
      }
    }
  }

  private async handleViolation(kernel: Kernel, message: Message, type: string, reason: string): Promise<void> {
    try {
      await message.delete();
    } catch {}

    kernel.eventBus.emit('moderation:automod', {
      guildId: message.guildId!,
      userId: message.author.id,
      channelId: message.channelId,
      type,
      action: 'DELETE',
    });

    const warn = await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(`⚠️ ${message.author} vi phạm AutoMod: **${type}** — ${reason}`)
      ],
    });

    setTimeout(() => warn.delete().catch(() => {}), 5000);
  }
}

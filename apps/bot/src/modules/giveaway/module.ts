import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { EmbedBuilder, ActionRowBuilder } from 'discord.js';

const log = createModuleLogger('giveaway');

export default class GiveawayModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'giveaway', displayName: 'Giveaway', version: '1.0.0',
    description: 'Timed giveaways, multiple winners, bonus entries, requirements, reroll, pause/resume',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  private activeTimers = new Map<string, NodeJS.Timeout>();
  private giveawayStartListener?: (gw: any) => void;

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Giveaway module loaded');

    // 1. Fetch active giveaways and schedule timers
    try {
      const active = await kernel.db.giveaway.findMany({ where: { status: 'ACTIVE' } });
      for (const gw of active) {
        this.scheduleGiveawayEnd(kernel, gw);
      }
    } catch (err) {
      log.error('Failed to load active giveaways on startup:', err);
    }

    // 2. Register event listener for new giveaways
    this.giveawayStartListener = (gw: any) => {
      this.scheduleGiveawayEnd(kernel, gw);
    };
    kernel.eventBus.on('giveaway:start', this.giveawayStartListener);

    // 3. Fallback minute cron job
    kernel.scheduler.schedule('giveaway:check', 'Check ended giveaways', '* * * * *', async () => {
      try {
        const ended = await kernel.db.giveaway.findMany({
          where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
        });
        for (const gw of ended) {
          await this.endGiveaway(kernel, gw);
        }
      } catch (err) {
        log.error('Error during fallback giveaway check:', err);
      }
    }, 'giveaway');
  }

  async onUnload(): Promise<void> {
    log.info('Giveaway module unloaded');
    
    // Clear start listener
    if (this.giveawayStartListener) {
      // Accessing global eventBus instance to turn listener off
      const { eventBus } = await import('../../core/eventbus/EventBus');
      eventBus.off('giveaway:start', this.giveawayStartListener);
    }

    // Clear timers
    for (const [id, timer] of this.activeTimers.entries()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }

  private scheduleGiveawayEnd(kernel: Kernel, gw: any) {
    if (this.activeTimers.has(gw.id)) {
      clearTimeout(this.activeTimers.get(gw.id)!);
      this.activeTimers.delete(gw.id);
    }

    const delay = gw.endsAt.getTime() - Date.now();
    if (delay <= 0) {
      // Already expired, end immediately in the background
      this.endGiveaway(kernel, gw);
    } else if (delay < 24 * 60 * 60 * 1000) {
      // Schedule setTimeout if under 24 hours
      const timer = setTimeout(async () => {
        await this.endGiveaway(kernel, gw);
        this.activeTimers.delete(gw.id);
      }, delay);
      this.activeTimers.set(gw.id, timer);
    }
  }

  async endGiveaway(kernel: Kernel, gw: any): Promise<void> {
    try {
      // Double check status first in case of concurrency
      const currentGw = await kernel.db.giveaway.findUnique({ where: { id: gw.id } });
      if (!currentGw || currentGw.status !== 'ACTIVE') return;

      const entries: string[] = JSON.parse(currentGw.entries ?? '[]');
      const ch = await kernel.client.channels.fetch(currentGw.channelId).catch(() => null);

      if (!entries.length) {
        await kernel.db.giveaway.update({ where: { id: currentGw.id }, data: { status: 'ENDED' } });
        if (ch?.isTextBased()) {
          await (ch as any).send(`🎉 Giveaway **${currentGw.prize}** đã kết thúc nhưng không có ai tham gia.`);
          
          // Edit original message to show ended status
          const msg = await (ch as any).messages.fetch(currentGw.messageId).catch(() => null);
          if (msg) {
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setColor(0x7f8c8d)
              .setTitle(`🎉 GIVEAWAY KẾT THÚC — ${currentGw.prize}`)
              .setDescription('Không có ai tham gia.')
              .setFields([]);
            const rows = msg.components.map(row => {
              const newRow = ActionRowBuilder.from(row as any);
              newRow.components.forEach((c: any) => c.setDisabled(true));
              return newRow;
            });
            await msg.edit({ embeds: [embed], components: rows as any }).catch(() => {});
          }
        }
        return;
      }

      // Pick winners
      const shuffled = entries.sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, Math.min(currentGw.winnerCount, entries.length));

      await kernel.db.giveaway.update({
        where: { id: currentGw.id },
        data: { status: 'ENDED', winners: JSON.stringify(winners) }
      });

      kernel.eventBus.emit('giveaway:end', { guildId: currentGw.guildId, giveawayId: currentGw.id, winners });

      if (ch?.isTextBased()) {
        const mention = winners.map((w: string) => `<@${w}>`).join(', ');
        await (ch as any).send(`🎉 **Giveaway kết thúc!**\nGiải thưởng: **${currentGw.prize}**\nNgười thắng: ${mention}`);

        // Edit original message to show ended status and winners
        const msg = await (ch as any).messages.fetch(currentGw.messageId).catch(() => null);
        if (msg) {
          const embed = EmbedBuilder.from(msg.embeds[0])
            .setColor(0x7f8c8d)
            .setTitle(`🎉 GIVEAWAY KẾT THÚC — ${currentGw.prize}`)
            .setDescription(`Giải thưởng: **${currentGw.prize}**\nNgười thắng: ${mention}`)
            .setFields([]);
          const rows = msg.components.map(row => {
            const newRow = ActionRowBuilder.from(row as any);
            newRow.components.forEach((c: any) => c.setDisabled(true));
            return newRow;
          });
          await msg.edit({ embeds: [embed], components: rows as any }).catch(() => {});
        }
      }
    } catch (err) {
      log.error('Failed to end giveaway', { error: err });
    }
  }
}

import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { EmbedBuilder, ActionRowBuilder } from 'discord.js';

const log = createModuleLogger('polls');

export default class PollsModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'polls', displayName: 'Polls', version: '1.0.0',
    description: 'Quick/Anonymous/Scheduled polls, multiple choice, auto-end',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  private activeTimers = new Map<string, NodeJS.Timeout>();
  private pollStartListener?: (poll: any) => void;

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Polls module loaded');

    // 1. Fetch active polls and schedule timers
    try {
      const active = await kernel.db.poll.findMany({ where: { status: 'ACTIVE' } });
      for (const poll of active) {
        this.schedulePollEnd(kernel, poll);
      }
    } catch (err) {
      log.error('Failed to load active polls on startup:', err);
    }

    // 2. Register event listener for new polls
    this.pollStartListener = (poll: any) => {
      this.schedulePollEnd(kernel, poll);
    };
    kernel.eventBus.on('poll:start', this.pollStartListener);

    // 3. Fallback minute cron job
    kernel.scheduler.schedule('polls:autoend', 'Auto-end polls', '* * * * *', async () => {
      try {
        const ended = await kernel.db.poll.findMany({
          where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
        });
        for (const poll of ended) {
          await this.endPoll(kernel, poll);
        }
      } catch (err) {
        log.error('Error during fallback autoend check:', err);
      }
    }, 'polls');
  }

  async onUnload(): Promise<void> {
    log.info('Polls module unloaded');

    // Clear start listener
    if (this.pollStartListener) {
      const { eventBus } = await import('../../core/eventbus/EventBus');
      eventBus.off('poll:start', this.pollStartListener);
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

  private schedulePollEnd(kernel: Kernel, poll: any) {
    if (!poll.endsAt) return; // Permanent poll

    if (this.activeTimers.has(poll.id)) {
      clearTimeout(this.activeTimers.get(poll.id)!);
      this.activeTimers.delete(poll.id);
    }

    const delay = poll.endsAt.getTime() - Date.now();
    if (delay <= 0) {
      // Already expired, end immediately
      this.endPoll(kernel, poll);
    } else if (delay < 24 * 60 * 60 * 1000) {
      // Schedule setTimeout if under 24 hours
      const timer = setTimeout(async () => {
        await this.endPoll(kernel, poll);
        this.activeTimers.delete(poll.id);
      }, delay);
      this.activeTimers.set(poll.id, timer);
    }
  }

  async endPoll(kernel: Kernel, poll: any): Promise<void> {
    try {
      // Double check status first in case of concurrency
      const currentPoll = await kernel.db.poll.findUnique({ where: { id: poll.id } });
      if (!currentPoll || currentPoll.status !== 'ACTIVE') return;

      await kernel.db.poll.update({ where: { id: currentPoll.id }, data: { status: 'ENDED' } });

      const ch = await kernel.client.channels.fetch(currentPoll.channelId).catch(() => null);
      if (ch?.isTextBased()) {
        const msg = await (ch as any).messages.fetch(currentPoll.messageId).catch(() => null);
        if (msg) {
          const votes: Record<string, string[]> = JSON.parse(currentPoll.votes ?? '{}');
          const options: string[] = JSON.parse(currentPoll.options ?? '[]');
          const total = Object.values(votes).reduce((a, b) => a + b.length, 0);
          const results = options.map((opt, i) => `${opt}: **${votes[i]?.length ?? 0}** phiếu (${total ? Math.floor((votes[i]?.length ?? 0) / total * 100) : 0}%)`).join('\n');

          let finalDesc = results;
          if (currentPoll.correctAnswer) {
            finalDesc += `\n\n🎯 **Đáp án đúng:** ${currentPoll.correctAnswer}`;
          }

          const embed = new EmbedBuilder()
            .setTitle(`📊 Kết quả Poll: ${currentPoll.question}`)
            .setColor(0x3498db)
            .setDescription(finalDesc)
            .setFooter({ text: `ID: ${currentPoll.id.slice(-6)} | Đã kết thúc` });

          // Disable components
          const rows = msg.components.map(row => {
            const newRow = ActionRowBuilder.from(row as any);
            newRow.components.forEach((c: any) => c.setDisabled(true));
            return newRow;
          });

          await msg.edit({ embeds: [embed], components: rows as any }).catch(() => {});
        }
      }
    } catch (err) {
      log.error(`Failed to end poll ${poll.id}:`, err);
    }
  }
}

import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('polls');
export default class PollsModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'polls', displayName: 'Polls', version: '1.0.0',
    description: 'Quick/Anonymous/Scheduled polls, multiple choice, auto-end',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Polls module loaded');
    kernel.scheduler.schedule('polls:autoend', 'Auto-end polls', '* * * * *', async () => {
      const ended = await kernel.db.poll.findMany({ where: { status: 'ACTIVE', endsAt: { lte: new Date() } } });
      for (const poll of ended) {
        await kernel.db.poll.update({ where: { id: poll.id }, data: { status: 'ENDED' } });
        const ch = kernel.client.channels.cache.get(poll.channelId);
        if (ch?.isTextBased()) {
          const votes: Record<string, string[]> = JSON.parse(poll.votes ?? '{}');
          const options: string[] = JSON.parse(poll.options ?? '[]');
          const total = Object.values(votes).reduce((a, b) => a + b.length, 0);
          const results = options.map((opt, i) => `${opt}: **${votes[i]?.length ?? 0}** phiếu (${total ? Math.floor((votes[i]?.length ?? 0) / total * 100) : 0}%)`).join('\n');
          const { EmbedBuilder } = await import('discord.js');
          await (ch as any).send({ embeds: [new EmbedBuilder().setTitle(`📊 Kết quả Poll: ${poll.question}`).setColor(0x3498db).setDescription(results)] });
        }
      }
    }, 'polls');
  }
  async onUnload(): Promise<void> { log.info('Polls module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('giveaway');
export default class GiveawayModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'giveaway', displayName: 'Giveaway', version: '1.0.0',
    description: 'Timed giveaways, multiple winners, bonus entries, requirements, reroll, pause/resume',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Giveaway module loaded');
    kernel.scheduler.schedule('giveaway:check', 'Check ended giveaways', '* * * * *', async () => {
      const ended = await kernel.db.giveaway.findMany({
        where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
      });
      for (const gw of ended) {
        await this.endGiveaway(kernel, gw);
      }
    }, 'giveaway');
  }
  async onUnload(): Promise<void> { log.info('Giveaway module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }

  async endGiveaway(kernel: Kernel, gw: any): Promise<void> {
    try {
      const entries: string[] = JSON.parse(gw.entries ?? '[]');
      if (!entries.length) {
        await kernel.db.giveaway.update({ where: { id: gw.id }, data: { status: 'ENDED' } });
        const ch = kernel.client.channels.cache.get(gw.channelId);
        if (ch?.isTextBased()) await (ch as any).send(`🎉 Giveaway **${gw.prize}** đã kết thúc nhưng không có ai tham gia.`);
        return;
      }
      // Pick winners
      const shuffled = entries.sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, Math.min(gw.winnerCount, entries.length));
      await kernel.db.giveaway.update({ where: { id: gw.id }, data: { status: 'ENDED', winners: JSON.stringify(winners) } });
      kernel.eventBus.emit('giveaway:end', { guildId: gw.guildId, giveawayId: gw.id, winners });
      const ch = kernel.client.channels.cache.get(gw.channelId);
      if (ch?.isTextBased()) {
        const mention = winners.map((w: string) => `<@${w}>`).join(', ');
        await (ch as any).send(`🎉 **Giveaway kết thúc!**\nGiải thưởng: **${gw.prize}**\nNgười thắng: ${mention}`);
      }
    } catch (err) { log.error('Failed to end giveaway', { error: err }); }
  }
}

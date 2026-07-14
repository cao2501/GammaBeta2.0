import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('marriage');

export default class MarriageModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'marriage',
    displayName: 'Marriage System',
    version: '1.0.0',
    description: 'Allows members to marry using shop rings, custom wedding cards, love points farming, and streaks.',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Marriage module loaded');

    // Daily schedule to check for marriage streak breaks (quá 48h không luv)
    kernel.scheduler.schedule('marriage:streak_check', 'Check marriage streak expiry', '0 0 * * *', async () => {
      try {
        const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
        // Find marriages where lastLuvAt is older than 48 hours and streak is > 1
        const expired = await kernel.db.marriage.findMany({
          where: {
            OR: [
              { lastLuvAt: { lt: cutoff } },
              { lastLuvAt: null, marriedAt: { lt: cutoff } }
            ],
            streak: { gt: 1 }
          }
        });

        for (const m of expired) {
          await kernel.db.marriage.update({
            where: { id: m.id },
            data: { streak: 1 }
          });
          log.info(`[MARRIAGE] Reset streak for marriage ${m.id} (users: ${m.user1Id} & ${m.user2Id}) due to inactivity.`);
        }
      } catch (err: any) {
        log.error(`Marriage streak check error: ${err.message}`);
      }
    }, 'marriage');
  }

  async onUnload(): Promise<void> {
    log.info('Marriage module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

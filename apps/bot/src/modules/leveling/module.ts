import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('leveling');
export default class LevelingModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'leveling', displayName: 'Leveling System', version: '1.0.0',
    description: 'XP system, rank cards, leaderboard, prestige, role rewards, voice XP, daily bonus',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Leveling module loaded');
    // Cleanup expired cooldowns
    kernel.scheduler.schedule('leveling:cleanup', 'Cleanup XP cooldowns', '*/5 * * * *', async () => {
      await kernel.db.xpCooldown.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }, 'leveling');
  }
  async onUnload(): Promise<void> { log.info('Leveling module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

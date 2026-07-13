import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('premium');
export default class PremiumModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'premium', displayName: 'Premium System', version: '1.0.0', description: 'Premium guilds, subscriptions, feature flags, license management', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Premium module loaded');
    // Check expired premium
    kernel.scheduler.schedule('premium:check', 'Check expired premium', '0 * * * *', async () => {
      await kernel.db.premiumRecord.updateMany({ where: { expiresAt: { lte: new Date() }, active: true }, data: { active: false } });
      await kernel.db.guild.updateMany({ where: { premiumRecord: { active: false } }, data: { premium: false } });
    }, 'premium');
  }
  async onUnload(): Promise<void> { log.info('Premium module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

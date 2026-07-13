import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('verification');
export default class VerificationModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'verification', displayName: 'Verification', version: '1.0.0', description: 'Button/Captcha/Math/Role/Time verification, auto-kick unverified', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Verification module loaded');
    // Auto-kick unverified
    kernel.scheduler.schedule('verification:autokick', 'Auto-kick unverified', '0 * * * *', async () => {
      const configs = await kernel.db.moduleConfig.findMany({ where: { module: 'verification', enabled: true } });
      for (const cfg of configs) {
        const c = JSON.parse(cfg.config);
        if (!c.autoKick?.enabled) continue;
        const hours = c.autoKick.hours ?? 24;
        const cutoff = new Date(Date.now() - hours * 3600000);
        const guild = kernel.client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const unverified = await kernel.db.verificationAttempt.findMany({
          where: { guildId: cfg.guildId, verified: false, createdAt: { lt: cutoff } }
        });
        for (const attempt of unverified) {
          const member = guild.members.cache.get(attempt.userId);
          await member?.kick('Auto-kick: không verify sau thời gian quy định').catch(() => {});
        }
      }
    }, 'verification');
  }
  async onUnload(): Promise<void> { log.info('Verification module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

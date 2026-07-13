import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { PermissionFlagsBits } from 'discord.js';
const log = createModuleLogger('tickets');
export default class TicketsModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'tickets', displayName: 'Ticket System', version: '1.0.0',
    description: 'Full ticket system: button/menu panels, priority, claim, transfer, transcript, auto-close',
    dependencies: [], requiredPermissions: [PermissionFlagsBits.ManageChannels], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Ticket module loaded');
    // Auto-close scheduler
    kernel.scheduler.schedule('tickets:auto_close', 'Auto-close tickets', '0 * * * *', async () => {
      const configs = await kernel.db.moduleConfig.findMany({ where: { module: 'tickets', enabled: true } });
      for (const cfg of configs) {
        const c = JSON.parse(cfg.config);
        if (!c.autoClose?.enabled) continue;
        const hours = c.autoClose.hours ?? 24;
        const cutoff = new Date(Date.now() - hours * 3600000);
        await kernel.db.ticket.updateMany({
          where: { guildId: cfg.guildId, status: 'OPEN', updatedAt: { lt: cutoff } },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }
    }, 'tickets');
  }
  async onUnload(): Promise<void> { log.info('Ticket module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('utility');
export default class UtilityModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'utility', displayName: 'Utility', version: '1.0.0',
    description: 'Avatar, banner, user/server/role info, QR, color, translate, reminders, calculator',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Utility module loaded');
    // Reminder check every minute
    kernel.scheduler.schedule('utility:reminders', 'Check reminders', '* * * * *', async () => {
      const due = await kernel.db.reminder.findMany({ where: { remindAt: { lte: new Date() }, sent: false } });
      for (const r of due) {
        try {
          const user = await kernel.client.users.fetch(r.userId).catch(() => null);
          if (user) {
            await user.send(`⏰ **Nhắc nhở:** ${r.message}`).catch(() => {});
          }
          await kernel.db.reminder.update({ where: { id: r.id }, data: { sent: true } });
        } catch {}
      }
    }, 'utility');
  }
  async onUnload(): Promise<void> { log.info('Utility module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

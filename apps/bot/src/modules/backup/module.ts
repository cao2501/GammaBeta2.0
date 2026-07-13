import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('backup');
export default class BackupModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'backup', displayName: 'Server Backup', version: '1.0.0', description: 'Backup channels, roles, emojis, permissions, config — restore anytime', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: true };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Backup module loaded'); }
  async onUnload(): Promise<void> { log.info('Backup module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

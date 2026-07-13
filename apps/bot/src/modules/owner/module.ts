import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('owner');
export default class OwnerModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'owner', displayName: 'Owner Commands', version: '1.0.0', description: 'Eval, shell, reload, restart, broadcast, maintenance mode', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Owner module loaded'); }
  async onUnload(): Promise<void> { log.info('Owner module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

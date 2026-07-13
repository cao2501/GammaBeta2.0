import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('welcome');
export default class WelcomeModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'welcome', displayName: 'Welcome & Leave', version: '1.0.0',
    description: 'Welcome/Leave messages, DM welcome, image welcome, variables, embed support',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Welcome module loaded'); }
  async onUnload(): Promise<void> { log.info('Welcome module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

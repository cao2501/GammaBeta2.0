import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('guild');

export default class GuildModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'guild',
    displayName: 'Guild Management',
    version: '1.0.0',
    description: 'Guild setup, configuration, backup, and multi-guild management',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Guild Management module loaded');
  }

  async onUnload(): Promise<void> {
    log.info('Guild Management module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

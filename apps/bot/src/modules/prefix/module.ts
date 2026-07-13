import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import PrefixHandlerEvent from './events/prefixHandler';

const log = createModuleLogger('prefix');

export default class PrefixModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'prefix',
    displayName: 'Prefix Commands',
    version: '1.0.0',
    description: 'Text prefix command system: maps !alias to slash commands (e.g. !shoplist → /shop list)',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    // Register the messageCreate event handler
    const existing = kernel.client.events.get('messageCreate') ?? [];
    if (!existing.some(e => e.constructor.name === 'PrefixHandlerEvent')) {
      existing.push(new PrefixHandlerEvent());
      kernel.client.events.set('messageCreate', existing);
    }

    log.info('Prefix Commands module loaded');
  }

  async onUnload(): Promise<void> {
    log.info('Prefix Commands module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

// Starboard Module
import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('starboard');
export default class StarboardModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'starboard', displayName: 'Starboard', version: '1.0.0', description: 'Starboard, Hall of Fame, Media Board with configurable threshold', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Starboard module loaded'); }
  async onUnload(): Promise<void> { log.info('Starboard module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

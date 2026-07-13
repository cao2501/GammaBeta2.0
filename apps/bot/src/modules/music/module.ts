import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';

const log = createModuleLogger('music');

export default class MusicModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'music', displayName: 'Music Player', version: '1.0.0',
    description: 'Music player: play, queue, skip, pause, resume, shuffle, loop, lyrics, filters',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Music module loaded'); }
  async onUnload(): Promise<void> { log.info('Music module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

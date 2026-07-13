import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('suggestions');
export default class SuggestionsModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'suggestions', displayName: 'Suggestions', version: '1.0.0', description: 'Suggestion system with voting, approval, rejection, comments', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Suggestions module loaded'); }
  async onUnload(): Promise<void> { log.info('Suggestions module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

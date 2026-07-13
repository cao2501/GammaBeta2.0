import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('reaction-roles');
export default class ReactionRolesModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'reaction-roles', displayName: 'Reaction Roles', version: '1.0.0', description: 'Normal/Unique/Toggle/Temporary reaction roles, dropdown and button roles', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Reaction Roles module loaded'); }
  async onUnload(): Promise<void> { log.info('Reaction Roles module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

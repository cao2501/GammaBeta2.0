import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { PermissionFlagsBits } from 'discord.js';
const log = createModuleLogger('temp-voice');
export default class TempVoiceModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'temp-voice', displayName: 'Temporary Voice', version: '1.0.0', description: 'Auto-create temp voice channels, rename/limit/lock/hide, transfer owner', dependencies: [], requiredPermissions: [PermissionFlagsBits.ManageChannels], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> { log.info('Temp Voice module loaded'); }
  async onUnload(): Promise<void> { log.info('Temp Voice module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

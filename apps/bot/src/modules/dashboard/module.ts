import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { ExpressServer } from './services/ExpressServer';

const log = createModuleLogger('dashboard');

export default class DashboardModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'dashboard',
    displayName: 'Web Control Panel',
    version: '1.0.0',
    description: 'Web dashboard for bot configuration and live log monitoring',
    dependencies: [],
    requiredPermissions: [],
    defaultEnabled: true,
    premium: false,
  };

  private server!: ExpressServer;

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Starting Web Dashboard...');
    this.server = new ExpressServer(kernel);
    await this.server.start();
  }

  async onUnload(): Promise<void> {
    log.info('Stopping Web Dashboard...');
    if (this.server) {
      await this.server.stop();
    }
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

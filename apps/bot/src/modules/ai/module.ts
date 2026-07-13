import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { clearConversationHistory } from './commands/ai';

const log = createModuleLogger('ai');

export default class AIModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'ai', displayName: 'AI System', version: '1.0.0', description: 'AI chat, AI moderator, AI summary, auto-reply, translate, FAQ', dependencies: [], requiredPermissions: [], defaultEnabled: false, premium: true };
  
  private kernel?: Kernel;
  private clearListener?: (data: { userId: string }) => void;

  async onLoad(kernel: Kernel): Promise<void> {
    this.kernel = kernel;
    log.info('AI module loaded');
    this.clearListener = ({ userId }) => {
      clearConversationHistory(userId);
      log.info(`Cleared AI conversation history for user ${userId}`);
    };
    kernel.eventBus.on('ai:clear_history', this.clearListener);
  }

  async onUnload(): Promise<void> {
    log.info('AI module unloaded');
    if (this.kernel && this.clearListener) {
      this.kernel.eventBus.off('ai:clear_history', this.clearListener);
    }
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }
}

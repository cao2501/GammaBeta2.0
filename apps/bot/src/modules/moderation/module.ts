import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { PermissionFlagsBits } from 'discord.js';

const log = createModuleLogger('moderation');

export default class ModerationModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'moderation',
    displayName: 'Moderation',
    version: '1.0.0',
    description: 'Complete moderation system: ban, kick, warn, timeout, purge, automod, anti-nuke',
    dependencies: [],
    requiredPermissions: [
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
    ],
    defaultEnabled: true,
    premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Moderation module loaded');
    // Auto-start raid detection scheduler
    kernel.scheduler.schedule(
      'moderation:cleanup_expired',
      'Cleanup expired mutes/bans',
      '*/10 * * * *',
      async () => {
        await this.cleanupExpiredActions(kernel);
      },
      'moderation'
    );
  }

  async onUnload(): Promise<void> {
    log.info('Moderation module unloaded');
  }

  async onReload(kernel: Kernel): Promise<void> {
    await this.onUnload();
    await this.onLoad(kernel);
  }

  private async cleanupExpiredActions(kernel: Kernel): Promise<void> {
    try {
      await kernel.db.moderationCase.updateMany({
        where: { expiresAt: { lte: new Date() }, active: true },
        data: { active: false },
      });
    } catch {}
  }
}

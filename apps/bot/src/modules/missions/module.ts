import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('missions');
export default class MissionsModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'missions', displayName: 'Daily Missions', version: '1.0.0', description: 'Daily/Weekly/Monthly/Seasonal missions, streaks, rewards, dashboard', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Missions module loaded');
    // Reset daily missions at midnight UTC
    kernel.scheduler.schedule('missions:daily_reset', 'Reset daily missions', '0 0 * * *', async () => {
      log.info('Resetting daily missions...');
      // Mark daily missions for reset
      await kernel.db.missionProgress.updateMany({
        where: { mission: { type: 'DAILY' }, completed: false, resetAt: { lte: new Date() } },
        data: { progress: 0, resetAt: new Date(Date.now() + 86400000) },
      });
    }, 'missions');
    // Reset weekly missions on Mondays
    kernel.scheduler.schedule('missions:weekly_reset', 'Reset weekly missions', '0 0 * * 1', async () => {
      await kernel.db.missionProgress.updateMany({
        where: { mission: { type: 'WEEKLY' }, resetAt: { lte: new Date() } },
        data: { progress: 0, completed: false, resetAt: new Date(Date.now() + 604800000) },
      });
    }, 'missions');
    // Listen to events for mission progress
    kernel.eventBus.on('leveling:xp_gain', async ({ guildId, userId }) => {
      await this.updateMissionProgress(kernel, guildId, userId, 'SEND_MESSAGES', 1);
    });
  }
  async onUnload(): Promise<void> { log.info('Missions module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }

  async updateMissionProgress(kernel: Kernel, guildId: string, userId: string, taskType: string, amount: number): Promise<void> {
    try {
      const missions = await kernel.db.mission.findMany({ where: { guildId, active: true, taskType } });
      for (const mission of missions) {
        const progress = await kernel.db.missionProgress.findUnique({ where: { missionId_userId: { missionId: mission.id, userId } } });
        if (progress?.completed) continue;
        const newProgress = (progress?.progress ?? 0) + amount;
        const completed = newProgress >= mission.target;
        await kernel.db.missionProgress.upsert({
          where: { missionId_userId: { missionId: mission.id, userId } },
          create: { missionId: mission.id, userId, guildId, progress: newProgress, completed, resetAt: new Date(Date.now() + 86400000) },
          update: { progress: newProgress, completed },
        });
        if (completed) {
          kernel.eventBus.emit('mission:complete', { guildId, userId, missionId: mission.id });
        } else {
          kernel.eventBus.emit('mission:progress', { guildId, userId, missionId: mission.id, progress: newProgress });
        }
      }
    } catch {}
  }
}

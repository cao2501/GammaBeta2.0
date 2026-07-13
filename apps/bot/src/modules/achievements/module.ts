import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
const log = createModuleLogger('achievements');
export default class AchievementsModule implements IModule {
  readonly manifest: ModuleManifest = { name: 'achievements', displayName: 'Achievement System', version: '1.0.0', description: 'Achievements, hidden achievements, badges, trophies, progress tracking, showcase', dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false };
  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Achievements module loaded');
    // Listen for events to award achievements
    kernel.eventBus.on('leveling:level_up', async ({ guildId, userId, newLevel }) => {
      if (newLevel >= 10) await this.awardAchievement(kernel, userId, guildId, 'level_10');
      if (newLevel >= 50) await this.awardAchievement(kernel, userId, guildId, 'level_50');
      if (newLevel >= 100) await this.awardAchievement(kernel, userId, guildId, 'level_100');
    });
    kernel.eventBus.on('economy:transaction', async ({ guildId, userId, type }) => {
      if (type === 'DAILY') await this.awardAchievement(kernel, userId, guildId, 'first_daily');
    });
    kernel.eventBus.on('mission:complete', async ({ guildId, userId }) => {
      await this.awardAchievement(kernel, userId, guildId, 'first_mission');
    });
  }
  async onUnload(): Promise<void> { log.info('Achievements module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }

  async awardAchievement(kernel: Kernel, userId: string, guildId: string, achievementName: string): Promise<void> {
    try {
      const achievement = await kernel.db.achievement.findFirst({ where: { name: achievementName } });
      if (!achievement) return;
      const existing = await kernel.db.userAchievement.findUnique({ where: { userId_achievementId: { userId, achievementId: achievement.id } } });
      if (existing) return;
      await kernel.db.userAchievement.create({ data: { userId, achievementId: achievement.id, guildId } });
      kernel.eventBus.emit('achievement:unlock', { userId, achievementId: achievement.id, guildId });
      // Notify user
      const user = await kernel.client.users.fetch(userId).catch(() => null);
      if (user) {
        const { EmbedBuilder } = await import('discord.js');
        await user.send({ embeds: [new EmbedBuilder().setTitle('🏆 Achievement Mới!').setColor(0xf1c40f).setDescription(`Bạn đã mở khóa: **${achievement.name}**\n${achievement.description}`)] }).catch(() => {});
      }
    } catch {}
  }
}

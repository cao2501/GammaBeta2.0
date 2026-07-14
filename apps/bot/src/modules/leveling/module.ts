import { IModule, ModuleManifest } from '../../core/interfaces/IModule';
import { Kernel } from '../../core/Kernel';
import { createModuleLogger } from '../../core/logger/Logger';
import { getModuleConfig, ensureMember } from '../../database/helpers';

const log = createModuleLogger('leveling');

export default class LevelingModule implements IModule {
  readonly manifest: ModuleManifest = {
    name: 'leveling', displayName: 'Leveling System', version: '1.0.0',
    description: 'XP system, rank cards, leaderboard, prestige, role rewards, voice XP, daily bonus',
    dependencies: [], requiredPermissions: [], defaultEnabled: true, premium: false,
  };

  async onLoad(kernel: Kernel): Promise<void> {
    log.info('Leveling module loaded');
    // Cleanup expired cooldowns
    kernel.scheduler.schedule('leveling:cleanup', 'Cleanup XP cooldowns', '*/5 * * * *', async () => {
      await kernel.db.xpCooldown.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }, 'leveling');

    // Award Voice XP, track active time, and emit VOICE_TICK events
    kernel.scheduler.schedule('leveling:voice_xp', 'Award Voice XP & Active Ticks', '*/1 * * * *', async () => {
      try {
        for (const guild of kernel.client.guilds.cache.values()) {
          const { enabled } = await getModuleConfig<any>(guild.id, 'leveling');
          if (!enabled) continue;

          for (const voiceState of guild.voiceStates.cache.values()) {
            const member = voiceState.member;
            if (!member || member.user.bot) continue;

            const channel = voiceState.channel;
            if (!channel || channel.id === guild.afkChannelId) continue;

            // Ignore self-deafened or server-deafened to avoid AFK farming
            if (voiceState.selfDeaf || voiceState.serverDeaf) continue;

            // Ensure member exists in database
            await ensureMember(guild.id, member.id);

            // Increment voiceXp by 3 (so 1 tick = 1 minute, voiceXp / 3 = 1)
            // Also award 10 normal leveling XP for voice activity
            const dbMember = await kernel.db.guildMember.update({
              where: { guildId_userId: { guildId: guild.id, userId: member.id } },
              data: {
                voiceXp: { increment: 3 },
                xp: { increment: 10 }
              }
            });

            // Create VOICE_TICK analytics event
            await kernel.db.analyticsEvent.create({
              data: {
                guildId: guild.id,
                userId: member.id,
                type: 'VOICE_TICK',
                data: JSON.stringify({ channelId: channel.id })
              }
            }).catch(() => {});

            // Check level up (10 XP could trigger level up)
            const newLevel = Math.floor(Math.sqrt(dbMember.xp / 100));
            if (newLevel > dbMember.level) {
              await kernel.db.guildMember.update({
                where: { guildId_userId: { guildId: guild.id, userId: member.id } },
                data: { level: newLevel }
              });

              kernel.eventBus.emit('leveling:level_up', { guildId: guild.id, userId: member.id, oldLevel: dbMember.level, newLevel });

              // Send level up message to configured channel
              const config = (await getModuleConfig<any>(guild.id, 'leveling')).config;
              const levelUpChannel = config.levelUpChannelId ? guild.channels.cache.get(config.levelUpChannelId) : null;
              if (levelUpChannel?.isTextBased()) {
                const { EmbedBuilder } = await import('discord.js');
                const embed = new EmbedBuilder()
                  .setColor(0xf1c40f)
                  .setDescription(`🎉 **${member.user.username}** đã đạt **Level ${newLevel}** từ hoạt động trò chuyện voice!`);
                await (levelUpChannel as any).send({ embeds: [embed] }).catch(() => {});
              }
            }
          }
        }
      } catch (err: any) {
        log.error(`Voice XP scheduler error: ${err.message}`);
      }
    }, 'leveling');
  }
  async onUnload(): Promise<void> { log.info('Leveling module unloaded'); }
  async onReload(kernel: Kernel): Promise<void> { await this.onUnload(); await this.onLoad(kernel); }
}

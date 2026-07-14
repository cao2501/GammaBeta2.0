import {
  ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { CardRenderer } from '../../../core/ui/CardRenderer';
import { UIBuilders } from '../../../core/ui/UIBuilders';

export default class LeaderboardCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Bảng xếp hạng server')
    .addStringOption(o => o.setName('type').setDescription('Loại bảng xếp hạng')
      .addChoices(
        { name: '⭐ XP Chat (Tất cả)', value: 'xp' },
        { name: '🎙️ Voice (Tất cả)', value: 'voice' },
        { name: '💰 Coins', value: 'coins' },
        { name: '💬 Top Chat Tuần', value: 'chat_weekly' },
        { name: '💬 Top Chat Tháng', value: 'chat_monthly' },
        { name: '🎙️ Top Voice Tuần', value: 'voice_weekly' },
        { name: '🎙️ Top Voice Tháng', value: 'voice_monthly' },
      )
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const type = interaction.options.getString('type') ?? 'xp';
    const guildId = interaction.guildId!;

    let resolvedMembers: Array<{ username: string; avatarUrl: string; value: number; level?: number }> = [];
    let callerRankData: { rank: number; username: string; avatarUrl: string; value: number; level?: number } | null = null;

    const isTimeScoped = ['chat_weekly', 'chat_monthly', 'voice_weekly', 'voice_monthly'].includes(type);

    if (isTimeScoped) {
      // ─── TIME SCOPED LEADERBOARDS (using AnalyticsEvent) ───────────────────
      const eventType = type.startsWith('chat') ? 'MESSAGE' : 'VOICE_TICK';
      const days = type.endsWith('weekly') ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      // 1. Query Top 10 users by event count
      const groups = await kernel.db.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          guildId,
          type: eventType,
          userId: { not: null },
          createdAt: { gte: since },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      if (!groups.length) {
        return void interaction.editReply({
          embeds: [UIBuilders.createErrorEmbed('Lỗi Bảng Xếp Hạng', 'Chưa có dữ liệu bảng xếp hạng cho khoảng thời gian này.')]
        });
      }

      // 2. Resolve usernames & avatars
      resolvedMembers = await Promise.all(groups.map(async (g) => {
        const uId = g.userId!;
        const user = await kernel.client.users.fetch(uId).catch(() => null);
        return {
          username: user?.username ?? `User_${uId.slice(-4)}`,
          avatarUrl: user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
          value: g._count.id,
        };
      }));

      // 3. Resolve caller's rank
      const callerCount = await kernel.db.analyticsEvent.count({
        where: {
          guildId,
          userId: interaction.user.id,
          type: eventType,
          createdAt: { gte: since },
        },
      });

      const allCounts = await kernel.db.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          guildId,
          type: eventType,
          userId: { not: null },
          createdAt: { gte: since },
        },
        _count: {
          id: true,
        },
      });

      const rankNum = allCounts.filter(u => u._count.id > callerCount).length + 1;

      callerRankData = {
        rank: rankNum,
        username: interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
        value: callerCount,
      };

    } else {
      // ─── ALL-TIME LEADERBOARDS (using GuildMember) ────────────────────────
      const orderBy = type === 'coins' ? { balance: 'desc' as const } :
                      type === 'voice' ? { voiceXp: 'desc' as const } : { xp: 'desc' as const };

      const members = await kernel.db.guildMember.findMany({
        where: { guildId },
        orderBy,
        take: 10,
      });

      if (!members.length) {
        return void interaction.editReply({
          embeds: [UIBuilders.createErrorEmbed('Lỗi Bảng Xếp Hạng', 'Chưa có dữ liệu bảng xếp hạng.')]
        });
      }

      resolvedMembers = await Promise.all(members.map(async (m) => {
        const user = await kernel.client.users.fetch(m.userId).catch(() => null);
        const rawVal = type === 'coins' ? m.balance : type === 'voice' ? m.voiceXp : m.xp;
        // For all-time voice, convert voiceXp back to minutes (voiceXp / 3)
        const value = type === 'voice' ? Math.floor(rawVal / 3) : rawVal;

        return {
          username: user?.username ?? `User_${m.userId.slice(-4)}`,
          avatarUrl: user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png',
          value,
          level: type === 'xp' ? m.level : undefined,
        };
      }));

      const callerMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: interaction.user.id } },
      });

      if (callerMember) {
        const rawScore = type === 'coins' ? callerMember.balance : type === 'voice' ? callerMember.voiceXp : callerMember.xp;
        const targetScore = type === 'voice' ? Math.floor(rawScore / 3) : rawScore;
        const rankCountField = type === 'coins' ? 'balance' : type === 'voice' ? 'voiceXp' : 'xp';

        const rankNum = await kernel.db.guildMember.count({
          where: {
            guildId,
            [rankCountField]: { gt: rawScore },
          },
        }) + 1;

        callerRankData = {
          rank: rankNum,
          username: interaction.user.username,
          avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
          value: targetScore,
          level: type === 'xp' ? callerMember.level : undefined,
        };
      }
    }

    try {
      const buffer = await CardRenderer.drawLeaderboardCard(
        interaction.guild!.name,
        type,
        resolvedMembers,
        callerRankData
      );
      const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
      await interaction.editReply({ files: [attachment] });
    } catch (err: any) {
      await interaction.editReply({
        embeds: [UIBuilders.createErrorEmbed('Lỗi Tạo Bảng Xếp Hạng', err.message)]
      });
    }
  }
}

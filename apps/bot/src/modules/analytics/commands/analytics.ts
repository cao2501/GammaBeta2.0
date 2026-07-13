import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class AnalyticsCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('📊 Thống kê server')
    .addSubcommand(s => s.setName('overview').setDescription('Tổng quan hoạt động server'))
    .addSubcommand(s => s.setName('messages').setDescription('Thống kê tin nhắn 7 ngày gần nhất'))
    .addSubcommand(s => s.setName('members').setDescription('Thống kê thành viên'))
    .addSubcommand(s => s.setName('top').setDescription('Top thành viên hoạt động'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'overview') {
      const now = new Date();
      const day7 = new Date(now.getTime() - 7 * 86400000);
      const day30 = new Date(now.getTime() - 30 * 86400000);

      const [msgToday, msg7d, msg30d, totalMembers, activeMembers] = await Promise.all([
        kernel.db.analyticsEvent.count({ where: { guildId, type: 'MESSAGE', createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } } }),
        kernel.db.analyticsEvent.count({ where: { guildId, type: 'MESSAGE', createdAt: { gte: day7 } } }),
        kernel.db.analyticsEvent.count({ where: { guildId, type: 'MESSAGE', createdAt: { gte: day30 } } }),
        kernel.db.guildMember.count({ where: { guildId } }),
        kernel.db.guildMember.count({ where: { guildId, xp: { gt: 0 } } }),
      ]);

      const guild = interaction.guild!;
      await guild.fetch();

      const embed = new EmbedBuilder()
        .setTitle(`📊 Analytics — ${guild.name}`)
        .setColor(0x3498db)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '💬 Tin nhắn hôm nay', value: `${msgToday.toLocaleString()}`, inline: true },
          { name: '💬 Tin nhắn 7 ngày', value: `${msg7d.toLocaleString()}`, inline: true },
          { name: '💬 Tin nhắn 30 ngày', value: `${msg30d.toLocaleString()}`, inline: true },
          { name: '👥 Thành viên Discord', value: `${guild.memberCount.toLocaleString()}`, inline: true },
          { name: '👥 Thành viên DB', value: `${totalMembers.toLocaleString()}`, inline: true },
          { name: '⚡ Thành viên hoạt động', value: `${activeMembers.toLocaleString()}`, inline: true },
          { name: '📊 TB tin nhắn/ngày', value: `${Math.floor(msg7d / 7).toLocaleString()}`, inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'top') {
      const topByXp = await kernel.db.guildMember.findMany({
        where: { guildId },
        orderBy: { xp: 'desc' },
        take: 5,
      });

      const topByBalance = await kernel.db.guildMember.findMany({
        where: { guildId },
        orderBy: { balance: 'desc' },
        take: 5,
      });

      const embed = new EmbedBuilder()
        .setTitle('🏆 Top Thành Viên')
        .setColor(0xf1c40f)
        .addFields(
          {
            name: '⭐ Top XP',
            value: topByXp.map((m, i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} <@${m.userId}> — **${m.xp.toLocaleString()} XP** (Lv.${m.level})`).join('\n') || 'Chưa có dữ liệu.',
            inline: false,
          },
          {
            name: '💰 Top Giàu',
            value: topByBalance.map((m, i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} <@${m.userId}> — **${m.balance.toLocaleString()} coins**`).join('\n') || 'Chưa có dữ liệu.',
            inline: false,
          },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'members') {
      const guild = interaction.guild!;
      await guild.members.fetch();
      const bots = guild.members.cache.filter(m => m.user.bot).size;
      const humans = guild.memberCount - bots;

      const newMembers = guild.members.cache.filter(m =>
        !m.user.bot && m.joinedTimestamp !== null && m.joinedTimestamp > Date.now() - 7 * 86400000
      ).size;

      const embed = new EmbedBuilder()
        .setTitle('👥 Thống Kê Thành Viên')
        .setColor(0x2ecc71)
        .addFields(
          { name: '👥 Tổng thành viên', value: `${guild.memberCount.toLocaleString()}`, inline: true },
          { name: '👤 Người dùng', value: `${humans.toLocaleString()}`, inline: true },
          { name: '🤖 Bots', value: `${bots.toLocaleString()}`, inline: true },
          { name: '🆕 Mới 7 ngày', value: `${newMembers.toLocaleString()}`, inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'messages') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const count = await kernel.db.analyticsEvent.count({ where: { guildId, type: 'MESSAGE', createdAt: { gte: start, lte: end } } });
        days.push({ date: start.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric' }), count });
      }

      const max = Math.max(...days.map(d => d.count), 1);
      const chart = days.map(d => {
        const bars = Math.round(d.count / max * 10);
        return `\`${d.date.padEnd(12)}\` ${'█'.repeat(bars)}${'░'.repeat(10 - bars)} **${d.count}**`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('💬 Tin Nhắn 7 Ngày Qua')
        .setColor(0x3498db)
        .setDescription(chart)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  }
}

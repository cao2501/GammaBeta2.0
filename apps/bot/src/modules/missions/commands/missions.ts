import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class MissionsCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('missions')
    .setDescription('📋 Hệ thống Nhiệm Vụ')
    .addSubcommand(s => s.setName('list').setDescription('Xem nhiệm vụ của bạn'))
    .addSubcommand(s => s.setName('claim').setDescription('Nhận phần thưởng nhiệm vụ').addStringOption(o => o.setName('id').setDescription('Mission ID').setRequired(true)))
    .addSubcommand(s => s.setName('streak').setDescription('Xem chuỗi nhiệm vụ của bạn'))
    .addSubcommand(s => s.setName('create').setDescription('[Admin] Tạo nhiệm vụ mới')
      .addStringOption(o => o.setName('name').setDescription('Tên').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Loại').setRequired(true).addChoices({ name: 'Hàng ngày', value: 'DAILY' }, { name: 'Hàng tuần', value: 'WEEKLY' }, { name: 'Hàng tháng', value: 'MONTHLY' }))
      .addStringOption(o => o.setName('task').setDescription('Loại nhiệm vụ').setRequired(true).addChoices(
        { name: 'Gửi tin nhắn', value: 'SEND_MESSAGES' },
        { name: 'Tham gia voice', value: 'VOICE_TIME' },
        { name: 'Mời người', value: 'INVITE' },
        { name: 'Nhận reaction', value: 'GET_REACTION' },
        { name: 'Dùng lệnh bot', value: 'USE_COMMANDS' },
      ))
      .addIntegerOption(o => o.setName('target').setDescription('Mục tiêu (số lượng)').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('rewards').setDescription('Phần thưởng JSON (vd: {"xp":100,"coins":50})'))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const missions = await kernel.db.mission.findMany({ where: { guildId, active: true }, take: 10 });
      if (!missions.length) return void interaction.editReply('📋 Chưa có nhiệm vụ nào. Admin dùng `/missions create` để tạo.');

      const progressList = await kernel.db.missionProgress.findMany({
        where: { userId, missionId: { in: missions.map(m => m.id) } }
      });

      const lines = missions.map(m => {
        const p = progressList.find(pl => pl.missionId === m.id);
        const progress = p?.progress ?? 0;
        const bar = `[${'█'.repeat(Math.floor(progress / m.target * 10))}${'░'.repeat(10 - Math.floor(progress / m.target * 10))}]`;
        const icon = p?.completed ? '✅' : '📋';
        return `${icon} **${m.name}** (${m.type})\n${bar} ${progress}/${m.target} ${p?.completed && !p.claimedAt ? ' — **Sẵn sàng nhận thưởng!**' : ''}`;
      });

      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📋 Nhiệm Vụ Của Bạn').setColor(0x5865f2).setDescription(lines.join('\n\n')).setTimestamp()] });
    } else if (sub === 'claim') {
      const id = interaction.options.getString('id', true);
      const mission = await kernel.db.mission.findFirst({ where: { guildId, id: { endsWith: id } } });
      if (!mission) return void interaction.reply({ content: '❌ Không tìm thấy nhiệm vụ.', ephemeral: true });
      const progress = await kernel.db.missionProgress.findUnique({ where: { missionId_userId: { missionId: mission.id, userId } } });
      if (!progress?.completed) return void interaction.reply({ content: '❌ Bạn chưa hoàn thành nhiệm vụ này.', ephemeral: true });
      if (progress.claimedAt) return void interaction.reply({ content: '❌ Bạn đã nhận thưởng rồi.', ephemeral: true });
      await kernel.db.missionProgress.update({ where: { missionId_userId: { missionId: mission.id, userId } }, data: { claimedAt: new Date() } });
      const rewards = JSON.parse(mission.rewards ?? '{}');
      if (rewards.coins) await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: rewards.coins } } });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🎁 Nhận Thưởng Thành Công!').setDescription(`Nhiệm vụ: **${mission.name}**\n${rewards.coins ? `💰 +${rewards.coins} coins` : ''}\n${rewards.xp ? `⭐ +${rewards.xp} XP` : ''}`)] });
    } else if (sub === 'streak') {
      const streak = await kernel.db.dailyStreak.findUnique({ where: { guildId_userId: { guildId, userId } } });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🔥 Chuỗi Nhiệm Vụ').addFields({ name: '🔥 Streak hiện tại', value: `${streak?.streak ?? 0} ngày`, inline: true }, { name: '🏆 Streak cao nhất', value: `${streak?.maxStreak ?? 0} ngày`, inline: true })] });
    } else if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      await ensureGuild(guildId, interaction.guild!.name);
      const name = interaction.options.getString('name', true);
      const type = interaction.options.getString('type', true);
      const taskType = interaction.options.getString('task', true);
      const target = interaction.options.getInteger('target', true);
      const rewards = interaction.options.getString('rewards') ?? '{"coins":100}';
      const mission = await kernel.db.mission.create({
        data: { guildId, name, description: name, type, taskType, target, rewards },
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Nhiệm Vụ Đã Tạo').addFields({ name: '📋 Tên', value: name, inline: true }, { name: '🔄 Loại', value: type, inline: true }, { name: '🎯 Mục tiêu', value: `${target} ${taskType}`, inline: true }, { name: '🆔 ID', value: `\`${mission.id.slice(-8)}\`` })] });
    }
  }
}

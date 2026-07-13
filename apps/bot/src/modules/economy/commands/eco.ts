import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureMember } from '../../../database/helpers';

const DAILY_AMOUNT = 200;
const WEEKLY_AMOUNT = 1000;
const WORK_JOBS = [
  { name: 'lập trình viên', min: 100, max: 300 },
  { name: 'bác sĩ', min: 150, max: 400 },
  { name: 'giáo viên', min: 80, max: 200 },
  { name: 'thợ xây', min: 50, max: 150 },
  { name: 'đầu bếp', min: 70, max: 180 },
];

export default class EconomyCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('eco')
    .setDescription('💰 Hệ thống kinh tế')
    .addSubcommand(s => s.setName('balance').setDescription('💰 Xem số dư').addUserOption(o => o.setName('user').setDescription('Người dùng khác')))
    .addSubcommand(s => s.setName('daily').setDescription('📅 Nhận tiền hàng ngày'))
    .addSubcommand(s => s.setName('weekly').setDescription('📅 Nhận tiền hàng tuần'))
    .addSubcommand(s => s.setName('work').setDescription('💼 Đi làm kiếm tiền'))
    .addSubcommand(s => s.setName('crime').setDescription('🦹 Phạm tội (rủi ro cao)'))
    .addSubcommand(s => s.setName('rob').setDescription('🔫 Cướp tiền người khác').addUserOption(o => o.setName('user').setDescription('Nạn nhân').setRequired(true)))
    .addSubcommand(s => s.setName('transfer').setDescription('💸 Chuyển tiền').addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Số tiền').setRequired(true).setMinValue(1)));

  private cooldowns = new Map<string, Map<string, number>>();

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    await ensureMember(guildId, userId);

    if (sub === 'balance') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      await ensureMember(guildId, target.id);
      const member = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: target.id } } });
      const embed = new EmbedBuilder()
        .setTitle(`💰 Số dư — ${target.username}`)
        .setColor(0xf1c40f)
        .addFields(
          { name: '👛 Ví', value: `💰 ${(member?.balance ?? 0).toLocaleString()} coins`, inline: true },
          { name: '🏦 Ngân hàng', value: `💰 ${(member?.bank ?? 0).toLocaleString()} coins`, inline: true },
        )
        .setTimestamp();
      return void interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'daily' || sub === 'weekly') {
      const cooldown = sub === 'daily' ? 86400000 : 604800000;
      const amount = sub === 'daily' ? DAILY_AMOUNT : WEEKLY_AMOUNT;
      const key = `${sub}:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);
      if (last && Date.now() - last < cooldown) {
        const remaining = Math.ceil((last + cooldown - Date.now()) / 3600000);
        return void interaction.editReply(`⏱️ Bạn đã nhận ${sub}! Còn **${remaining}h** nữa.`);
      }
      kernel.cache.set(key, Date.now(), cooldown / 1000);
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: amount } } });
      kernel.eventBus.emit('economy:transaction', { guildId, userId, amount, type: sub.toUpperCase() });
      return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ Bạn nhận được **${amount.toLocaleString()} coins** ${sub === 'daily' ? 'hàng ngày' : 'hàng tuần'}!`)] });
    }

    if (sub === 'work') {
      const key = `work:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);
      if (last && Date.now() - last < 3600000) {
        return void interaction.editReply('⏱️ Bạn vừa làm việc! Nghỉ ngơi 1 giờ đã.');
      }
      const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)]!;
      const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
      kernel.cache.set(key, Date.now(), 3600);
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: earned } } });
      return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`💼 Bạn làm việc với tư cách **${job.name}** và kiếm được **${earned} coins**!`)] });
    }

    if (sub === 'crime') {
      const key = `crime:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);
      if (last && Date.now() - last < 7200000) return void interaction.editReply('⏱️ Hãy để cảnh sát nguội bớt đã!');
      kernel.cache.set(key, Date.now(), 7200);
      const success = Math.random() > 0.4;
      if (success) {
        const amount = Math.floor(Math.random() * 500) + 100;
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: amount } } });
        return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🦹 Thành công! Bạn kiếm được **${amount} coins** từ... hoạt động tối tăm.`)] });
      } else {
        const fine = Math.floor(Math.random() * 200) + 50;
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { decrement: fine } } });
        return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🚔 Bạn bị bắt! Phạt **${fine} coins**.`)] });
      }
    }

    if (sub === 'transfer') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      if (target.id === userId) return void interaction.editReply('❌ Không thể tự chuyển tiền cho mình.');
      const sender = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId } } });
      if (!sender || sender.balance < amount) return void interaction.editReply('❌ Không đủ tiền!');
      await ensureMember(guildId, target.id);
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { decrement: amount } } });
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId: target.id } }, data: { balance: { increment: amount } } });
      return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`💸 Đã chuyển **${amount.toLocaleString()} coins** cho ${target}!`)] });
    }

    if (sub === 'rob') {
      const target = interaction.options.getUser('user', true);
      if (target.id === userId) return void interaction.editReply('❌ Không thể cướp chính mình.');
      const key = `rob:${guildId}:${userId}`;
      const last = kernel.cache.get<number>(key);
      if (last && Date.now() - last < 14400000) return void interaction.editReply('⏱️ Còn 4h nữa mới được cướp.');
      kernel.cache.set(key, Date.now(), 14400);
      await ensureMember(guildId, target.id);
      const victim = await kernel.db.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: target.id } } });
      if (!victim || victim.balance < 100) return void interaction.editReply('❌ Nạn nhân quá nghèo!');
      const success = Math.random() > 0.5;
      if (success) {
        const stolen = Math.floor(victim.balance * (Math.random() * 0.3 + 0.1));
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId: target.id } }, data: { balance: { decrement: stolen } } });
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { increment: stolen } } });
        return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🔫 Cướp thành công! Lấy được **${stolen} coins** từ ${target}!`)] });
      } else {
        const fine = Math.floor(victim.balance * 0.1);
        await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId } }, data: { balance: { decrement: fine } } });
        return void interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`🚔 Cướp thất bại! Bị phạt **${fine} coins**.`)] });
      }
    }
  }
}

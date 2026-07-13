import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class AchievementsCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏆 Hệ thống Achievement')
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách achievements của bạn').addUserOption(o => o.setName('user').setDescription('Người dùng khác')))
    .addSubcommand(s => s.setName('all').setDescription('Xem tất cả achievements trong server'))
    .addSubcommand(s => s.setName('create').setDescription('[Admin] Tạo achievement mới')
      .addStringOption(o => o.setName('name').setDescription('Tên achievement').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Mô tả').setRequired(true))
      .addStringOption(o => o.setName('icon').setDescription('Emoji icon').setRequired(true))
      .addBooleanOption(o => o.setName('hidden').setDescription('Hidden (ẩn cho đến khi mở khóa)'))
    )
    .addSubcommand(s => s.setName('award').setDescription('[Admin] Trao achievement cho thành viên')
      .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Tên achievement').setRequired(true))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user') ?? interaction.user;
      const unlocked = await kernel.db.userAchievement.findMany({
        where: { userId: target.id },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Achievements — ${target.username}`)
        .setColor(0xf1c40f)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(
          unlocked.length
            ? unlocked.map(ua => `${ua.achievement.icon} **${ua.achievement.name}**\n*${ua.achievement.description}* — <t:${Math.floor(ua.unlockedAt.getTime() / 1000)}:R>`).join('\n\n')
            : 'Chưa mở khóa achievement nào.'
        )
        .setFooter({ text: `${unlocked.length} achievements đã mở khóa` });

      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'all') {
      await interaction.deferReply({ ephemeral: true });
      const allAchievements = await kernel.db.achievement.findMany({ orderBy: { name: 'asc' } });
      const myUnlocked = await kernel.db.userAchievement.findMany({ where: { userId: interaction.user.id } });
      const unlockedIds = new Set(myUnlocked.map(ua => ua.achievementId));

      const embed = new EmbedBuilder()
        .setTitle('🏆 Tất Cả Achievements')
        .setColor(0xf1c40f)
        .setDescription(
          allAchievements.length
            ? allAchievements.map(a => {
              const unlocked = unlockedIds.has(a.id);
              if (a.hidden && !unlocked) return `❓ **???** — *Hidden Achievement*`;
              return `${unlocked ? '✅' : '⬜'} ${a.icon} **${a.name}** — ${a.description}`;
            }).join('\n')
            : 'Chưa có achievement nào.'
        )
        .setFooter({ text: `${unlockedIds.size}/${allAchievements.length} đã mở khóa` });

      await interaction.editReply({ embeds: [embed] });

    } else if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const name = interaction.options.getString('name', true);
      const description = interaction.options.getString('description', true);
      const icon = interaction.options.getString('icon', true);
      const hidden = interaction.options.getBoolean('hidden') ?? false;

      const existing = await kernel.db.achievement.findFirst({ where: { name } });
      if (existing) return void interaction.reply({ content: `❌ Achievement **${name}** đã tồn tại.`, ephemeral: true });

      const achievement = await kernel.db.achievement.create({
        data: { name, description, icon, hidden },
      });

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Achievement Đã Tạo').addFields({ name: '🏆 Tên', value: name, inline: true }, { name: '🎯 Icon', value: icon, inline: true }, { name: '🔒 Hidden', value: hidden ? 'Có' : 'Không', inline: true }, { name: '📋 Mô tả', value: description }, { name: '🆔 ID', value: `\`${achievement.id.slice(-8)}\`` })] });

    } else if (sub === 'award') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const target = interaction.options.getUser('user', true);
      const name = interaction.options.getString('name', true);

      const achievement = await kernel.db.achievement.findFirst({ where: { name } });
      if (!achievement) return void interaction.reply({ content: `❌ Không tìm thấy achievement **${name}**.`, ephemeral: true });

      const existing = await kernel.db.userAchievement.findUnique({
        where: { userId_achievementId: { userId: target.id, achievementId: achievement.id } }
      });
      if (existing) return void interaction.reply({ content: `❌ ${target.username} đã có achievement này rồi.`, ephemeral: true });

      await kernel.db.userAchievement.create({
        data: { userId: target.id, achievementId: achievement.id, guildId }
      });

      // Notify user
      await target.send({ embeds: [new EmbedBuilder().setTitle('🏆 Achievement Mới!').setColor(0xf1c40f).setDescription(`${achievement.icon} **${achievement.name}**\n${achievement.description}\n\nTrao bởi admin tại **${interaction.guild!.name}**`)] }).catch(() => {});

      await interaction.reply({ content: `✅ Đã trao achievement **${achievement.icon} ${achievement.name}** cho ${target}!`, ephemeral: true });
    }
  }
}

import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { setModuleConfig, getModuleConfig } from '../../../database/helpers';

export default class LevelingConfigCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('leveling')
    .setDescription('⭐ Cấu hình hệ thống leveling')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('Cấu hình leveling')
      .addChannelOption(o => o.setName('levelup_channel').setDescription('Kênh thông báo level up'))
      .addIntegerOption(o => o.setName('cooldown').setDescription('Cooldown giữa XP (giây, mặc định: 60)').setMinValue(10).setMaxValue(3600))
      .addBooleanOption(o => o.setName('enabled').setDescription('Bật/Tắt leveling'))
    )
    .addSubcommand(s => s.setName('addrole').setDescription('Thêm role reward cho level')
      .addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('role').setDescription('Role thưởng').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Loại').addChoices({ name: 'Thêm role', value: 'ADD' }, { name: 'Xóa role', value: 'REMOVE' }))
    )
    .addSubcommand(s => s.setName('removerole').setDescription('Xóa role reward')
      .addIntegerOption(o => o.setName('level').setDescription('Level').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand(s => s.setName('setxp').setDescription('Set XP cho thành viên')
      .addUserOption(o => o.setName('user').setDescription('Người dùng').setRequired(true))
      .addIntegerOption(o => o.setName('xp').setDescription('XP mới').setRequired(true).setMinValue(0))
    )
    .addSubcommand(s => s.setName('resetxp').setDescription('Reset XP thành viên')
      .addUserOption(o => o.setName('user').setDescription('Người dùng').setRequired(true))
    )
    .addSubcommand(s => s.setName('roleinfo').setDescription('Xem danh sách role rewards'))
    .addSubcommand(s => s.setName('info').setDescription('Xem cấu hình leveling hiện tại'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'setup') {
      const levelUpChannel = interaction.options.getChannel('levelup_channel');
      const cooldown = interaction.options.getInteger('cooldown');
      const enabled = interaction.options.getBoolean('enabled');
      const updates: Record<string, any> = {};
      if (levelUpChannel) updates.levelUpChannelId = levelUpChannel.id;
      if (cooldown !== null) updates.cooldown = cooldown;
      if (enabled !== null) updates.enabled = enabled;
      await setModuleConfig(guildId, 'leveling', updates);
      await interaction.reply({
        content: `✅ Cấu hình leveling đã cập nhật!\n${levelUpChannel ? `📝 Level-up channel: <#${levelUpChannel.id}>` : ''}\n${cooldown ? `⏱️ Cooldown: ${cooldown}s` : ''}`,
        ephemeral: true,
      });

    } else if (sub === 'addrole') {
      const level = interaction.options.getInteger('level', true);
      const role = interaction.options.getRole('role', true);
      const type = interaction.options.getString('type') ?? 'ADD';
      await kernel.db.levelRole.upsert({
        where: { guildId_level_roleId: { guildId, level, roleId: role.id } },
        create: { guildId, level, roleId: role.id, type },
        update: { type },
      });
      await interaction.reply({ content: `✅ Level **${level}** → ${type === 'ADD' ? 'Thêm' : 'Xóa'} role ${role}.`, ephemeral: true });

    } else if (sub === 'removerole') {
      const level = interaction.options.getInteger('level', true);
      const role = interaction.options.getRole('role', true);
      await kernel.db.levelRole.deleteMany({ where: { guildId, level, roleId: role.id } });
      await interaction.reply({ content: `✅ Đã xóa role reward level **${level}**.`, ephemeral: true });

    } else if (sub === 'setxp') {
      const target = interaction.options.getUser('user', true);
      const xp = interaction.options.getInteger('xp', true);
      const newLevel = Math.floor(Math.sqrt(xp / 100));
      await kernel.db.guildMember.upsert({
        where: { guildId_userId: { guildId, userId: target.id } },
        create: { guildId, userId: target.id, xp, level: newLevel },
        update: { xp, level: newLevel },
      });
      await interaction.reply({ content: `✅ Set XP của **${target.username}** thành **${xp} XP** (Level ${newLevel}).`, ephemeral: true });

    } else if (sub === 'resetxp') {
      const target = interaction.options.getUser('user', true);
      await kernel.db.guildMember.update({ where: { guildId_userId: { guildId, userId: target.id } }, data: { xp: 0, level: 0 } }).catch(() => {});
      await interaction.reply({ content: `✅ Đã reset XP của **${target.username}**.`, ephemeral: true });

    } else if (sub === 'roleinfo') {
      const roles = await kernel.db.levelRole.findMany({ where: { guildId }, orderBy: { level: 'asc' } });
      const embed = new EmbedBuilder().setTitle('⭐ Role Rewards').setColor(0xf1c40f)
        .setDescription(roles.length ? roles.map(r => `Level **${r.level}**: ${r.type === 'ADD' ? '✅ Thêm' : '❌ Xóa'} <@&${r.roleId}>`).join('\n') : 'Chưa có role reward nào.');
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'info') {
      const { enabled, config } = await getModuleConfig<any>(guildId, 'leveling');
      const embed = new EmbedBuilder().setTitle('⭐ Cấu Hình Leveling').setColor(0xf1c40f)
        .addFields(
          { name: '🔘 Trạng thái', value: enabled ? '🟢 Bật' : '🔴 Tắt', inline: true },
          { name: '⏱️ Cooldown', value: `${config.cooldown ?? 60}s`, inline: true },
          { name: '📝 Level-up Channel', value: config.levelUpChannelId ? `<#${config.levelUpChannelId}>` : 'Kênh hiện tại', inline: true },
          { name: '📏 XP/tin nhắn', value: '15-25 XP', inline: true },
          { name: '🧮 Formula', value: '`level = floor(sqrt(xp / 100))`', inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

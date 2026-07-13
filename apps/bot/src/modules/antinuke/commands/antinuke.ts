import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { setModuleConfig, getModuleConfig } from '../../../database/helpers';

export default class AntiNukeCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('🛡️ Hệ thống Anti-Nuke')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('enable').setDescription('Bật Anti-Nuke'))
    .addSubcommand(s => s.setName('disable').setDescription('Tắt Anti-Nuke'))
    .addSubcommand(s => s.setName('config').setDescription('Cấu hình Anti-Nuke')
      .addChannelOption(o => o.setName('alert_channel').setDescription('Kênh nhận cảnh báo').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Hành động khi phát hiện nuke').addChoices(
        { name: '🔨 Ban (mặc định)', value: 'BAN' },
        { name: '👢 Kick', value: 'KICK' },
        { name: '⛔ Strip Roles', value: 'STRIP' },
        { name: '📋 Chỉ log', value: 'LOG_ONLY' },
      ))
      .addIntegerOption(o => o.setName('channel_delete_threshold').setDescription('Số channel xóa/10s để kích hoạt (mặc định: 3)').setMinValue(1).setMaxValue(20))
      .addIntegerOption(o => o.setName('role_delete_threshold').setDescription('Số role xóa/10s (mặc định: 3)').setMinValue(1).setMaxValue(20))
      .addIntegerOption(o => o.setName('ban_threshold').setDescription('Số ban/10s (mặc định: 5)').setMinValue(1).setMaxValue(30))
      .addBooleanOption(o => o.setName('auto_lockdown').setDescription('Tự động lockdown khi phát hiện nuke'))
      .addBooleanOption(o => o.setName('anti_webhook').setDescription('Cảnh báo khi có webhook mới'))
    )
    .addSubcommand(s => s.setName('whitelist').setDescription('Whitelist user hoặc role (không bị anti-nuke)')
      .addUserOption(o => o.setName('user').setDescription('User'))
      .addRoleOption(o => o.setName('role').setDescription('Role'))
    )
    .addSubcommand(s => s.setName('info').setDescription('Xem cấu hình Anti-Nuke'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      await setModuleConfig(guildId, 'antinuke', { enabled: true });
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🛡️ Anti-Nuke BẬT').setDescription('Server đang được bảo vệ.\nDùng `/antinuke config` để cấu hình chi tiết.')],
        ephemeral: true,
      });

    } else if (sub === 'disable') {
      await setModuleConfig(guildId, 'antinuke', { enabled: false });
      await interaction.reply({ content: '⚠️ Anti-Nuke đã **TẮT**.', ephemeral: true });

    } else if (sub === 'config') {
      const alertChannel = interaction.options.getChannel('alert_channel', true);
      const action = interaction.options.getString('action') ?? 'BAN';
      const channelDeleteThreshold = interaction.options.getInteger('channel_delete_threshold') ?? 3;
      const roleDeleteThreshold = interaction.options.getInteger('role_delete_threshold') ?? 3;
      const banThreshold = interaction.options.getInteger('ban_threshold') ?? 5;
      const autoLockdown = interaction.options.getBoolean('auto_lockdown') ?? false;
      const antiWebhook = interaction.options.getBoolean('anti_webhook') ?? true;

      await setModuleConfig(guildId, 'antinuke', {
        alertChannelId: alertChannel.id,
        action,
        autoLockdown,
        antiWebhook,
        thresholds: {
          CHANNEL_DELETE: channelDeleteThreshold,
          ROLE_DELETE: roleDeleteThreshold,
          BAN: banThreshold,
          KICK: banThreshold,
        },
        window: 10000,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Anti-Nuke Đã Cấu Hình')
        .setColor(0x2ecc71)
        .addFields(
          { name: '🔔 Alert Channel', value: `<#${alertChannel.id}>`, inline: true },
          { name: '⚡ Hành động', value: action, inline: true },
          { name: '🔒 Auto Lockdown', value: autoLockdown ? '✅' : '❌', inline: true },
          { name: '📊 Channel Delete', value: `${channelDeleteThreshold}x / 10s`, inline: true },
          { name: '📊 Role Delete', value: `${roleDeleteThreshold}x / 10s`, inline: true },
          { name: '📊 Ban/Kick', value: `${banThreshold}x / 10s`, inline: true },
          { name: '🔗 Anti-Webhook', value: antiWebhook ? '✅' : '❌', inline: true },
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'whitelist') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      if (!user && !role) return void interaction.reply({ content: '❌ Cần chọn user hoặc role.', ephemeral: true });

      const { config } = await getModuleConfig<any>(guildId, 'antinuke');
      const whitelist = config.whitelist ?? [];
      const id = user?.id ?? role?.id!;
      if (!whitelist.includes(id)) {
        whitelist.push(id);
        await setModuleConfig(guildId, 'antinuke', { whitelist });
      }
      await interaction.reply({ content: `✅ Đã whitelist: ${user ?? role}`, ephemeral: true });

    } else if (sub === 'info') {
      const { enabled, config } = await getModuleConfig<any>(guildId, 'antinuke');
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Nuke Status')
        .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
        .addFields(
          { name: '🔘 Trạng thái', value: enabled ? '🟢 BẬT' : '🔴 TẮT', inline: true },
          { name: '⚡ Hành động', value: config.action ?? 'BAN', inline: true },
          { name: '🔔 Alert', value: config.alertChannelId ? `<#${config.alertChannelId}>` : 'Chưa đặt', inline: true },
          { name: '📊 Thresholds', value: Object.entries(config.thresholds ?? {}).map(([k, v]) => `${k}: **${v}x**`).join('\n') || 'Mặc định', inline: false },
          { name: '🔒 Auto Lockdown', value: config.autoLockdown ? '✅' : '❌', inline: true },
          { name: '👥 Whitelist', value: config.whitelist?.length ? config.whitelist.map((id: string) => `<@${id}>`).join(', ') : 'Trống', inline: false },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

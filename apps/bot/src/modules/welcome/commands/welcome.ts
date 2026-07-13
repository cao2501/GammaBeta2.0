import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { setModuleConfig, getModuleConfig } from '../../../database/helpers';

export default class WelcomeCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('👋 Cấu hình hệ thống chào mừng')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('Thiết lập welcome channel')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh welcome').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Nội dung welcome (dùng {user}, {server}, {count})'))
    )
    .addSubcommand(s => s.setName('leave').setDescription('Thiết lập leave channel')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh leave').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Nội dung leave (dùng {user}, {server}, {count})'))
    )
    .addSubcommand(s => s.setName('dm').setDescription('Thiết lập DM welcome')
      .addStringOption(o => o.setName('message').setDescription('Nội dung DM welcome').setRequired(true))
    )
    .addSubcommand(s => s.setName('test').setDescription('Test welcome message'))
    .addSubcommand(s => s.setName('disable').setDescription('Tắt welcome/leave')
      .addStringOption(o => o.setName('type').setDescription('Loại').setRequired(true)
        .addChoices({ name: 'Welcome', value: 'welcome' }, { name: 'Leave', value: 'leave' }, { name: 'DM', value: 'dm' })
      )
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') ?? '👋 Chào mừng {user} đến với **{server}**! Bạn là thành viên thứ **{count}**.';
      await setModuleConfig(guildId, 'welcome', { welcomeChannelId: channel.id, welcomeMessage: message, welcomeEnabled: true });
      await interaction.reply({ content: `✅ Welcome channel → <#${channel.id}>`, ephemeral: true });
    } else if (sub === 'leave') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') ?? '👋 **{user}** đã rời khỏi server. Còn **{count}** thành viên.';
      await setModuleConfig(guildId, 'welcome', { leaveChannelId: channel.id, leaveMessage: message, leaveEnabled: true });
      await interaction.reply({ content: `✅ Leave channel → <#${channel.id}>`, ephemeral: true });
    } else if (sub === 'dm') {
      const message = interaction.options.getString('message', true);
      await setModuleConfig(guildId, 'welcome', { dmMessage: message, dmEnabled: true });
      await interaction.reply({ content: '✅ DM welcome đã được cấu hình.', ephemeral: true });
    } else if (sub === 'test') {
      const { config } = await getModuleConfig<any>(guildId, 'welcome');
      if (!config.welcomeChannelId) return void interaction.reply({ content: '❌ Chưa cấu hình welcome channel.', ephemeral: true });
      const ch = kernel.client.channels.cache.get(config.welcomeChannelId);
      const msg = (config.welcomeMessage as string)
        .replace('{user}', interaction.user.toString())
        .replace('{server}', interaction.guild!.name)
        .replace('{count}', String(interaction.guild!.memberCount));
      await (ch as any)?.send({ embeds: [new EmbedBuilder().setDescription(msg).setColor(0x2ecc71)] });
      await interaction.reply({ content: '✅ Test message đã gửi.', ephemeral: true });
    } else if (sub === 'disable') {
      const type = interaction.options.getString('type', true);
      const key = `${type}Enabled`;
      await setModuleConfig(guildId, 'welcome', { [key]: false });
      await interaction.reply({ content: `✅ Đã tắt **${type}**.`, ephemeral: true });
    }
  }
}

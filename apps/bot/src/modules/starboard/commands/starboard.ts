import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { setModuleConfig, getModuleConfig } from '../../../database/helpers';

export default class StarboardCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('⭐ Hệ thống Starboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('Thiết lập starboard')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh starboard').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription('Số ⭐ tối thiểu (mặc định: 3)').setMinValue(1).setMaxValue(50))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji custom (mặc định: ⭐)'))
    )
    .addSubcommand(s => s.setName('ignore').setDescription('Bỏ qua/unignore kênh')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh muốn bỏ qua').setRequired(true))
    )
    .addSubcommand(s => s.setName('info').setDescription('Xem cấu hình starboard'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const threshold = interaction.options.getInteger('threshold') ?? 3;
      const emoji = interaction.options.getString('emoji') ?? '⭐';

      await setModuleConfig(guildId, 'starboard', { channelId: channel.id, threshold, emoji, enabled: true });

      await interaction.reply({
        content: `✅ Starboard đã cấu hình!\n📝 Kênh: <#${channel.id}>\n⭐ Ngưỡng: ${threshold} ${emoji}`,
        ephemeral: true,
      });

    } else if (sub === 'ignore') {
      const channel = interaction.options.getChannel('channel', true);
      const { config } = await getModuleConfig<any>(guildId, 'starboard');
      const ignored: string[] = config.ignoredChannels ?? [];
      const idx = ignored.indexOf(channel.id);
      if (idx === -1) {
        ignored.push(channel.id);
        await setModuleConfig(guildId, 'starboard', { ignoredChannels: ignored });
        await interaction.reply({ content: `✅ Kênh <#${channel.id}> sẽ bị bỏ qua khỏi starboard.`, ephemeral: true });
      } else {
        ignored.splice(idx, 1);
        await setModuleConfig(guildId, 'starboard', { ignoredChannels: ignored });
        await interaction.reply({ content: `✅ Kênh <#${channel.id}> đã được unignore.`, ephemeral: true });
      }

    } else if (sub === 'info') {
      const { enabled, config } = await getModuleConfig<any>(guildId, 'starboard');
      const embed = new EmbedBuilder()
        .setTitle('⭐ Cấu Hình Starboard')
        .setColor(0xf1c40f)
        .addFields(
          { name: '🔘 Trạng thái', value: enabled ? '🟢 Bật' : '🔴 Tắt', inline: true },
          { name: '📝 Kênh', value: config.channelId ? `<#${config.channelId}>` : 'Chưa đặt', inline: true },
          { name: '⭐ Ngưỡng', value: `${config.threshold ?? 3} ${config.emoji ?? '⭐'}`, inline: true },
          { name: '🚫 Ignored', value: config.ignoredChannels?.length ? config.ignoredChannels.map((id: string) => `<#${id}>`).join(', ') : 'Không có' },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

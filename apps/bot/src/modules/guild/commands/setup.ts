import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { getModuleConfig, setModuleConfig, ensureGuild } from '../../../database/helpers';

export default class SetupCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Thiết lập bot cho server này')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('wizard').setDescription('🧙 Chạy wizard thiết lập tự động')
    )
    .addSubcommand(sub =>
      sub.setName('module')
        .setDescription('Bật/Tắt module')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Tên module').setRequired(true)
            .addChoices(
              { name: 'Moderation', value: 'moderation' },
              { name: 'Logging', value: 'logging' },
              { name: 'Welcome', value: 'welcome' },
              { name: 'Tickets', value: 'tickets' },
              { name: 'Leveling', value: 'leveling' },
              { name: 'Economy', value: 'economy' },
              { name: 'Giveaway', value: 'giveaway' },
              { name: 'Starboard', value: 'starboard' },
              { name: 'Verification', value: 'verification' },
            )
        )
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Bật hay Tắt').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info').setDescription('📊 Xem cấu hình hiện tại')
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'wizard') {
      await this.runWizard(interaction, kernel);
    } else if (sub === 'module') {
      await this.toggleModule(interaction, kernel);
    } else if (sub === 'info') {
      await this.showInfo(interaction, kernel);
    }
  }

  private async runWizard(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild!;

    await ensureGuild(guild.id, guild.name, guild.ownerId);

    const embed = new EmbedBuilder()
      .setTitle('🧙 Wizard Thiết Lập Server')
      .setColor(0x5865f2)
      .setDescription('✅ Bot đã được khởi tạo cho server của bạn!')
      .addFields(
        { name: '📋 Modules Mặc Định', value: 'Tất cả modules đã được bật.\nDùng `/setup module` để tùy chỉnh.', inline: false },
        { name: '📖 Hướng Dẫn', value: '• `/moderation` — Cấu hình kiểm duyệt\n• `/logging` — Cấu hình log\n• `/welcome` — Cấu hình chào mừng\n• `/ticket` — Cấu hình ticket', inline: false },
        { name: '🌐 Dashboard', value: `[Mở Dashboard](${process.env.DASHBOARD_URL || 'http://localhost:3000'})`, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async toggleModule(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const moduleName = interaction.options.getString('name', true);
    const enabled = interaction.options.getBoolean('enabled', true);

    await setModuleConfig(interaction.guildId!, moduleName, {}, enabled);

    await interaction.reply({
      content: `✅ Module **${moduleName}** đã được **${enabled ? 'bật' : 'tắt'}**.`,
      ephemeral: true,
    });
  }

  private async showInfo(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId!;

    const moduleNames = Array.from(kernel.client.modules.keys());
    const statuses: string[] = [];

    for (const name of moduleNames) {
      const { enabled } = await getModuleConfig(guildId, name);
      statuses.push(`${enabled ? '🟢' : '🔴'} ${name}`);
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Cấu Hình Server')
      .setColor(0x5865f2)
      .addFields({
        name: `📦 Modules (${moduleNames.length})`,
        value: statuses.join('\n') || 'Chưa có module nào',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

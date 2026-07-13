import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

const LOG_EVENTS = [
  'MESSAGE_DELETE', 'MESSAGE_EDIT', 'MEMBER_JOIN', 'MEMBER_LEAVE',
  'NICKNAME_CHANGE', 'USERNAME_CHANGE', 'AVATAR_CHANGE', 'ROLE_ADD', 'ROLE_REMOVE',
  'VOICE_JOIN', 'VOICE_LEAVE', 'VOICE_MOVE', 'VOICE_MUTE', 'VOICE_DEAF',
  'INVITE_CREATE', 'INVITE_DELETE', 'CHANNEL_CREATE', 'CHANNEL_DELETE', 'CHANNEL_UPDATE',
  'THREAD_CREATE', 'THREAD_DELETE', 'ROLE_CREATE', 'ROLE_DELETE', 'ROLE_UPDATE',
  'EMOJI_UPDATE', 'STICKER_UPDATE', 'WEBHOOK', 'AUDIT_LOG', 'BAN', 'KICK', 'TIMEOUT', 'WARN',
  'TICKET_CREATE', 'TICKET_CLOSE', 'TICKET_CLAIM',
];

export default class LoggingCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('logging')
    .setDescription('📋 Cấu hình hệ thống logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('set').setDescription('Thiết lập kênh log cho sự kiện')
      .addStringOption(o => o.setName('event').setDescription('Loại sự kiện').setRequired(true)
        .addChoices(...LOG_EVENTS.slice(0, 25).map(e => ({ name: e.replace(/_/g, ' '), value: e })))
      )
      .addChannelOption(o => o.setName('channel').setDescription('Kênh log').setRequired(true))
    )
    .addSubcommand(s => s.setName('disable').setDescription('Tắt log cho sự kiện')
      .addStringOption(o => o.setName('event').setDescription('Loại sự kiện').setRequired(true)
        .addChoices(...LOG_EVENTS.slice(0, 25).map(e => ({ name: e.replace(/_/g, ' '), value: e })))
      )
    )
    .addSubcommand(s => s.setName('list').setDescription('Xem tất cả log channels đã cấu hình'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'set') {
      const eventType = interaction.options.getString('event', true);
      const channel = interaction.options.getChannel('channel', true);

      await kernel.db.logChannel.upsert({
        where: { guildId_eventType: { guildId, eventType } },
        create: { guildId, eventType, channelId: channel.id, enabled: true },
        update: { channelId: channel.id, enabled: true },
      });

      await interaction.reply({ content: `✅ Log **${eventType}** → <#${channel.id}>`, ephemeral: true });
    } else if (sub === 'disable') {
      const eventType = interaction.options.getString('event', true);
      await kernel.db.logChannel.updateMany({ where: { guildId, eventType }, data: { enabled: false } });
      await interaction.reply({ content: `✅ Đã tắt log **${eventType}**.`, ephemeral: true });
    } else if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const channels = await kernel.db.logChannel.findMany({ where: { guildId }, orderBy: { eventType: 'asc' } });

      const embed = new EmbedBuilder()
        .setTitle('📋 Log Channels')
        .setColor(0x5865f2)
        .setDescription(channels.length
          ? channels.map(c => `${c.enabled ? '🟢' : '🔴'} **${c.eventType}** → <#${c.channelId}>`).join('\n')
          : 'Chưa cấu hình log channel nào.\nDùng `/logging set` để bắt đầu.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}

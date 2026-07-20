import {
  TextChannel, ThreadChannel, ButtonInteraction, ChatInputCommandInteraction,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  PermissionFlagsBits, AttachmentBuilder, User, Guild
} from 'discord.js';
import { Kernel } from '../../../core/Kernel';
import { logger } from '../../../core/logger/Logger';
import { ensureGuild } from '../../../database/helpers';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

export class TicketService {
  /**
   * Automatically create or get the hidden log channel 'gamma-beta-ticket-logs'
   */
  private static async getOrCreateLogChannel(guild: Guild, kernel: Kernel): Promise<TextChannel> {
    let logChannel = guild.channels.cache.find(
      c => c.name === 'gamma-beta-ticket-logs' && c.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    if (!logChannel) {
      logChannel = await guild.channels.create({
        name: 'gamma-beta-ticket-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel] // Hide from @everyone
          },
          {
            id: kernel.client.user!.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] // Allow Bot
          }
        ]
      });
      logger.info(`Automatically created hidden logs channel 'gamma-beta-ticket-logs' in guild ${guild.name}`);
    }

    return logChannel;
  }

  /**
   * Create a new ticket as a sub-thread on the panel's channel
   */
  static async createTicket(kernel: Kernel, interaction: ButtonInteraction, panelId: string, type?: string): Promise<void> {
    const panel = await kernel.db.ticketPanel.findUnique({ where: { id: panelId } });
    if (!panel) return void interaction.editReply('❌ Panel không tồn tại.');

    const config = JSON.parse(panel.config);

    // Check if user already has an open ticket in this guild
    const existing = await kernel.db.ticket.findFirst({
      where: { guildId: interaction.guildId!, userId: interaction.user.id, status: 'OPEN' },
    });

    if (existing) {
      const channelExists = interaction.guild!.channels.cache.has(existing.channelId);
      if (channelExists) {
        return void interaction.editReply(`❌ Bạn đã có ticket đang mở: <#${existing.channelId}>`);
      } else {
        // Clean up stale ticket record in db if the channel was deleted manually
        await kernel.db.ticket.update({ where: { id: existing.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      }
    }

    await ensureGuild(interaction.guildId!, interaction.guild!.name);

    const parentChannel = interaction.channel;
    if (!parentChannel || !parentChannel.isTextBased()) {
      return void interaction.editReply('❌ Kênh không hợp lệ để tạo ticket.');
    }

    // Parse button configs
    let buttonLabel = type || 'ticket';
    let welcomeTemplate = 'Xin chào {user}! Vui lòng mô tả vấn đề của bạn và staff sẽ hỗ trợ sớm.';
    let welcomeTitle = '🎫 Ticket Mới';

    if (config.buttons && Array.isArray(config.buttons)) {
      const foundBtn = config.buttons.find((b: any) => typeof b === 'object' && b.id === type);
      if (foundBtn) {
        buttonLabel = foundBtn.id || type || 'ticket';
        if (foundBtn.welcomeMessage) {
          welcomeTemplate = foundBtn.welcomeMessage;
        }
        if (foundBtn.welcomeTitle) {
          welcomeTitle = foundBtn.welcomeTitle;
        }
      }
    }

    // 1. Create a temporary ticket in the database first to obtain a unique ID suffix
    const tempTicket = await kernel.db.ticket.create({
      data: {
        guildId: interaction.guildId!,
        panelId,
        channelId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: interaction.user.id,
        status: 'OPEN'
      },
    });

    const ticketSuffix = tempTicket.id.slice(-4).toUpperCase();
    const threadName = `🎫-${buttonLabel}-${interaction.user.username}-${ticketSuffix}`;
    let thread: ThreadChannel;

    try {
      thread = await (parentChannel as TextChannel).threads.create({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        type: ChannelType.PrivateThread,
        reason: `Ticket opened by ${interaction.user.tag}`
      });
    } catch (err: any) {
      logger.warn(`Private thread creation failed, falling back to public thread: ${err.message}`);
      thread = await (parentChannel as TextChannel).threads.create({
        name: threadName,
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread,
        reason: `Ticket opened by ${interaction.user.tag}`
      });
    }

    // 2. Update database ticket record with the real thread channel ID
    await kernel.db.ticket.update({
      where: { id: tempTicket.id },
      data: { channelId: thread.id }
    });

    // Add ticket owner to thread
    await thread.members.add(interaction.user.id).catch(() => {});

    kernel.eventBus.emit('ticket:create', {
      guildId: interaction.guildId!,
      ticketId: tempTicket.id,
      userId: interaction.user.id,
      channelId: thread.id
    });

    // 3. Format custom welcome message
    const welcomeMsg = welcomeTemplate.replace(/{user}/g, `${interaction.user}`);

    const embed = new EmbedBuilder()
      .setTitle(welcomeTitle)
      .setColor(0x5865f2)
      .setDescription(welcomeMsg)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:close:${tempTicket.id}`).setLabel('🔒 Đóng Ticket').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket:claim:${tempTicket.id}`).setLabel('✋ Nhận Ticket').setStyle(ButtonStyle.Secondary),
    );

    await thread.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
    await interaction.editReply(`✅ Ticket đã được tạo: <#${thread.id}>`);
  }

  /**
   * Close a ticket: generate transcript, save all attachments, post to logs, and delete thread
   */
  static async closeTicket(
    kernel: Kernel,
    channel: TextChannel | ThreadChannel,
    closer: User,
    reason: string
  ): Promise<void> {
    const ticket = await kernel.db.ticket.findUnique({ where: { channelId: channel.id } });
    if (!ticket) {
      if (channel.isThread()) {
        await channel.send('❌ Không tìm thấy thông tin ticket trong cơ sở dữ liệu.');
      }
      return;
    }

    // Update status in Database
    await kernel.db.ticket.update({
      where: { id: ticket.id },
      data: { status: 'CLOSED', closedAt: new Date() }
    });

    kernel.eventBus.emit('ticket:close', {
      guildId: ticket.guildId,
      ticketId: ticket.id,
      userId: closer.id
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎫 Ticket Đóng')
          .setColor(0xe74c3c)
          .setDescription(`Ticket này sẽ bị xóa sau 5 giây.\n\n**Lý do:** ${reason}\n**Đóng bởi:** ${closer.tag}`)
      ]
    }).catch(() => {});

    // Fetch messages to generate logs and extract files
    let messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const sortedMessages = messages ? Array.from(messages.values()).reverse() as any[] : [];

    // Log to SpecialLogger (writes summary, txt, html transcript and downloads attachments)
    await SpecialLogger.logTicket(
      kernel,
      channel.guild,
      channel.name,
      ticket.id,
      ticket.userId,
      closer.tag,
      closer.id,
      reason,
      sortedMessages
    );

    // 4. Delete the Channel/Thread
    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 5000);
  }

  /**
   * Claim ticket logic
   */
  static async claimTicket(
    kernel: Kernel,
    channel: TextChannel | ThreadChannel,
    moderator: User
  ): Promise<void> {
    const ticket = await kernel.db.ticket.findUnique({ where: { channelId: channel.id } });
    if (!ticket) {
      if (channel.isThread()) {
        await channel.send('❌ Kênh này không khớp với bất kỳ ticket nào.');
      }
      return;
    }

    if (ticket.claimedBy) {
      await channel.send(`❌ Ticket này đã được nhận bởi <@${ticket.claimedBy}>.`);
      return;
    }

    await kernel.db.ticket.update({
      where: { id: ticket.id },
      data: { claimedBy: moderator.id }
    });

    kernel.eventBus.emit('ticket:claim', {
      guildId: ticket.guildId,
      ticketId: ticket.id,
      moderatorId: moderator.id
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`✅ ${moderator} đã nhận hỗ trợ cho ticket này.`);

    await channel.send({ embeds: [embed] });
  }
}

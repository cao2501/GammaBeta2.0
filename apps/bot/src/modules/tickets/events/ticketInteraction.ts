import { Interaction, ButtonInteraction, EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class TicketInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    const [ns, action, id] = interaction.customId.split(':');
    if (ns !== 'ticket') return;

    if (action === 'create') {
      await this.handleCreate(kernel, interaction as ButtonInteraction, id);
    }
  }

  private async handleCreate(kernel: Kernel, interaction: ButtonInteraction, panelId: string): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const panel = await kernel.db.ticketPanel.findUnique({ where: { id: panelId } });
    if (!panel) return void interaction.editReply('❌ Panel không tồn tại.');

    // Check if user already has open ticket
    const existing = await kernel.db.ticket.findFirst({
      where: { guildId: interaction.guildId!, userId: interaction.user.id, status: 'OPEN' },
    });
    if (existing) return void interaction.editReply(`❌ Bạn đã có ticket đang mở: <#${existing.channelId}>`);

    await ensureGuild(interaction.guildId!, interaction.guild!.name);

    const category = interaction.guild!.channels.cache.find(c => c.name === '📩 Tickets' && c.type === ChannelType.GuildCategory);

    const ticketChannel = await interaction.guild!.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites: [
        { id: interaction.guild!.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });

    const ticket = await kernel.db.ticket.create({
      data: { guildId: interaction.guildId!, panelId, channelId: ticketChannel.id, userId: interaction.user.id },
    });

    kernel.eventBus.emit('ticket:create', { guildId: interaction.guildId!, ticketId: ticket.id, userId: interaction.user.id, channelId: ticketChannel.id });

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Mới')
      .setColor(0x5865f2)
      .setDescription(`Xin chào ${interaction.user}! Vui lòng mô tả vấn đề của bạn và staff sẽ hỗ trợ sớm.`)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel('🔒 Đóng Ticket').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket:claim:${ticket.id}`).setLabel('✋ Nhận Ticket').setStyle(ButtonStyle.Secondary),
    );

    await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
    await interaction.editReply(`✅ Ticket đã tạo: ${ticketChannel}`);
  }
}

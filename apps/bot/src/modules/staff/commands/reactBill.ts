import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, TextChannel
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild, getModuleConfig } from '../../../database/helpers';
import { ReactBillManager } from '../reactBillManager';

export default class ReactBillCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('reactbill')
    .setDescription('📋 Lệnh đăng ký và ghép bill liên kênh')
    .addSubcommand(s => s.setName('simple').setDescription('Tạo bảng đăng ký đơn giản trong kênh hiện tại')
      .addStringOption(o => o.setName('title').setDescription('Tiêu đề của bảng đăng ký'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả của bảng đăng ký'))
    )
    .addSubcommand(s => s.setName('bill').setDescription('Tạo ghép bill liên kênh (gửi đăng ký vào kênh chung, quản lý ở đây)'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);

    if (sub === 'simple') {
      await interaction.deferReply();
      const title = interaction.options.getString('title') ?? '📋 DANH SÁCH ĐĂNG KÝ';
      const description = interaction.options.getString('description') ?? 'Nhấn nút bên dưới để tham gia đăng ký hoặc Hủy đăng ký khỏi danh sách:';

      const billId = `react_simple_${Date.now()}`;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setDescription(`${description}\n\n**Danh sách React:**\n*(Chưa có ai đăng ký)*`)
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`reactbill:join:simple:${billId}`)
          .setLabel('React (Đăng Ký)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reactbill:leave:simple:${billId}`)
          .setLabel('Hủy Đăng Ký')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.editReply({ content: title, embeds: [embed], components: [row] });

      ReactBillManager.createBill({
        id: billId,
        guildId,
        title,
        description,
        participants: [],
        managerChannelId: interaction.channelId,
        managerMessageId: msg.id,
        voterChannelId: interaction.channelId,
        voterMessageId: msg.id
      });

    } else if (sub === 'bill') {
      await interaction.deferReply();

      // Read configured reactbill channel
      const logChannelRecord = await kernel.db.logChannel.findUnique({
        where: { guildId_eventType: { guildId, eventType: 'REACTBILL_CHANNEL' } }
      });
      const reactBillChannelId = logChannelRecord?.enabled ? logChannelRecord.channelId : null;

      if (!reactBillChannelId) {
        return void interaction.editReply('❌ Kênh đăng ký chung chưa được thiết lập. Quản trị viên vui lòng chạy lệnh `/logging set-reactbill` để thiết lập trước.');
      }

      const reactChannel = await kernel.client.channels.fetch(reactBillChannelId).catch(() => null) as TextChannel;
      if (!reactChannel || !reactChannel.isTextBased()) {
        return void interaction.editReply('❌ Kênh đăng ký chung được thiết lập không tồn tại hoặc không khả dụng.');
      }

      const billId = `react_bill_${Date.now()}`;

      // 1. Send voting embed (Embed Đăng ký) to the public channel
      const voterEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setDescription('Bấm nút dưới đây để đăng ký (React) hoặc Hủy đăng ký.\n*Yêu cầu: Phải có hồ sơ nhân viên trong hệ thống để tham gia.*')
        .setTimestamp();

      const voterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`reactbill:join:${billId}`)
          .setLabel('Đăng Ký')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reactbill:leave:${billId}`)
          .setLabel('Hủy Đăng Ký')
          .setStyle(ButtonStyle.Danger)
      );

      const voterMsg = await reactChannel.send({ content: '🎯 ĐĂNG KÝ GHÉP BILL', embeds: [voterEmbed], components: [voterRow] });

      // 2. Send manager embed (Embed Quản lý Bill) to current command channel
      const managerEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription('**Danh sách React:**\n*(Chưa có ai đăng ký)*')
        .setTimestamp();

      // Placeholder select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`reactbill:select:${billId}`)
        .setPlaceholder('Chọn profile player (1-5)')
        .addOptions({ label: 'Chưa có người đăng ký', value: 'placeholder' })
        .setDisabled(true);

      const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`reactbill:random:${billId}`)
          .setLabel('Chọn Ngẫu nhiên')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`reactbill:refresh:${billId}`)
          .setLabel('Làm mới')
          .setStyle(ButtonStyle.Secondary)
      );

      const managerMsg = await interaction.editReply({
        content: 'REACT BILL',
        embeds: [managerEmbed],
        components: [menuRow, btnRow]
      });

      // 3. Register state in ReactBillManager
      ReactBillManager.createBill({
        id: billId,
        guildId,
        title: 'REACT BILL',
        participants: [],
        managerChannelId: interaction.channelId,
        managerMessageId: managerMsg.id,
        voterChannelId: reactBillChannelId,
        voterMessageId: voterMsg.id
      });
    }
  }
}

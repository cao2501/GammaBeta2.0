import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, TextChannel, ChannelType
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class EmbedCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('embed')
    .setDescription('🖼️ Tạo và gửi embed tùy chỉnh')
    .addSubcommand(s => s.setName('send').setDescription('Gửi embed tùy chỉnh vào một kênh đã chọn')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh muốn gửi tin nhắn đến').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Tiêu đề của embed'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả/nội dung của embed (chấp nhận \\n để xuống dòng)'))
      .addStringOption(o => o.setName('color').setDescription('Màu viền Hex (ví dụ: #ff0000, #3498db)'))
      .addAttachmentOption(o => o.setName('thumbnail_file').setDescription('Tải lên ảnh nhỏ (thumbnail)'))
      .addStringOption(o => o.setName('thumbnail').setDescription('Đường dẫn ảnh nhỏ (thumbnail) ở góc phải dạng liên kết URL'))
      .addAttachmentOption(o => o.setName('image_file').setDescription('Tải lên ảnh lớn'))
      .addStringOption(o => o.setName('image').setDescription('Đường dẫn ảnh lớn hiển thị ở dưới dạng liên kết URL'))
      .addStringOption(o => o.setName('footer').setDescription('Nội dung chân trang (footer)'))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return void interaction.reply({ content: '❌ Bạn cần quyền **Manage Server** để sử dụng lệnh này.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel', true);
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      return void interaction.reply({ content: '❌ Kênh được chọn phải là kênh văn bản.', ephemeral: true });
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color') ?? '#3498db';
    const thumbnailFile = interaction.options.getAttachment('thumbnail_file');
    const thumbnail = thumbnailFile?.url ?? interaction.options.getString('thumbnail');
    const imageFile = interaction.options.getAttachment('image_file');
    const image = imageFile?.url ?? interaction.options.getString('image');
    const footer = interaction.options.getString('footer');

    if (!title && !description && !image && !thumbnail) {
      return void interaction.reply({
        content: '❌ Embed của bạn phải có ít nhất tiêu đề, mô tả, ảnh thumbnail hoặc ảnh lớn.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder().setColor(color as any);

    if (title) embed.setTitle(title);
    if (description) {
      // Replace literal \n with actual newlines
      embed.setDescription(description.replace(/\\n/g, '\n'));
    }
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (footer) embed.setFooter({ text: footer });

    try {
      await (channel as TextChannel).send({ embeds: [embed] });
      return void interaction.reply({ content: `✅ Đã gửi thành công embed tới kênh ${channel}.`, ephemeral: true });
    } catch (err: any) {
      return void interaction.reply({
        content: `❌ Gửi embed thất bại. Hãy chắc chắn bot có quyền gửi tin nhắn trong kênh đó.\nChi tiết lỗi: \`${err.message}\``,
        ephemeral: true
      });
    }
  }
}

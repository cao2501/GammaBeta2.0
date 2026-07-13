import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class AnnouncementsCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('📢 Hệ thống thông báo')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('send').setDescription('Gửi thông báo')
      .addStringOption(o => o.setName('title').setDescription('Tiêu đề').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Nội dung thông báo').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Kênh gửi (mặc định: kênh hiện tại)'))
      .addStringOption(o => o.setName('color').setDescription('Màu HEX (vd: #ff0000)'))
      .addRoleOption(o => o.setName('mention').setDescription('Ping role'))
    )
    .addSubcommand(s => s.setName('dm').setDescription('Gửi DM tới tất cả thành viên')
      .addStringOption(o => o.setName('message').setDescription('Nội dung').setRequired(true))
    )
    .addSubcommand(s => s.setName('schedule').setDescription('Lên lịch thông báo')
      .addStringOption(o => o.setName('message').setDescription('Nội dung').setRequired(true))
      .addStringOption(o => o.setName('time').setDescription('Thời gian (vd: 2h, 1d)').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Kênh'))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'send') {
      await interaction.deferReply({ ephemeral: true });
      const title = interaction.options.getString('title', true);
      const message = interaction.options.getString('message', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const colorHex = interaction.options.getString('color')?.replace('#', '') ?? '5865f2';
      const mentionRole = interaction.options.getRole('mention');

      const color = parseInt(colorHex, 16) || 0x5865f2;
      const embed = new EmbedBuilder()
        .setTitle(`📢 ${title}`)
        .setDescription(message)
        .setColor(color)
        .setFooter({ text: `Thông báo bởi ${interaction.user.tag}` })
        .setTimestamp();

      const ch = kernel.client.channels.cache.get(channel!.id);
      if (!ch?.isTextBased()) return void interaction.editReply('❌ Kênh không hợp lệ.');

      const content = mentionRole ? mentionRole.toString() : undefined;
      await (ch as any).send({ content, embeds: [embed] });

      await interaction.editReply('✅ Thông báo đã được gửi!');

    } else if (sub === 'dm') {
      await interaction.deferReply({ ephemeral: true });
      const message = interaction.options.getString('message', true);
      await interaction.editReply('⏳ Đang gửi DM đến tất cả thành viên...');

      const members = await interaction.guild!.members.fetch();
      let sent = 0, failed = 0;

      const embed = new EmbedBuilder()
        .setTitle(`📢 Thông báo từ ${interaction.guild!.name}`)
        .setDescription(message)
        .setColor(0x5865f2)
        .setTimestamp();

      for (const member of members.values()) {
        if (member.user.bot) continue;
        await member.send({ embeds: [embed] }).then(() => sent++).catch(() => failed++);
        await new Promise(r => setTimeout(r, 100)); // Rate limit protection
      }

      await interaction.editReply(`✅ Đã gửi DM: **${sent}** thành công, **${failed}** thất bại.`);

    } else if (sub === 'schedule') {
      const message = interaction.options.getString('message', true);
      const timeStr = interaction.options.getString('time', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      const { default: ms } = await import('ms').catch(() => ({ default: null as any }));
      if (!ms) return void interaction.reply({ content: '❌ Lỗi module ms.', ephemeral: true });
      const duration = ms(timeStr);
      if (!duration) return void interaction.reply({ content: '❌ Thời gian không hợp lệ.', ephemeral: true });

      await kernel.db.reminder.create({
        data: {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: channel!.id,
          message: `__ANNOUNCE__${message}`,
          remindAt: new Date(Date.now() + duration),
        },
      });

      await interaction.reply({ content: `✅ Thông báo đã lên lịch sau **${timeStr}** tại <#${channel!.id}>.`, ephemeral: true });
    }
  }
}

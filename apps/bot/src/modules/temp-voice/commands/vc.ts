import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class TempVoiceCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('vc')
    .setDescription('🔊 Quản lý kênh voice tạm thời của bạn')
    .addSubcommand(s => s.setName('setup').setDescription('[Admin] Thiết lập hub channel')
      .addChannelOption(o => o.setName('hub').setDescription('Kênh hub (vào đây để tạo phòng)').setRequired(true))
      .addStringOption(o => o.setName('template').setDescription('Template tên (dùng {user})'))
      .addIntegerOption(o => o.setName('limit').setDescription('Giới hạn thành viên mặc định'))
    )
    .addSubcommand(s => s.setName('rename').setDescription('Đổi tên phòng của bạn').addStringOption(o => o.setName('name').setDescription('Tên mới').setRequired(true)))
    .addSubcommand(s => s.setName('limit').setDescription('Đặt giới hạn người').addIntegerOption(o => o.setName('amount').setDescription('Số người (0 = không giới hạn)').setMinValue(0).setMaxValue(99).setRequired(true)))
    .addSubcommand(s => s.setName('lock').setDescription('Khóa/Mở khóa phòng'))
    .addSubcommand(s => s.setName('hide').setDescription('Ẩn/Hiện phòng'))
    .addSubcommand(s => s.setName('kick').setDescription('Kick người khỏi phòng').addUserOption(o => o.setName('user').setDescription('Người dùng').setRequired(true)))
    .addSubcommand(s => s.setName('transfer').setDescription('Chuyển quyền sở hữu').addUserOption(o => o.setName('user').setDescription('Người nhận').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('Thông tin phòng hiện tại'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const hub = interaction.options.getChannel('hub', true);
      const template = interaction.options.getString('template') ?? '🔊 {user}\'s Room';
      const limit = interaction.options.getInteger('limit') ?? 0;
      await ensureGuild(guildId, interaction.guild!.name);
      const { setModuleConfig } = await import('../../../database/helpers');
      await setModuleConfig(guildId, 'temp-voice', { hubChannelId: hub.id, nameTemplate: template, defaultLimit: limit });
      return void interaction.reply({ content: `✅ Hub channel: <#${hub.id}>\nTemplate: \`${template}\`\nLimit: ${limit || 'Không giới hạn'}`, ephemeral: true });
    }

    // For all other subcommands, user must be in a temp voice channel they own
    const member = interaction.guild!.members.cache.get(userId);
    const voiceChannelId = member?.voice.channelId;
    if (!voiceChannelId) return void interaction.reply({ content: '❌ Bạn cần ở trong voice channel.', ephemeral: true });

    const tempCh = await kernel.db.tempChannel.findUnique({ where: { channelId: voiceChannelId } });
    if (!tempCh) return void interaction.reply({ content: '❌ Đây không phải phòng tạm thời.', ephemeral: true });
    if (tempCh.ownerId !== userId) return void interaction.reply({ content: '❌ Bạn không phải chủ phòng này.', ephemeral: true });

    const voiceChannel = interaction.guild!.channels.cache.get(voiceChannelId) as any;
    if (!voiceChannel) return void interaction.reply({ content: '❌ Không tìm thấy kênh.', ephemeral: true });

    if (sub === 'rename') {
      const name = interaction.options.getString('name', true);
      await voiceChannel.setName(name);
      await kernel.db.tempChannel.update({ where: { channelId: voiceChannelId }, data: { name } });
      await interaction.reply({ content: `✅ Đổi tên thành **${name}**.`, ephemeral: true });

    } else if (sub === 'limit') {
      const amount = interaction.options.getInteger('amount', true);
      await voiceChannel.setUserLimit(amount);
      await interaction.reply({ content: `✅ Giới hạn: **${amount || 'Không giới hạn'}**.`, ephemeral: true });

    } else if (sub === 'lock') {
      const { PermissionFlagsBits: PFB } = await import('discord.js');
      const isLocked = voiceChannel.permissionOverwrites.cache.get(guildId)?.deny.has(PFB.Connect);
      if (isLocked) {
        await voiceChannel.permissionOverwrites.edit(guildId, { Connect: null });
        await interaction.reply({ content: '🔓 Phòng đã mở khóa.', ephemeral: true });
      } else {
        await voiceChannel.permissionOverwrites.edit(guildId, { Connect: false });
        await interaction.reply({ content: '🔒 Phòng đã khóa.', ephemeral: true });
      }

    } else if (sub === 'hide') {
      const { PermissionFlagsBits: PFB } = await import('discord.js');
      const isHidden = voiceChannel.permissionOverwrites.cache.get(guildId)?.deny.has(PFB.ViewChannel);
      if (isHidden) {
        await voiceChannel.permissionOverwrites.edit(guildId, { ViewChannel: null });
        await interaction.reply({ content: '👁️ Phòng đã hiện.', ephemeral: true });
      } else {
        await voiceChannel.permissionOverwrites.edit(guildId, { ViewChannel: false });
        await interaction.reply({ content: '🙈 Phòng đã ẩn.', ephemeral: true });
      }

    } else if (sub === 'kick') {
      const target = interaction.options.getUser('user', true);
      const targetMember = interaction.guild!.members.cache.get(target.id);
      if (!targetMember?.voice.channelId || targetMember.voice.channelId !== voiceChannelId) {
        return void interaction.reply({ content: '❌ Người này không trong phòng của bạn.', ephemeral: true });
      }
      await targetMember.voice.disconnect();
      await interaction.reply({ content: `✅ Đã kick **${target.username}** khỏi phòng.`, ephemeral: true });

    } else if (sub === 'transfer') {
      const target = interaction.options.getUser('user', true);
      const targetMember = interaction.guild!.members.cache.get(target.id);
      if (!targetMember?.voice.channelId || targetMember.voice.channelId !== voiceChannelId) {
        return void interaction.reply({ content: '❌ Người này không trong phòng của bạn.', ephemeral: true });
      }
      await kernel.db.tempChannel.update({ where: { channelId: voiceChannelId }, data: { ownerId: target.id } });
      await voiceChannel.permissionOverwrites.edit(target.id, { ManageChannels: true, MoveMembers: true });
      await voiceChannel.permissionOverwrites.edit(userId, { ManageChannels: null, MoveMembers: null });
      await interaction.reply({ content: `✅ Đã chuyển quyền sở hữu cho **${target.username}**.`, ephemeral: true });

    } else if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setTitle(`🔊 ${voiceChannel.name}`)
        .setColor(0x5865f2)
        .addFields(
          { name: '👑 Chủ phòng', value: `<@${tempCh.ownerId}>`, inline: true },
          { name: '👥 Thành viên', value: `${voiceChannel.members.size}${voiceChannel.userLimit ? `/${voiceChannel.userLimit}` : ''}`, inline: true },
          { name: '🔒 Trạng thái', value: voiceChannel.permissionOverwrites.cache.get(guildId)?.deny.has(16n) ? '🔒 Khóa' : '🔓 Mở', inline: true },
          { name: '📅 Tạo lúc', value: `<t:${Math.floor(tempCh.createdAt.getTime() / 1000)}:R>`, inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

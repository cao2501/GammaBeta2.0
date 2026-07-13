import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class ReactionRoleCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('🎭 Hệ thống Reaction Role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('button').setDescription('Tạo Button Role panel')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Tiêu đề embed').setRequired(true))
    )
    .addSubcommand(s => s.setName('add').setDescription('Thêm role vào message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji (tùy chọn)'))
      .addStringOption(o => o.setName('type').setDescription('Loại role').addChoices(
        { name: '📌 Normal', value: 'NORMAL' },
        { name: '🔁 Toggle', value: 'TOGGLE' },
        { name: '☝️ Unique (chỉ 1 role)', value: 'UNIQUE' },
        { name: '⏱️ Temporary', value: 'TEMPORARY' },
      ))
    )
    .addSubcommand(s => s.setName('dropdown').setDescription('Tạo Dropdown Role')
      .addChannelOption(o => o.setName('channel').setDescription('Kênh').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Tiêu đề').setRequired(true))
      .addStringOption(o => o.setName('roles').setDescription('Role IDs cách nhau bởi dấu phẩy').setRequired(true))
    )
    .addSubcommand(s => s.setName('list').setDescription('Xem danh sách reaction roles'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'button') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title', true);

      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${title}`)
        .setColor(0x5865f2)
        .setDescription('Nhấn các nút bên dưới để nhận/bỏ role.\n\n*Roles sẽ được cập nhật sau khi thêm bằng `/reactionrole add`*')
        .setFooter({ text: 'Nhấn nút để toggle role' });

      const ch = kernel.client.channels.cache.get(channel.id);
      if (!ch?.isTextBased()) return void interaction.editReply('❌ Kênh không hợp lệ.');

      const msg = await (ch as any).send({ embeds: [embed] });
      await interaction.editReply(`✅ Panel đã tạo tại <#${channel.id}>!\nDùng \`/reactionrole add message_id:${msg.id}\` để thêm roles.`);

    } else if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.getString('message_id', true);
      const role = interaction.options.getRole('role', true);
      const emoji = interaction.options.getString('emoji') ?? undefined;
      const type = interaction.options.getString('type') ?? 'NORMAL';

      await ensureGuild(guildId, interaction.guild!.name);

      // Find the message
      let targetMessage: any = null;
      for (const ch of interaction.guild!.channels.cache.values()) {
        if (ch.isTextBased()) {
          try {
            targetMessage = await (ch as any).messages.fetch(messageId);
            if (targetMessage) break;
          } catch {}
        }
      }

      if (!targetMessage) return void interaction.editReply('❌ Không tìm thấy message. Đảm bảo bot có quyền đọc kênh đó.');

      // Save to DB
      await kernel.db.reactionRole.create({
        data: {
          guildId,
          messageId,
          channelId: targetMessage.channelId,
          emoji: emoji ?? role.id,
          roleId: role.id,
          type,
        },
      }).catch(async () => {
        // Update if exists
        await kernel.db.reactionRole.updateMany({
          where: { messageId, emoji: emoji ?? role.id },
          data: { roleId: role.id, type },
        });
      });

      // Update message with new button
      const existing = await kernel.db.reactionRole.findMany({ where: { messageId, guildId } });
      const buttons = existing.map(rr => {
        const r = interaction.guild!.roles.cache.get(rr.roleId);
        return new ButtonBuilder()
          .setCustomId(`rr:${rr.type}:${rr.roleId}`)
          .setLabel(emoji ? `${emoji} ${r?.name ?? rr.roleId}` : (r?.name ?? rr.roleId))
          .setStyle(ButtonStyle.Secondary);
      });

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
      }

      try {
        await targetMessage.edit({ components: rows.slice(0, 5) });
      } catch {}

      await interaction.editReply(`✅ Đã thêm role **${role.name}** vào panel (Type: ${type}).`);

    } else if (sub === 'dropdown') {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title', true);
      const roleIds = interaction.options.getString('roles', true).split(',').map(r => r.trim()).filter(Boolean);

      const options = roleIds.map(id => {
        const role = interaction.guild!.roles.cache.get(id);
        return new StringSelectMenuOptionBuilder()
          .setLabel(role?.name ?? id)
          .setValue(id)
          .setDescription(`Toggle role ${role?.name ?? id}`);
      }).filter(o => o !== null);

      if (!options.length) return void interaction.editReply('❌ Không tìm thấy roles hợp lệ.');

      const select = new StringSelectMenuBuilder()
        .setCustomId('rr:dropdown:select')
        .setPlaceholder('🎭 Chọn role muốn nhận...')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

      const embed = new EmbedBuilder().setTitle(`🎭 ${title}`).setColor(0x5865f2)
        .setDescription('Chọn các role bạn muốn từ menu bên dưới.');

      const ch = kernel.client.channels.cache.get(channel.id);
      await (ch as any)?.send({ embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] });
      await interaction.editReply(`✅ Dropdown role panel đã tạo tại <#${channel.id}>!`);

    } else if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const rrs = await kernel.db.reactionRole.findMany({ where: { guildId }, take: 20 });
      const embed = new EmbedBuilder().setTitle('🎭 Reaction Roles').setColor(0x5865f2)
        .setDescription(rrs.length
          ? rrs.map(rr => `**${rr.type}** — <@&${rr.roleId}> — Emoji: ${rr.emoji} — Msg: \`${rr.messageId.slice(-6)}\``).join('\n')
          : 'Chưa có reaction role nào.'
        );
      await interaction.editReply({ embeds: [embed] });
    }
  }
}

import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

// Item type emoji mapping
const TYPE_EMOJI: Record<string, string> = {
  ROLE: '🎭',
  CUSTOM: '🎁',
};

export default class ShopCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🏪 Cửa Hàng Server')
    .addSubcommand(s => s.setName('list').setDescription('📋 Xem sản phẩm trong cửa hàng'))
    .addSubcommand(s => s.setName('buy').setDescription('💳 Mua sản phẩm — dùng /shop list để xem ID')
      .addIntegerOption(o => o.setName('id').setDescription('ID sản phẩm (số thứ tự hiển thị trong /shop list)').setRequired(true).setMinValue(1))
    )
    .addSubcommand(s => s.setName('add').setDescription('[Admin] Thêm sản phẩm')
      .addStringOption(o => o.setName('name').setDescription('Tên sản phẩm').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Giá (coins)').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('type').setDescription('Loại').setRequired(true).addChoices(
        { name: '🎭 Role', value: 'ROLE' },
        { name: '🎁 Custom', value: 'CUSTOM' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role thưởng (nếu type = Role)'))
      .addStringOption(o => o.setName('description').setDescription('Mô tả sản phẩm'))
      .addIntegerOption(o => o.setName('stock').setDescription('Số lượng (0 = không giới hạn)'))
      .addStringOption(o => o.setName('image').setDescription('URL hình ảnh sản phẩm'))
    )
    .addSubcommand(s => s.setName('remove').setDescription('[Admin] Xóa sản phẩm')
      .addStringOption(o => o.setName('name').setDescription('Tên sản phẩm').setRequired(true))
    )
    .addSubcommand(s => s.setName('edit').setDescription('[Admin] Chỉnh sửa sản phẩm')
      .addStringOption(o => o.setName('name').setDescription('Tên sản phẩm').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Giá mới'))
      .addIntegerOption(o => o.setName('stock').setDescription('Số lượng mới'))
      .addBooleanOption(o => o.setName('enabled').setDescription('Bật/Tắt'))
      .addStringOption(o => o.setName('image').setDescription('URL hình ảnh mới (hoặc "none" để xóa)'))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);

    // ─── LIST ────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const items = await kernel.db.shopItem.findMany({
        where: { guildId, enabled: true },
        orderBy: { price: 'asc' },
      });

      if (!items.length) {
        return void interaction.reply({
          content: '🏪 Cửa hàng đang trống. Admin dùng `/shop add` để thêm sản phẩm.',
          ephemeral: true,
        });
      }

      // Compact list embed — show numeric #ID + emoji + name + price
      const listLines = items.map((item, idx) => {
        const emoji = TYPE_EMOJI[item.type] ?? '🛒';
        const stock = item.stock !== null ? ` *(${item.stock} còn lại)*` : '';
        return `\`#${idx + 1}\` ${emoji} **${item.name}** — \`${item.price.toLocaleString()} coins\`${stock}`;
      });

      const listEmbed = new EmbedBuilder()
        .setTitle(`🏪 Cửa Hàng — ${interaction.guild!.name}`)
        .setColor(0xf39c12)
        .setDescription(listLines.join('\n'))
        .setFooter({ text: `${items.length} sản phẩm • Chọn sản phẩm bên dưới để xem chi tiết` })
        .setTimestamp();

      // Select menu — each item is an option, value carries index for lookup
      const selectOptions = items.slice(0, 25).map((item, idx) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`#${idx + 1} ${item.name}`)
          .setDescription(`💰 ${item.price.toLocaleString()} coins`)
          .setEmoji(TYPE_EMOJI[item.type] ?? '🛒')
          .setValue(`shop_item:${item.id}`)
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop:detail')
        .setPlaceholder('🔍 Chọn sản phẩm để xem chi tiết...')
        .addOptions(selectOptions);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({ embeds: [listEmbed], components: [row] });

    // ─── BUY ─────────────────────────────────────────────────────────────────
    } else if (sub === 'buy') {
      await interaction.deferReply({ ephemeral: true });
      const itemIndex = interaction.options.getInteger('id', true); // 1-based

      // Fetch all enabled items sorted same as /shop list to resolve index
      const allItems = await kernel.db.shopItem.findMany({
        where: { guildId, enabled: true },
        orderBy: { price: 'asc' },
      });

      const item = allItems[itemIndex - 1]; // convert to 0-based
      if (!item) {
        return void interaction.editReply(
          `❌ Không tìm thấy sản phẩm **#${itemIndex}**. Dùng \`/shop list\` để xem danh sách.`
        );
      }

      if (item.stock !== null && item.stock <= 0) {
        return void interaction.editReply('❌ Sản phẩm này đã hết hàng!');
      }

      const member = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: interaction.user.id } },
      });

      if (!member || member.balance < item.price) {
        return void interaction.editReply(
          `❌ Không đủ tiền! Cần **${item.price.toLocaleString()} coins**, bạn có **${member?.balance.toLocaleString() ?? 0} coins**.`
        );
      }

      await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId: interaction.user.id } },
        data: { balance: { decrement: item.price } },
      });

      if (item.stock !== null) {
        await kernel.db.shopItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
      }

      if (item.type === 'ROLE' && item.roleId) {
        const discordMember = interaction.guild!.members.cache.get(interaction.user.id);
        await discordMember?.roles.add(item.roleId).catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Mua Thành Công!')
        .addFields(
          { name: '🏪 Sản phẩm', value: item.name, inline: true },
          { name: '💰 Đã trả', value: `${item.price.toLocaleString()} coins`, inline: true },
          { name: '💵 Còn lại', value: `${(member.balance - item.price).toLocaleString()} coins`, inline: true },
          {
            name: '🎁 Phần thưởng',
            value: item.type === 'ROLE' && item.roleId ? `<@&${item.roleId}>` : 'Liên hệ admin để nhận thưởng.',
          },
        )
        .setTimestamp();

      if (item.imageUrl) embed.setImage(item.imageUrl);

      await interaction.editReply({ embeds: [embed] });
      kernel.eventBus.emit('economy:transaction', { guildId, userId: interaction.user.id, type: 'SHOP_BUY', amount: item.price });

    // ─── ADD ─────────────────────────────────────────────────────────────────
    } else if (sub === 'add') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const name = interaction.options.getString('name', true);
      const price = interaction.options.getInteger('price', true);
      const type = interaction.options.getString('type', true);
      const role = interaction.options.getRole('role');
      const description = interaction.options.getString('description');
      const stockOpt = interaction.options.getInteger('stock');
      const stock = (stockOpt && stockOpt > 0) ? stockOpt : null;
      const imageUrl = interaction.options.getString('image');

      const existing = await kernel.db.shopItem.findFirst({ where: { guildId, name } });
      if (existing) return void interaction.reply({ content: `❌ Sản phẩm **${name}** đã tồn tại.`, ephemeral: true });

      await kernel.db.shopItem.create({
        data: { guildId, name, price, type, roleId: role?.id ?? null, description: description ?? null, stock, imageUrl },
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Thêm Sản Phẩm Thành Công')
        .addFields(
          { name: '🏷️ Tên', value: name, inline: true },
          { name: '💰 Giá', value: `${price.toLocaleString()} coins`, inline: true },
          { name: '📦 Kho hàng', value: stock ? `${stock}` : '∞ Không giới hạn', inline: true },
          { name: '🎁 Loại', value: type === 'ROLE' && role ? `Role ${role}` : 'Custom', inline: true },
        );

      if (imageUrl) embed.setImage(imageUrl);

      await interaction.reply({ embeds: [embed], ephemeral: true });

    // ─── REMOVE ──────────────────────────────────────────────────────────────
    } else if (sub === 'remove') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const name = interaction.options.getString('name', true);
      const item = await kernel.db.shopItem.findFirst({ where: { guildId, name } });
      if (!item) return void interaction.reply({ content: `❌ Sản phẩm **${name}** không tồn tại.`, ephemeral: true });
      await kernel.db.shopItem.delete({ where: { id: item.id } });
      await interaction.reply({ content: `✅ Đã xóa sản phẩm **${name}**.`, ephemeral: true });

    // ─── EDIT ────────────────────────────────────────────────────────────────
    } else if (sub === 'edit') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return void interaction.reply({ content: '❌ Cần quyền Manage Server.', ephemeral: true });
      }
      const name = interaction.options.getString('name', true);
      const item = await kernel.db.shopItem.findFirst({ where: { guildId, name } });
      if (!item) return void interaction.reply({ content: `❌ Sản phẩm **${name}** không tồn tại.`, ephemeral: true });

      const price = interaction.options.getInteger('price');
      const stockOpt = interaction.options.getInteger('stock');
      const enabled = interaction.options.getBoolean('enabled');
      const image = interaction.options.getString('image');

      const updates: any = {};
      if (price !== null) updates.price = price;
      if (stockOpt !== null) updates.stock = stockOpt > 0 ? stockOpt : null;
      if (enabled !== null) updates.enabled = enabled;
      if (image !== null) updates.imageUrl = image === 'none' ? null : image;

      await kernel.db.shopItem.update({ where: { id: item.id }, data: updates });
      await interaction.reply({ content: `✅ Đã cập nhật sản phẩm **${name}**.`, ephemeral: true });
    }
  }
}

import {
  Interaction, StringSelectMenuInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class ShopInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    // ─── Select Menu: shop detail ─────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop:detail') {
      await this.handleDetailSelect(kernel, interaction as StringSelectMenuInteraction);
      return;
    }

    // ─── Button: shop buy confirm ─────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('shop:buy:')) {
      await this.handleBuyConfirm(kernel, interaction);
      return;
    }
  }

  // ── Show item detail embed with image ──────────────────────────────────
  private async handleDetailSelect(kernel: Kernel, interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Value format: "shop_item:<id>"
    const itemId = interaction.values[0].replace('shop_item:', '');
    const item = await kernel.db.shopItem.findUnique({ where: { id: itemId } });

    if (!item || !item.enabled) {
      return void interaction.editReply('❌ Sản phẩm không tồn tại hoặc đã bị tắt.');
    }

    const stockText = item.stock !== null
      ? (item.stock > 0 ? `📦 Còn **${item.stock}** sản phẩm` : '❌ Hết hàng')
      : '∞ Không giới hạn';

    const rewardText = item.type === 'ROLE' && item.roleId
      ? `🎭 Vai trò <@&${item.roleId}>`
      : '🎁 Custom — liên hệ Admin để nhận';

    const embed = new EmbedBuilder()
      .setTitle(`🏪 ${item.name}`)
      .setColor(0xf39c12)
      .setDescription(item.description ?? '*Không có mô tả*')
      .addFields(
        { name: '💰 Giá', value: `\`${item.price.toLocaleString()} coins\``, inline: true },
        { name: '📦 Kho hàng', value: stockText, inline: true },
        { name: '🎁 Phần thưởng', value: rewardText, inline: false },
      )
      .setFooter({ text: 'Nhấn Mua Ngay để xác nhận mua hàng' })
      .setTimestamp();

    // Show image full-size if available
    if (item.imageUrl) {
      embed.setImage(item.imageUrl);
    }

    // Buy button — disabled if out of stock
    const outOfStock = item.stock !== null && item.stock <= 0;
    const buyBtn = new ButtonBuilder()
      .setCustomId(`shop:buy:${item.id}`)
      .setLabel(outOfStock ? '❌ Hết Hàng' : '💳 Mua Ngay')
      .setStyle(outOfStock ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(outOfStock);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buyBtn);

    await interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── Handle buy button confirm ──────────────────────────────────────────
  private async handleBuyConfirm(kernel: Kernel, interaction: any): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const itemId = interaction.customId.replace('shop:buy:', '');
    const guildId = interaction.guildId!;

    const item = await kernel.db.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.enabled) {
      return void interaction.editReply('❌ Sản phẩm không còn khả dụng.');
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

    // Deduct balance
    await kernel.db.guildMember.update({
      where: { guildId_userId: { guildId, userId: interaction.user.id } },
      data: { balance: { decrement: item.price } },
    });

    // Reduce stock
    if (item.stock !== null) {
      await kernel.db.shopItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
    }

    // Give role
    if (item.type === 'ROLE' && item.roleId) {
      const discordMember = interaction.guild!.members.cache.get(interaction.user.id);
      await discordMember?.roles.add(item.roleId).catch(() => {});
    }

    // Log purchase
    await kernel.db.itemPurchase.create({
      data: { itemId: item.id, guildId, userId: interaction.user.id },
    });

    const resultEmbed = new EmbedBuilder()
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

    if (item.imageUrl) resultEmbed.setImage(item.imageUrl);

    await interaction.editReply({ embeds: [resultEmbed], components: [] });

    kernel.eventBus.emit('economy:transaction', {
      guildId, userId: interaction.user.id, type: 'SHOP_BUY', amount: item.price,
    });
  }
}

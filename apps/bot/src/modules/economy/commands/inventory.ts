import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

const TYPE_EMOJI: Record<string, string> = {
  ROLE: '🎭',
  CUSTOM: '🎁',
};

export default class InventoryCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Kho đồ cá nhân của bạn');

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);
    
    // Defer immediately!
    await interaction.deferReply();

    const purchases = await kernel.db.itemPurchase.findMany({
      where: { guildId, userId: interaction.user.id },
      include: { item: true }
    });

    const generalShopItems = await kernel.db.shopItem.findMany({
      where: { guildId, category: 'GENERAL', enabled: true },
      orderBy: { price: 'asc' },
    });

    const ringShopItems = await kernel.db.shopItem.findMany({
      where: { guildId, category: 'RING', enabled: true },
      orderBy: { price: 'asc' },
    });

    const formatLine = (p: any, shopItems: any[]) => {
      const idx = shopItems.findIndex(x => x.id === p.item.id);
      const displayId = idx !== -1 ? String(idx + 1).padStart(2, '0') : 'N/A';
      const emoji = p.item.emoji || TYPE_EMOJI[p.item.type] || '🛒';
      return `${emoji} **${p.item.name}** (x${p.quantity}) - ID sản phẩm: \`#${displayId}\``;
    };

    const generalPurchases = purchases.filter(p => p.item.category === 'GENERAL');
    const ringPurchases = purchases.filter(p => p.item.category === 'RING');

    const embed = new EmbedBuilder()
      .setColor(0xff7bb5)
      .setTitle(`🎒 Kho Đồ Cá Nhân — ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const generalLines = generalPurchases.map(p => formatLine(p, generalShopItems)).join('\n');
    const ringLines = ringPurchases.map(p => formatLine(p, ringShopItems)).join('\n');

    embed.addFields(
      { name: '📦 Kho Đồ Vật Phẩm', value: generalLines || '*Trống*', inline: false },
      { name: '💍 Kho Đồ Nhẫn Cưới', value: ringLines || '*Trống*', inline: false }
    );

    await interaction.editReply({ embeds: [embed] });
  }
}

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
    await interaction.deferReply();

    const purchases = await kernel.db.itemPurchase.findMany({
      where: { guildId, userId: interaction.user.id },
      include: { item: true }
    });

    const allItems = await kernel.db.shopItem.findMany({
      where: { guildId },
      orderBy: [{ category: 'asc' }, { price: 'asc' }],
    });

    const generalPurchases = purchases.filter(p => p.item.category === 'GENERAL');
    const ringPurchases = purchases.filter(p => p.item.category === 'RING');

    const formatLine = (p: any) => {
      const displayId = allItems.findIndex(x => x.id === p.item.id) + 1;
      const emoji = p.item.emoji || TYPE_EMOJI[p.item.type] || '🛒';
      const idStr = displayId > 0 ? `#${displayId}` : 'N/A';
      return `${emoji} **${p.item.name}** (x${p.quantity}) - ID sản phẩm: \`${idStr}\``;
    };

    const embed = new EmbedBuilder()
      .setColor(0xff7bb5)
      .setTitle(`🎒 Kho Đồ Cá Nhân — ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const generalLines = generalPurchases.map(formatLine).join('\n');
    const ringLines = ringPurchases.map(formatLine).join('\n');

    embed.addFields(
      { name: '📦 Vật Phẩm Sở Hữu', value: generalLines || '*Trống*', inline: false },
      { name: '💍 Nhẫn Cưới Sở Hữu', value: ringLines || '*Trống*', inline: false }
    );

    await interaction.editReply({ embeds: [embed] });
  }
}

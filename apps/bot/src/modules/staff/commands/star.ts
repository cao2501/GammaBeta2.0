import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';

export default class StarCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('star')
    .setDescription('⭐ Xem bảng xếp hạng Star Top dựa trên tổng số giờ được thuê');

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);

    await interaction.deferReply();

    const staffs = await kernel.db.staff.findMany({
      where: { guildId },
      orderBy: { allTimeHours: 'desc' }
    });

    if (staffs.length === 0) {
      return void interaction.editReply('📭 Chưa có nhân viên nào trong bảng xếp hạng.');
    }

    const embeds: EmbedBuilder[] = [];

    // Show top 5 stars
    const limit = Math.min(staffs.length, 5);
    for (let i = 0; i < limit; i++) {
      const staff = staffs[i];
      const rank = i + 1;

      let displayName = staff.name;
      let footerAvatar = staff.avatarUrl || interaction.user.displayAvatarURL();

      if (staff.userId) {
        const member = await interaction.guild!.members.fetch(staff.userId).catch(() => null);
        if (member) {
          displayName = member.displayName;
          footerAvatar = member.user.displayAvatarURL({ size: 128 });
        } else {
          const u = await kernel.client.users.fetch(staff.userId).catch(() => null);
          if (u) {
            displayName = u.displayName || u.username;
            footerAvatar = u.displayAvatarURL({ size: 128 });
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(staff.borderColor as any || '#ffc0cb')
        .setTitle('STAR')
        .setDescription(
          `👾 **Star Top ${rank}**\n` +
          `${displayName}\n\n` +
          `💰 **Số Giờ**\n` +
          `${staff.allTimeHours}h`
        )
        .setFooter({ text: displayName, iconURL: footerAvatar })
        .setTimestamp();

      if (staff.avatarUrl) {
        embed.setThumbnail(staff.avatarUrl);
      }

      embeds.push(embed);
    }

    await interaction.editReply({ embeds });
  }
}

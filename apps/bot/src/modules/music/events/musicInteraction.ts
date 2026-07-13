import { Interaction, GuildMember, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { musicManager } from '../services/MusicManager';
import { logger } from '../../../core/logger/Logger';

export default class MusicInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('music:search:select:')) return;

    const [, , , targetUserId] = customId.split(':');

    // Only allow the user who performed the search to make a selection
    if (interaction.user.id !== targetUserId) {
      return void interaction.reply({
        content: '❌ Bạn không phải là người thực hiện tìm kiếm này!',
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channelId) {
      return void interaction.reply({
        content: '❌ Bạn cần phải ở trong kênh voice mới chọn được nhạc!',
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    const selectedUrl = interaction.values[0];
    const guildId = interaction.guildId!;

    try {
      const track = await musicManager.play(
        guildId,
        member.voice.channelId,
        selectedUrl,
        interaction.user.tag,
        interaction.channel as any
      );

      if (!track) {
        return void interaction.editReply({
          content: '❌ Không thể tìm thấy hoặc phát bài hát này. Hãy thử lại.',
          components: []
        });
      }

      const queue = musicManager.getQueue(guildId);
      const isQueueing = queue && queue.tracks.length > 1;

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setDescription(`🎶 Đã chọn bài: [**${track.title}**](${track.url})`)
        .setTimestamp();

      if (isQueueing) {
        embed.setTitle('✅ Thêm vào Queue')
             .addFields(
               { name: '📋 Vị trí', value: `#${queue.tracks.length}`, inline: true },
               { name: '⏱️ Độ dài', value: track.duration, inline: true }
             );
        if (track.thumbnail) {
          embed.setThumbnail(track.thumbnail);
        }
      } else {
        embed.setTitle('▶️ Đang Chuẩn Bị Phát');
      }

      // Update response, clearing the select menu component
      await interaction.editReply({
        embeds: [embed],
        components: []
      });

    } catch (err: any) {
      logger.error('Error in music select menu interaction:', err);
      await interaction.editReply({
        content: `❌ Lỗi khi tải nhạc: ${err.message}`,
        components: []
      }).catch(() => {});
    }
  }
}

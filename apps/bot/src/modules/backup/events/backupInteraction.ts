import { Interaction, Guild, EmbedBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { logger } from '../../../core/logger/Logger';

export default class BackupInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('backup:restore:')) return;

    const parts = interaction.customId.split(':');
    const action = parts[2]; // confirm or cancel
    const backupId = parts[3];

    // Ensure the interaction is from an admin
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return void interaction.reply({ content: '❌ Bạn cần có quyền Administrator để thực hiện hành động này.', ephemeral: true });
    }

    if (action === 'cancel') {
      return void interaction.update({ content: '❌ Đã hủy bỏ việc khôi phục server.', embeds: [], components: [] });
    }

    if (action === 'confirm') {
      // Defer update so discord doesn't timeout
      await interaction.update({ content: '🔄 Đang chuẩn bị khôi phục server, vui lòng đợi...', embeds: [], components: [] });

      const guild = interaction.guild;
      if (!guild) return;

      const backup = await kernel.db.guildBackup.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        return void interaction.followUp({ content: '❌ Không tìm thấy bản sao lưu để khôi phục.', ephemeral: true });
      }

      try {
        const backupData = JSON.parse(backup.data);
        await this.performRestore(guild, backupData);
        logger.info(`Server backup restore completed for guild ${guild.name} (${guild.id})`);
      } catch (err: any) {
        logger.error(`Error during backup restore for guild ${guild.id}`, { error: err });
        try {
          await interaction.followUp({ content: `❌ Đã xảy ra lỗi trong quá trình khôi phục: ${err.message}`, ephemeral: true });
        } catch {}
      }
    }
  }

  private async performRestore(guild: Guild, backupData: any): Promise<void> {
    // 1. Restore Roles (Map old role ID -> new role ID)
    const roleMap = new Map<string, string>();
    
    // Sort roles by position to keep order as much as possible
    const sortedRoles = [...backupData.roles].sort((a: any, b: any) => a.position - b.position);
    
    for (const r of sortedRoles) {
      if (r.isEveryone) {
        const everyoneRole = guild.roles.everyone;
        await everyoneRole.setPermissions(BigInt(r.permissions)).catch(() => {});
        roleMap.set(r.id, everyoneRole.id);
      } else {
        try {
          const newRole = await guild.roles.create({
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            permissions: BigInt(r.permissions),
            mentionable: r.mentionable,
            reason: 'Restore Backup'
          });
          roleMap.set(r.id, newRole.id);
        } catch (err) {
          logger.error(`Failed to restore role ${r.name}`, { error: err });
        }
      }
    }

    // 2. Create a temporary channel so the guild is never without channels
    const tempChannel = await guild.channels.create({
      name: 'dang-khoi-phuc-server',
      type: ChannelType.GuildText,
      reason: 'Temporary channel during backup restore'
    });

    // Delete all existing channels except the temporary one
    const channelsToDelete = guild.channels.cache.filter(c => c.id !== tempChannel.id);
    for (const [, c] of channelsToDelete) {
      await c.delete('Restore Backup').catch(() => {});
    }

    // 3. Restore Category Channels first
    const categoryMap = new Map<string, string>(); // old parentId -> new parentId
    const categories = backupData.channels.filter((c: any) => c.type === ChannelType.GuildCategory);
    
    for (const cat of categories) {
      try {
        const newCat = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          position: cat.position,
          permissionOverwrites: cat.permissionOverwrites.map((o: any) => ({
            id: roleMap.get(o.id) || o.id,
            type: o.type,
            allow: BigInt(o.allow),
            deny: BigInt(o.deny)
          })),
          reason: 'Restore Backup'
        });
        categoryMap.set(cat.id, newCat.id);
      } catch (err) {
        logger.error(`Failed to restore category category ${cat.name}`, { error: err });
      }
    }

    // 4. Restore Text, Voice and other channels
    const nonCategories = backupData.channels.filter((c: any) => c.type !== ChannelType.GuildCategory);
    for (const ch of nonCategories) {
      try {
        const newParentId = ch.parentId ? categoryMap.get(ch.parentId) : null;
        
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: newParentId || undefined,
          position: ch.position,
          topic: ch.topic || undefined,
          nsfw: ch.nsfw || false,
          rateLimitPerUser: ch.rateLimitPerUser || 0,
          permissionOverwrites: ch.permissionOverwrites.map((o: any) => ({
            id: roleMap.get(o.id) || o.id,
            type: o.type,
            allow: BigInt(o.allow),
            deny: BigInt(o.deny)
          })),
          reason: 'Restore Backup'
        });
      } catch (err) {
        logger.error(`Failed to restore channel ${ch.name}`, { error: err });
      }
    }

    // Delete the temporary channel
    await tempChannel.delete('Restore Backup completed').catch(() => {});
  }
}

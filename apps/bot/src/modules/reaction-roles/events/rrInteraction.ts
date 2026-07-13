import { Interaction, GuildMember } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';

export default class ReactionRoleInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('rr:')) return;

    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member as GuildMember;
    if (!member) return;

    if (interaction.isButton()) {
      const [, type, roleId] = customId.split(':');
      const role = interaction.guild!.roles.cache.get(roleId!);
      if (!role) return void (interaction as any).editReply('❌ Role không tồn tại.');

      const hasRole = member.roles.cache.has(roleId!);

      if (type === 'UNIQUE') {
        // Remove all other RR roles first
        const allRR = await kernel.db.reactionRole.findMany({
          where: { guildId: interaction.guildId!, type: 'UNIQUE' }
        });
        for (const rr of allRR) {
          if (rr.roleId !== roleId && member.roles.cache.has(rr.roleId)) {
            await member.roles.remove(rr.roleId).catch(() => {});
          }
        }
        await member.roles.add(roleId!).catch(() => {});
        await (interaction as any).editReply(`✅ Bạn đã nhận role **${role.name}**.`);
      } else if (type === 'TOGGLE' || type === 'NORMAL') {
        if (hasRole) {
          await member.roles.remove(roleId!);
          await (interaction as any).editReply(`✅ Đã bỏ role **${role.name}**.`);
        } else {
          await member.roles.add(roleId!);
          await (interaction as any).editReply(`✅ Bạn đã nhận role **${role.name}**.`);
        }
      }
    } else if (interaction.isStringSelectMenu() && customId === 'rr:dropdown:select') {
      const selected = interaction.values;
      const allRoleIds = interaction.component.options.map((o: any) => o.value);

      const added: string[] = [];
      const removed: string[] = [];

      for (const roleId of allRoleIds) {
        if (selected.includes(roleId)) {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
            const role = interaction.guild!.roles.cache.get(roleId);
            if (role) added.push(role.name);
          }
        } else {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
            const role = interaction.guild!.roles.cache.get(roleId);
            if (role) removed.push(role.name);
          }
        }
      }

      const parts: string[] = [];
      if (added.length) parts.push(`✅ Thêm: **${added.join(', ')}**`);
      if (removed.length) parts.push(`❌ Bỏ: **${removed.join(', ')}**`);
      await (interaction as any).editReply(parts.join('\n') || 'ℹ️ Không có thay đổi.');
    }
  }
}

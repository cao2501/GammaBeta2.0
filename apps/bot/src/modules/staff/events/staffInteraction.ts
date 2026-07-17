import { Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, TextChannel } from 'discord.js';
import { IEvent } from '../../../core/interfaces/IEvent';
import { Kernel } from '../../../core/Kernel';
import { buildStaffEmbed } from '../module';
import { ReactBillManager } from '../reactBillManager';
import { getModuleConfig } from '../../../database/helpers';

export default class StaffInteractionEvent implements IEvent<'interactionCreate'> {
  name = 'interactionCreate' as const;

  async execute(kernel: Kernel, interaction: Interaction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. STAFF PROFILE PHOTO PAGINATION
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && (interaction.customId.startsWith('staff:prev:') || interaction.customId.startsWith('staff:next:'))) {
      const parts = interaction.customId.split(':');
      const action = parts[1];
      const staffId = parseInt(parts[2], 10);
      const currentIndex = parseInt(parts[3], 10);

      const staff = await kernel.db.staff.findUnique({
        where: { id: staffId }
      });

      if (!staff) return;

      const images = JSON.parse(staff.images || '[]');
      if (images.length <= 1) return;

      let newIndex = currentIndex;
      if (action === 'prev') {
        newIndex = currentIndex - 1 < 0 ? images.length - 1 : currentIndex - 1;
      } else if (action === 'next') {
        newIndex = currentIndex + 1 >= images.length ? 0 : currentIndex + 1;
      }

      const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
      const pricing = {
        priceDay: staffConfig?.priceDay ?? 100000,
        priceNight: staffConfig?.priceNight ?? 120000
      };

      const { embed, row } = buildStaffEmbed(staff, newIndex, pricing);
      return void interaction.update({
        embeds: [embed],
        components: row ? [row] : []
      }).catch(() => {});
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SIMPLE REGISTRY (/react) AND LINKED REACT BILL (/reactbill)
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('reactbill:')) {
      const parts = interaction.customId.split(':');
      const action = parts[1]; // join, leave, random, refresh
      const isSimple = parts[2] === 'simple';
      const billId = isSimple ? parts[3] : parts[2];

      const bill = ReactBillManager.getBill(billId);
      if (!bill) {
        return void interaction.reply({ content: '❌ Bảng đăng ký này đã hết hạn hoặc không tồn tại trong bộ nhớ.', ephemeral: true });
      }

      const userId = interaction.user.id;

      // Handle simple join/leave
      if (isSimple) {
        if (action === 'join') {
          if (bill.participants.includes(userId)) {
            return void interaction.reply({ content: '💡 Bạn đã đăng ký trong danh sách này rồi.', ephemeral: true });
          }
          bill.participants.push(userId);
        } else if (action === 'leave') {
          if (!bill.participants.includes(userId)) {
            return void interaction.reply({ content: '💡 Bạn chưa đăng ký trong danh sách này.', ephemeral: true });
          }
          bill.participants = bill.participants.filter(id => id !== userId);
        }

        // Update the simple embed
        const pList = bill.participants.length > 0
          ? bill.participants.map((id, i) => `${String(i + 1).padStart(2, '0')}. <@${id}>`).join('\n')
          : '*(Chưa có ai đăng ký)*';

        const newEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setDescription(`${bill.description || ''}\n\n**Danh sách React:**\n${pList}`)
          .setTimestamp();

        await interaction.update({ content: bill.title, embeds: [newEmbed] });
        return;
      }

      // Handle advanced Linked React Bill (reactbill:join, reactbill:leave, reactbill:random, reactbill:refresh)
      if (action === 'join') {
        // Validate clicking user has staff profile
        const staff = await kernel.db.staff.findFirst({
          where: { guildId, userId }
        });

        if (!staff) {
          return void interaction.reply({
            content: '❌ Bạn không có hồ sơ nhân viên hoặc khách VIP trong hệ thống để tham gia ghép bill này.',
            ephemeral: true
          });
        }

        if (bill.participants.includes(userId)) {
          return void interaction.reply({ content: '💡 Bạn đã đăng ký trong danh sách ghép bill này rồi.', ephemeral: true });
        }

        bill.participants.push(userId);
        await interaction.reply({ content: '✅ Đăng ký ghép bill thành công!', ephemeral: true });
        await updateManagerMessage(kernel, bill);
        return;

      } else if (action === 'leave') {
        if (!bill.participants.includes(userId)) {
          return void interaction.reply({ content: '💡 Bạn chưa đăng ký trong danh sách ghép bill này.', ephemeral: true });
        }

        bill.participants = bill.participants.filter(id => id !== userId);
        await interaction.reply({ content: '✅ Đã hủy đăng ký ghép bill thành công.', ephemeral: true });
        await updateManagerMessage(kernel, bill);
        return;

      } else if (action === 'refresh') {
        await interaction.deferUpdate();
        await updateManagerMessage(kernel, bill);
        return;

      } else if (action === 'random') {
        if (bill.participants.length === 0) {
          return void interaction.reply({ content: '❌ Chưa có nhân viên nào đăng ký vào danh sách này.', ephemeral: true });
        }

        await interaction.deferReply();
        const randId = bill.participants[Math.floor(Math.random() * bill.participants.length)];
        const staff = await kernel.db.staff.findFirst({
          where: { guildId, userId: randId }
        });

        if (!staff) {
          return void interaction.editReply('❌ Không thể tải hồ sơ của nhân viên được chọn ngẫu nhiên.');
        }

        const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
        const pricing = {
          priceDay: staffConfig?.priceDay ?? 100000,
          priceNight: staffConfig?.priceNight ?? 120000
        };

        const { embed, row } = buildStaffEmbed(staff, 0, pricing);
        await interaction.editReply({
          content: `🎲 **Nhân viên được chọn ngẫu nhiên:** <@${randId}>`,
          embeds: [embed],
          components: row ? [row] : []
        });
        return;
      }
    }

    // Select Menu Interaction: select player profile
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('reactbill:select:')) {
      const parts = interaction.customId.split(':');
      const billId = parts[2];
      const bill = ReactBillManager.getBill(billId);

      if (!bill) {
        return void interaction.reply({ content: '❌ Bảng quản lý bill này đã hết hạn hoặc không tồn tại.', ephemeral: true });
      }

      const selectedUserId = interaction.values[0];
      if (selectedUserId === 'placeholder') {
        return void interaction.reply({ content: '❌ Lựa chọn không hợp lệ.', ephemeral: true });
      }

      await interaction.deferReply();

      const staff = await kernel.db.staff.findFirst({
        where: { guildId, userId: selectedUserId }
      });

      if (!staff) {
        return void interaction.editReply('❌ Không tìm thấy hồ sơ của nhân viên này.');
      }

      const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
      const pricing = {
        priceDay: staffConfig?.priceDay ?? 100000,
        priceNight: staffConfig?.priceNight ?? 120000
      };

      const { embed, row } = buildStaffEmbed(staff, 0, pricing);
      await interaction.editReply({
        content: `👤 **Hồ sơ nhân viên:** <@${selectedUserId}>`,
        embeds: [embed],
        components: row ? [row] : []
      });
    }
  }
}

// Helper to update the admin manager message with the list and Select Menu dropdown
async function updateManagerMessage(kernel: Kernel, bill: any) {
  try {
    const channel = await kernel.client.channels.fetch(bill.managerChannelId).catch(() => null) as TextChannel;
    if (!channel) return;

    const msg = await channel.messages.fetch(bill.managerMessageId).catch(() => null);
    if (!msg) return;

    const listLines = [];
    const selectOptions = [];

    for (let i = 0; i < bill.participants.length; i++) {
      const pId = bill.participants[i];
      const staff = await kernel.db.staff.findFirst({
        where: { guildId: bill.guildId, userId: pId }
      });

      const nickname = staff ? staff.name : pId;
      const indexStr = String(i + 1).padStart(2, '0');
      
      listLines.push(`**${indexStr}.** ${nickname}\n↳ <@${pId}>`);

      // Fill Select Menu Options
      selectOptions.push({
        label: `${indexStr}. ${nickname}`,
        description: staff?.title || undefined,
        value: pId
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`**Danh sách React:**\n\n${listLines.join('\n\n') || '*(Chưa có ai đăng ký)*'}`)
      .setTimestamp();

    // Rebuild components
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`reactbill:select:${bill.id}`)
      .setPlaceholder('Chọn profile player (1-5)');

    if (selectOptions.length > 0) {
      selectMenu.addOptions(selectOptions.slice(0, 25)); // Cap at 25 limit of Discord select menus
      selectMenu.setDisabled(false);
    } else {
      selectMenu.addOptions({ label: 'Chưa có người đăng ký', value: 'placeholder' });
      selectMenu.setDisabled(true);
    }

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`reactbill:random:${bill.id}`)
        .setLabel('Chọn Ngẫu nhiên')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(bill.participants.length === 0),
      new ButtonBuilder()
        .setCustomId(`reactbill:refresh:${bill.id}`)
        .setLabel('Làm mới')
        .setStyle(ButtonStyle.Secondary)
    );

    await msg.edit({
      content: 'REACT BILL',
      embeds: [embed],
      components: [menuRow, btnRow]
    });
  } catch (err) {
    console.error('Failed to update ReactBill Manager Message:', err);
  }
}

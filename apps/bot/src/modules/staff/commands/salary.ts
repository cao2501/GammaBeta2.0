import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild } from '../../../database/helpers';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

export default class SalaryCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('salary')
    .setDescription('💰 Quản lý lương & thanh toán cho nhân viên')
    .addSubcommand(s => s.setName('xemluong').setDescription('Xem chi tiết thống kê thu nhập cá nhân của bạn'))
    .addSubcommand(s => s.setName('tinhluong').setDescription('[Admin] Xem bảng tính lương của toàn bộ nhân viên')
      .addStringOption(o => o.setName('action').setDescription('Hành động').setRequired(true)
        .addChoices(
          { name: 'Xem bảng lương (View)', value: 'VIEW' },
          { name: 'Xuất file Excel/CSV (Export)', value: 'EXPORT' }
        )
      )
    )
    .addSubcommand(s => s.setName('resetluong').setDescription('[Admin] Chốt lương và thanh toán từ ví lương sang VND chính'))
    .addSubcommand(s => s.setName('truluong').setDescription('[Admin] Trừ lương trực tiếp vào ví lương của nhân viên')
      .addStringOption(o => o.setName('key').setDescription('Mã phụ của nhân viên').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Số tiền VND muốn khấu trừ').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('reason').setDescription('Lý do trừ lương'))
    )
    .addSubcommand(s => s.setName('donate').setDescription('💸 Ủng hộ (Donate) tiền VND trực tiếp cho nhân viên')
      .addStringOption(o => o.setName('key').setDescription('Mã phụ của nhân viên muốn donate').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Số tiền VND muốn donate').setRequired(true).setMinValue(1000))
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await ensureGuild(guildId, interaction.guild!.name);

    if (sub === 'xemluong') {
      const staff = await kernel.db.staff.findFirst({
        where: { guildId, userId: interaction.user.id }
      });

      if (!staff) {
        return void interaction.reply({
          content: '❌ Lệnh này chỉ dành cho những nhân viên/VIP đã được đăng ký và liên kết tài khoản Discord trong hệ thống.',
          ephemeral: true
        });
      }

      // Fetch all booking records to calculate breakdowns of hourly sessions
      const bookings = await kernel.db.booking.findMany({
        where: { guildId }
      });

      const staffBookings = bookings.filter(b =>
        b.staffKeys.split(',').map(k => k.trim().toLowerCase()).includes(staff.subKey)
      );

      const hourMap = new Map<number, number>();
      for (const b of staffBookings) {
        hourMap.set(b.hours, (hourMap.get(b.hours) || 0) + 1);
      }

      const hoursBreakdown = Array.from(hourMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([h, count]) => `${h}h(${count})`)
        .join(', ');

      const embed = new EmbedBuilder()
        .setColor(staff.borderColor as any || 0xffc0cb)
        .setTitle(`💰 Bảng Thống Kê Lương — ${staff.name}`)
        .setDescription(`Hồ sơ liên kết: <@${interaction.user.id}> | Mã phụ: \`${staff.subKey}\``)
        .addFields(
          { name: '📊 Thống kê trọn đời (Lifetime)', value: `• **Tổng giờ thuê**: \`${staff.allTimeHours}h\`\n• **Tổng tiền thuê**: \`${staff.allTimeBookingEarnings.toLocaleString('vi-VN')} ₫\`\n• **Tổng tiền donate**: \`${staff.allTimeDonations.toLocaleString('vi-VN')} ₫\`` },
          { name: '⏳ Chu kỳ hiện tại (Current Cycle)', value: `• **Số giờ thuê**: \`${staff.currentHours}h\`\n• **Tiền thuê**: \`${staff.currentBookingEarnings.toLocaleString('vi-VN')} ₫\`\n• **Tiền donate**: \`${staff.currentDonations.toLocaleString('vi-VN')} ₫\`\n• **Tiền bị trừ**: \`${staff.currentDeductions.toLocaleString('vi-VN')} ₫\`` },
          { name: '💼 Chi tiết giờ đặt (Breakdown)', value: hoursBreakdown || '*Chưa có lượt thuê nào*' },
          { name: '👛 Số dư ví lương (Chưa chốt)', value: `**${staff.salaryWallet.toLocaleString('vi-VN')} ₫**` }
        )
        .setFooter({ text: 'Sử dụng ví lương để thanh toán khi đặt lịch bằng cách chọn su_dung_vi_luong: true' })
        .setTimestamp();

      return void interaction.reply({ embeds: [embed] });
    }

    if (sub === 'donate') {
      const key = interaction.options.getString('key', true).trim().toLowerCase();
      const amount = interaction.options.getInteger('amount', true);

      const staff = await kernel.db.staff.findUnique({
        where: { guildId_subKey: { guildId, subKey: key } }
      });

      if (!staff) {
        return void interaction.reply({ content: `❌ Không tìm thấy nhân viên với mã phụ \`${key}\`.`, ephemeral: true });
      }

      // Check donator balance
      const member = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: interaction.user.id } }
      });

      if (!member || member.vnd < amount) {
        return void interaction.reply({
          content: `❌ Số dư VND của bạn không đủ để thực hiện quyên góp. Hiện có: \`${(member?.vnd ?? 0).toLocaleString('vi-VN')} ₫\`, cần: \`${amount.toLocaleString('vi-VN')} ₫\`.`,
          ephemeral: true
        });
      }

      // Execute donate
      await kernel.db.$transaction([
        kernel.db.guildMember.update({
          where: { guildId_userId: { guildId, userId: interaction.user.id } },
          data: { vnd: { decrement: amount } }
        }),
        kernel.db.staff.update({
          where: { id: staff.id },
          data: {
            salaryWallet: { increment: amount },
            currentDonations: { increment: amount },
            allTimeDonations: { increment: amount }
          }
        })
      ]);

      const txIdDonor = SpecialLogger.generateTxId('PAY');
      await SpecialLogger.logVnd(
        kernel,
        guildId,
        interaction.user.id,
        interaction.user.username,
        'PAY',
        amount,
        txIdDonor,
        `Quyên góp (Donate) VND cho nhân viên ${staff.name} (\`${staff.subKey}\`).`
      );

      if (staff.userId) {
        const txIdStaff = SpecialLogger.generateTxId('PAY');
        let staffUsername = staff.name;
        try {
          const u = await kernel.client.users.fetch(staff.userId);
          if (u) staffUsername = u.username;
        } catch {}

        await SpecialLogger.logVnd(
          kernel,
          guildId,
          staff.userId,
          staffUsername,
          'PAY',
          amount,
          txIdStaff,
          `Nhận quyên góp (Donate) từ thành viên <@${interaction.user.id}>.`
        );
      }

      return void interaction.reply({
        content: `💖 Bạn đã quyên góp thành công **${amount.toLocaleString('vi-VN')} ₫** vào ví lương của nhân viên **${staff.name}** (\`${staff.subKey}\`)!`
      });
    }

    // Admin Commands
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return void interaction.reply({ content: '❌ Bạn cần quyền **Manage Server** để sử dụng lệnh quản trị lương.', ephemeral: true });
    }

    if (sub === 'tinhluong') {
      const action = interaction.options.getString('action', true);
      const staffs = await kernel.db.staff.findMany({
        where: { guildId },
        orderBy: { subKey: 'asc' }
      });

      if (staffs.length === 0) {
        return void interaction.reply({ content: '📭 Chưa có nhân viên nào được đăng ký.', ephemeral: true });
      }

      if (action === 'VIEW') {
        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`📊 Bảng Tính Lương Chu Kỳ Hiện Tại - ${interaction.guild!.name}`)
          .setDescription('Thống kê thu nhập tạm tính của nhân viên kể từ lần chốt lương trước:')
          .setTimestamp();

        for (const s of staffs) {
          embed.addFields({
            name: `👤 ${s.name} (\`${s.subKey}\`)`,
            value: `• Giờ thuê: \`${s.currentHours}h\`\n• Tiền thuê: \`${s.currentBookingEarnings.toLocaleString('vi-VN')} ₫\`\n• Donate: \`${s.currentDonations.toLocaleString('vi-VN')} ₫\`\n• Phạt/Trừ: \`-${s.currentDeductions.toLocaleString('vi-VN')} ₫\`\n• **Thực nhận (Ví lương)**: **${s.salaryWallet.toLocaleString('vi-VN')} ₫**`
          });
        }

        return void interaction.reply({ embeds: [embed] });
      } else if (action === 'EXPORT') {
        let csvContent = '\uFEFF'; // Force UTF-8 encoding (BOM) in Excel
        csvContent += 'Mã nhân viên,Họ tên,Số giờ thuê,Doanh thu thuê,Quyên góp (Donate),Lương bị trừ,Thực nhận (Ví lương)\n';

        for (const s of staffs) {
          csvContent += `"${s.subKey}","${s.name}",${s.currentHours},${s.currentBookingEarnings},${s.currentDonations},${s.currentDeductions},${s.salaryWallet}\n`;
        }

        const buffer = Buffer.from(csvContent, 'utf-8');
        const file = new AttachmentBuilder(buffer, { name: `Bảng_lương_${interaction.guild!.name}_${new Date().toISOString().split('T')[0]}.csv` });

        return void interaction.reply({
          content: `📊 Đã xuất thành công bảng lương chu kỳ hiện tại của **${staffs.length}** nhân viên dưới dạng tệp CSV.`,
          files: [file]
        });
      }
    }

    if (sub === 'truluong') {
      const key = interaction.options.getString('key', true).trim().toLowerCase();
      const amount = interaction.options.getInteger('amount', true);
      const reason = interaction.options.getString('reason') ?? 'Không có lý do';

      const staff = await kernel.db.staff.findUnique({
        where: { guildId_subKey: { guildId, subKey: key } }
      });

      if (!staff) {
        return void interaction.reply({ content: `❌ Không tìm thấy nhân viên với mã phụ \`${key}\`.`, ephemeral: true });
      }

      await kernel.db.staff.update({
        where: { id: staff.id },
        data: {
          salaryWallet: { decrement: amount },
          currentDeductions: { increment: amount }
        }
      });

      if (staff.userId) {
        const txId = SpecialLogger.generateTxId('ADM');
        let staffUsername = staff.name;
        try {
          const u = await kernel.client.users.fetch(staff.userId);
          if (u) staffUsername = u.username;
        } catch {}

        await SpecialLogger.logVnd(
          kernel,
          guildId,
          staff.userId,
          staffUsername,
          'ADMIN_REMOVE',
          amount,
          txId,
          `Khấu trừ ví lương (Trừ lương). Lý do: ${reason}.`
        );
      }

      return void interaction.reply({
        content: `✅ Đã khấu trừ **${amount.toLocaleString('vi-VN')} ₫** trực tiếp vào ví lương của **${staff.name}** (\`${staff.subKey}\`). Lý do: *${reason}*.`
      });
    }

    if (sub === 'resetluong') {
      await interaction.deferReply();

      const staffs = await kernel.db.staff.findMany({
        where: { guildId }
      });

      let payoutCount = 0;
      let totalPayoutAmount = 0;

      for (const staff of staffs) {
        const salary = staff.salaryWallet;

        // If staff is linked to a user, pay out salary to their guildMember VND balance
        if (salary > 0 && staff.userId) {
          await kernel.db.guildMember.update({
            where: { guildId_userId: { guildId, userId: staff.userId } },
            data: { vnd: { increment: salary } }
          });

          const txIdPayout = SpecialLogger.generateTxId('PAY');
          let staffUsername = staff.name;
          try {
            const u = await kernel.client.users.fetch(staff.userId);
            if (u) staffUsername = u.username;
          } catch {}

          await SpecialLogger.logVnd(
            kernel,
            guildId,
            staff.userId,
            staffUsername,
            'PAY',
            salary,
            txIdPayout,
            `Chốt lương chu kỳ: Chuyển toàn bộ số dư ví lương (${salary.toLocaleString('vi-VN')} ₫) sang số dư VND chính.`
          );

          payoutCount++;
          totalPayoutAmount += salary;
        }

        // Reset cycle stats for all staff members
        await kernel.db.staff.update({
          where: { id: staff.id },
          data: {
            salaryWallet: 0,
            currentHours: 0,
            currentBookingEarnings: 0,
            currentDonations: 0,
            currentDeductions: 0
          }
        });
      }

      return void interaction.editReply({
        content: `✅ Đã hoàn tất chốt lương và reset chu kỳ thành công!\n💰 Tổng cộng đã thực hiện thanh toán **${totalPayoutAmount.toLocaleString('vi-VN')} ₫** cho **${payoutCount}** nhân viên được liên kết tài khoản.`
      });
    }
  }
}

import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, TextChannel
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';
import { ensureGuild, getModuleConfig } from '../../../database/helpers';
import { SpecialLogger } from '../../../core/logger/SpecialLogger';

export default class BookCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('book')
    .setDescription('🎮 Thuê nhân viên và VIP theo giờ')
    .addUserOption(o => o.setName('khach_hang').setDescription('Khách hàng thực hiện thanh toán (trừ tiền VND)').setRequired(true))
    .addStringOption(o => o.setName('nhan_vien').setDescription('Tag @nhân_viên hoặc nhập mã phụ (cách nhau bởi dấu phẩy, ví dụ: @Nam, k2)').setRequired(true))
    .addIntegerOption(o => o.setName('so_gio').setDescription('Số giờ muốn thuê').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('loai_gia').setDescription('Mức giá áp dụng').setRequired(true)
      .addChoices(
        { name: 'Ngày (Day rate)', value: 'DAY' },
        { name: 'Đêm (Night rate)', value: 'NIGHT' }
      )
    )
    .addIntegerOption(o => o.setName('them_nguoi').setDescription('Số người đi kèm thêm'))
    .addBooleanOption(o => o.setName('server_rieng').setDescription('Thuê về server riêng?'))
    .addBooleanOption(o => o.setName('su_dung_vi_luong').setDescription('Sử dụng ví lương để thanh toán (chỉ khả dụng nếu khách là nhân viên)'));

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const guildId = interaction.guildId!;
    await ensureGuild(guildId, interaction.guild!.name);

    await interaction.deferReply();

    const customer = interaction.options.getUser('khach_hang', true);
    const staffKeysRaw = interaction.options.getString('nhan_vien', true);
    const hours = interaction.options.getInteger('so_gio', true);
    const rateType = interaction.options.getString('loai_gia', true);
    const additionalPeople = interaction.options.getInteger('them_nguoi') ?? 0;
    const privateServer = interaction.options.getBoolean('server_rieng') ?? false;
    const useSalaryWallet = interaction.options.getBoolean('su_dung_vi_luong') ?? false;

    // 1. Parse and validate staff keys / mentions
    const tokens = staffKeysRaw.split(',').map(k => k.trim()).filter(Boolean);
    if (tokens.length === 0) {
      return void interaction.editReply('❌ Danh sách nhân viên không hợp lệ.');
    }

    const staffs = [];
    for (const token of tokens) {
      const mentionMatch = token.match(/^<@!?(\d+)>$/);
      let staff: any = null;

      if (mentionMatch) {
        const userId = mentionMatch[1];
        staff = await kernel.db.staff.findFirst({
          where: { guildId, userId }
        });
      } else {
        const subKey = token.toLowerCase();
        staff = await kernel.db.staff.findUnique({
          where: { guildId_subKey: { guildId, subKey } }
        });
      }

      if (!staff) {
        return void interaction.editReply(`❌ Không tìm thấy hồ sơ của nhân viên ứng với \`${token}\`. Vui lòng tag đúng tài khoản hoặc gõ đúng mã phụ.`);
      }
      staffs.push(staff);
    }

    const staffKeys = staffs.map(s => s.subKey);

    // 2. Fetch booking config for pricing variables
    const { config: staffConfig } = await getModuleConfig<any>(guildId, 'staff');
    const serverCommission = staffConfig?.serverCommission ?? 10; // Commission percentage (e.g. 10%)
    const extraPersonFee = staffConfig?.extraPersonFee ?? 50000;
    const minPeopleForExtraFee = staffConfig?.minPeopleForExtraFee ?? 2;
    const globalPriceDay = staffConfig?.priceDay ?? 100000;
    const globalPriceNight = staffConfig?.priceNight ?? 120000;

    // 3. Calculate cost
    const rate = rateType === 'DAY' ? globalPriceDay : globalPriceNight;
    const baseStaffCost = rate * hours * staffs.length;

    let extraPeopleFee = 0;
    if (additionalPeople > minPeopleForExtraFee) {
      const extraPeopleCount = additionalPeople - minPeopleForExtraFee;
      extraPeopleFee = extraPeopleCount * extraPersonFee;
    }

    const totalCost = baseStaffCost + extraPeopleFee;

    // 4. Validate customer wallet/salary balance
    let customerStaffProfile: any = null;
    if (useSalaryWallet) {
      customerStaffProfile = await kernel.db.staff.findFirst({
        where: { guildId, userId: customer.id }
      });
      if (!customerStaffProfile) {
        return void interaction.editReply(`❌ Tài khoản **${customer.username}** không phải nhân viên/VIP trong hệ thống nên không thể sử dụng ví lương.`);
      }
      if (customerStaffProfile.salaryWallet < totalCost) {
        return void interaction.editReply(`❌ Số dư ví lương của **${customer.username}** không đủ để thanh toán. Hiện có: \`${customerStaffProfile.salaryWallet.toLocaleString('vi-VN')} ₫\`, cần: \`${totalCost.toLocaleString('vi-VN')} ₫\`.`);
      }
    } else {
      const customerMember = await kernel.db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: customer.id } }
      });
      const customerBalance = customerMember?.vnd ?? 0;
      if (customerBalance < totalCost) {
        return void interaction.editReply(`❌ Số dư VND của **${customer.username}** không đủ để thanh toán. Hiện có: \`${customerBalance.toLocaleString('vi-VN')} ₫\`, cần: \`${totalCost.toLocaleString('vi-VN')} ₫\`.`);
      }
    }

    // 5. Execute transaction updates
    const txIdCustomer = SpecialLogger.generateTxId('PAY');
    
    // Deduct customer
    if (useSalaryWallet && customerStaffProfile) {
      await kernel.db.staff.update({
        where: { id: customerStaffProfile.id },
        data: {
          salaryWallet: { decrement: totalCost },
          currentDeductions: { increment: totalCost }
        }
      });
    } else {
      await kernel.db.guildMember.update({
        where: { guildId_userId: { guildId, userId: customer.id } },
        data: { vnd: { decrement: totalCost } }
      });
    }

    // Log customer deduction
    await SpecialLogger.logVnd(
      kernel,
      guildId,
      customer.id,
      customer.username,
      'PAY',
      totalCost,
      txIdCustomer,
      `Thanh toán đặt lịch thuê nhân viên (${staffKeys.join(', ')}) trong ${hours} giờ. Phương thức: ${useSalaryWallet ? 'Ví lương' : 'VND chính'}.`
    );

    // Credit staff members
    for (const staff of staffs) {
      const baseRate = rateType === 'DAY' ? globalPriceDay : globalPriceNight;
      const baseEarned = baseRate * hours;
      const commissionAmount = (baseEarned * serverCommission) / 100;
      const netEarned = baseEarned - commissionAmount;

      await kernel.db.staff.update({
        where: { id: staff.id },
        data: {
          salaryWallet: { increment: netEarned },
          currentBookingEarnings: { increment: netEarned },
          allTimeBookingEarnings: { increment: netEarned },
          currentHours: { increment: hours },
          allTimeHours: { increment: hours }
        }
      });

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
          netEarned,
          txIdStaff,
          `Nhận tiền thuê từ khách hàng <@${customer.id}> cho đơn đặt lịch ${hours} giờ. Chiết khấu máy chủ: ${serverCommission}%.`
        );
      }
    }

    // Save Booking record
    const booking = await kernel.db.booking.create({
      data: {
        guildId,
        customerId: customer.id,
        staffKeys: staffKeys.join(','),
        hours,
        extraPeople: additionalPeople,
        privateServer,
        rateType,
        totalCost,
        status: 'COMPLETED'
      }
    });

    // 6. Build and send response
    const staffNameList = staffs.map(s => `**${s.name}**`).join(', ');
    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(
        `✅ **${customer.displayName}** vừa thuê ${staffNameList} trong **${hours} giờ**.\n💰 Tổng: \`${totalCost.toLocaleString('vi-VN')} ₫\``
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // 7. Dispatch to Booking Logging Channel
    const logChannelRecord = await kernel.db.logChannel.findUnique({
      where: { guildId_eventType: { guildId, eventType: 'BOOKING_LOG' } }
    });
    const bookingLogChannelId = logChannelRecord?.enabled ? logChannelRecord.channelId : null;
    if (bookingLogChannelId) {
      try {
        const logChannel = await kernel.client.channels.fetch(bookingLogChannelId).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setDescription(
              `🔔 **${customer.displayName}** đã thuê **${staffNameList}** trong **${hours} giờ**.\n💰 \`${totalCost.toLocaleString('vi-VN')} ₫\` | ${useSalaryWallet ? 'Ví lương' : 'Ví VND'}`
            )
            .setTimestamp();

          await (logChannel as TextChannel).send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error('Failed to send booking log embed:', err);
      }
    }
  }
}

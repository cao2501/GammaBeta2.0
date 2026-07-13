import {
  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder,
} from 'discord.js';
import { ICommand } from '../../../core/interfaces/ICommand';
import { Kernel } from '../../../core/Kernel';

export default class HelpCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('❓ Xem danh sách lệnh')
    .addStringOption(o => o.setName('module').setDescription('Tên module muốn xem')
      .addChoices(
        { name: '🛡️ Moderation', value: 'moderation' },
        { name: '📋 Logging', value: 'logging' },
        { name: '🎫 Tickets', value: 'tickets' },
        { name: '👋 Welcome', value: 'welcome' },
        { name: '⭐ Leveling', value: 'leveling' },
        { name: '💰 Economy', value: 'economy' },
        { name: '🎉 Giveaway', value: 'giveaway' },
        { name: '📊 Polls', value: 'polls' },
        { name: '💡 Suggestions', value: 'suggestions' },
        { name: '🎭 Reaction Roles', value: 'reaction-roles' },
        { name: '✅ Verification', value: 'verification' },
        { name: '🔊 Temp Voice', value: 'temp-voice' },
        { name: '⭐ Starboard', value: 'starboard' },
        { name: '📋 Missions', value: 'missions' },
        { name: '🔧 Utility', value: 'utility' },
        { name: '💾 Backup', value: 'backup' },
        { name: '📢 Analytics', value: 'analytics' },
        { name: '👑 Owner', value: 'owner' },
      )
    );

  async execute(interaction: ChatInputCommandInteraction, kernel: Kernel): Promise<void> {
    const module = interaction.options.getString('module');

    const moduleHelp: Record<string, { title: string; commands: string[] }> = {
      moderation: {
        title: '🛡️ Moderation',
        commands: [
          '`/ban` — Ban thành viên (thường/tạm thời/soft)',
          '`/kick` — Kick thành viên',
          '`/timeout` — Mute/Unmute thành viên',
          '`/warn add/remove/list/clear` — Hệ thống cảnh báo',
          '`/purge all/user/bot/link/attachment/regex` — Xóa tin nhắn',
        ],
      },
      logging: {
        title: '📋 Logging',
        commands: [
          '`/logging set <event> <channel>` — Cấu hình log channel',
          '`/logging disable <event>` — Tắt log sự kiện',
          '`/logging list` — Xem tất cả log channels',
          '**30+ events**: ban, kick, warn, message delete, member join/leave...',
        ],
      },
      tickets: {
        title: '🎫 Ticket System',
        commands: [
          '`/ticket panel <name> <channel>` — Tạo ticket panel',
          '`/ticket close [reason]` — Đóng ticket',
          '`/ticket claim` — Nhận ticket',
          '`/ticket transfer <user>` — Chuyển ticket',
          '`/ticket priority <level>` — Đặt ưu tiên',
          '`/ticket transcript` — Tạo transcript',
        ],
      },
      welcome: {
        title: '👋 Welcome & Leave',
        commands: [
          '`/welcome setup <channel> [message]` — Thiết lập welcome',
          '`/welcome leave <channel> [message]` — Thiết lập leave',
          '`/welcome dm <message>` — DM welcome',
          '`/welcome test` — Test message',
          '`/welcome disable <type>` — Tắt',
          '**Variables**: `{user}`, `{server}`, `{count}`, `{username}`',
        ],
      },
      leveling: {
        title: '⭐ Leveling',
        commands: [
          '`/rank [user]` — Xem rank card',
          '`/leaderboard [type]` — Bảng xếp hạng (XP/coins/voice)',
          '**Auto**: +15-25 XP/tin nhắn, role rewards, level-up notification',
        ],
      },
      economy: {
        title: '💰 Economy',
        commands: [
          '`/eco balance [user]` — Xem số dư',
          '`/eco daily` — Nhận 200 coins/ngày',
          '`/eco weekly` — Nhận 1000 coins/tuần',
          '`/eco work` — Làm việc kiếm 50-400 coins',
          '`/eco crime` — Phạm tội (rủi ro cao)',
          '`/eco rob <user>` — Cướp tiền',
          '`/eco transfer <user> <amount>` — Chuyển tiền',
        ],
      },
      giveaway: {
        title: '🎉 Giveaway',
        commands: [
          '`/giveaway start <prize> <duration> [winners]` — Bắt đầu',
          '`/giveaway end <id>` — Kết thúc sớm',
          '`/giveaway reroll <id>` — Chọn lại người thắng',
          '`/giveaway pause <id>` — Tạm dừng',
          '`/giveaway list` — Danh sách đang diễn ra',
        ],
      },
      polls: {
        title: '📊 Polls',
        commands: [
          '`/poll create <question> <options>` — Tạo poll (tối đa 10 lựa chọn)',
          '`/poll end <id>` — Kết thúc poll',
          '**Options**: `A|B|C|D` phân cách bằng `|`',
          '**Hỗ trợ**: Ẩn danh, nhiều lựa chọn, tự động kết thúc',
        ],
      },
      suggestions: {
        title: '💡 Suggestions',
        commands: [
          '`/suggest add <content> [anonymous]` — Gửi đề xuất',
          '`/suggest approve <id> [note]` — Chấp nhận',
          '`/suggest reject <id> [reason]` — Từ chối',
          '`/suggest consider <id>` — Đang xem xét',
          '`/suggest setup <channel>` — Cấu hình kênh',
        ],
      },
      'reaction-roles': {
        title: '🎭 Reaction Roles',
        commands: [
          '`/reactionrole button <channel> <title>` — Tạo button panel',
          '`/reactionrole add <message_id> <role>` — Thêm role vào panel',
          '`/reactionrole dropdown <channel> <title> <roles>` — Tạo dropdown',
          '`/reactionrole list` — Xem danh sách',
          '**Types**: Normal, Toggle, Unique, Temporary',
        ],
      },
      verification: {
        title: '✅ Verification',
        commands: [
          '`/verify setup <type> <role>` — Thiết lập (Button/Math/Time)',
          '`/verify panel` — Gửi panel verify',
          '`/verify autokick <enabled> [hours]` — Tự kick chưa verify',
          '`/verify info` — Xem cấu hình',
        ],
      },
      'temp-voice': {
        title: '🔊 Temporary Voice',
        commands: [
          '**Cấu hình**: Set "Hub Channel" trong DB hoặc qua Module Config',
          '**Auto-create**: Tham gia Hub → tạo phòng riêng',
          '**Auto-delete**: Mọi người rời → phòng tự xóa',
          '**Permissions**: Owner có ManageChannel trong phòng của mình',
        ],
      },
      starboard: {
        title: '⭐ Starboard',
        commands: [
          '`/starboard setup <channel> [threshold] [emoji]` — Thiết lập',
          '`/starboard ignore <channel>` — Bỏ qua/unignore kênh',
          '`/starboard info` — Xem cấu hình',
          '**Auto**: Phản ứng đủ ⭐ → post lên kênh starboard',
        ],
      },
      missions: {
        title: '📋 Missions',
        commands: [
          '`/missions list` — Xem nhiệm vụ của bạn',
          '`/missions claim <id>` — Nhận phần thưởng',
          '`/missions streak` — Xem chuỗi ngày',
          '`/missions create <name> <type> <task> <target>` — [Admin] Tạo nhiệm vụ',
          '**Types**: Daily, Weekly, Monthly',
        ],
      },
      utility: {
        title: '🔧 Utility',
        commands: [
          '`/util avatar [user]` — Xem avatar',
          '`/util userinfo [user]` — Thông tin user',
          '`/util serverinfo` — Thông tin server',
          '`/util roleinfo <role>` — Thông tin role',
          '`/util remind <time> <message>` — Đặt nhắc nhở',
          '`/util color <hex>` — Xem màu',
          '`/util calc <expression>` — Máy tính',
          '`/announce send/dm/schedule` — Thông báo',
        ],
      },
      backup: {
        title: '💾 Backup',
        commands: [
          '`/backup create <name>` — Tạo backup server',
          '`/backup list` — Xem danh sách backups',
          '`/backup delete <id>` — Xóa backup',
          '**Backup bao gồm**: Roles, channels, permissions, config',
        ],
      },
      analytics: {
        title: '📢 Analytics',
        commands: ['`/analytics` — Xem thống kê server', '**Auto-track**: Tin nhắn, voice time, commands'],
      },
      owner: {
        title: '👑 Owner Commands',
        commands: [
          '`/owner eval <code>` — Chạy JS',
          '`/owner reload <module>` — Reload module (hot-reload)',
          '`/owner stats` — Thống kê bot',
          '`/owner broadcast <message>` — Broadcast tới tất cả server',
          '`/owner maintenance <enabled>` — Maintenance mode',
        ],
      },
    };

    if (module && moduleHelp[module]) {
      const { title, commands } = moduleHelp[module]!;
      const embed = new EmbedBuilder()
        .setTitle(`${title} — Commands`)
        .setColor(0x5865f2)
        .setDescription(commands.join('\n'))
        .setFooter({ text: `Enterprise Bot — /help để xem tổng quan` });
      return void interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Overview
    const embed = new EmbedBuilder()
      .setTitle('🤖 Enterprise Bot — Help')
      .setColor(0x5865f2)
      .setDescription('Chọn một module từ dropdown để xem chi tiết lệnh.\nDùng `/help module:<tên>` để xem nhanh.')
      .addFields(
        { name: '🛡️ Moderation', value: '`/ban` `/kick` `/warn` `/timeout` `/purge`', inline: true },
        { name: '📋 Logging', value: '`/logging set/disable/list`', inline: true },
        { name: '🎫 Tickets', value: '`/ticket panel/close/claim/transfer`', inline: true },
        { name: '👋 Welcome', value: '`/welcome setup/leave/dm/test`', inline: true },
        { name: '⭐ Leveling', value: '`/rank` `/leaderboard`', inline: true },
        { name: '💰 Economy', value: '`/eco balance/daily/work/rob`', inline: true },
        { name: '🎉 Giveaway', value: '`/giveaway start/end/reroll`', inline: true },
        { name: '📊 Polls', value: '`/poll create/end`', inline: true },
        { name: '💡 Suggestions', value: '`/suggest add/approve/reject`', inline: true },
        { name: '🎭 Reaction Roles', value: '`/reactionrole button/dropdown/add`', inline: true },
        { name: '✅ Verification', value: '`/verify setup/panel/autokick`', inline: true },
        { name: '⭐ Starboard', value: '`/starboard setup/ignore`', inline: true },
        { name: '📋 Missions', value: '`/missions list/claim/streak`', inline: true },
        { name: '🔧 Utility', value: '`/util` `/announce` `/remind`', inline: true },
        { name: '💾 Backup', value: '`/backup create/list/restore`', inline: true },
        { name: '👑 Owner', value: '`/owner eval/reload/stats`', inline: true },
      )
      .setFooter({ text: `${kernel.client.commands.size} commands | ${kernel.client.modules.size} modules | discord.js v14` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

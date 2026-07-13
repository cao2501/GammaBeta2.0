import { createCanvas, loadImage, Canvas, Image } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import path from 'path';

export class CanvasService {
  /**
   * Helper to draw a rounded rectangle
   */
  private static drawRoundedRect(
    ctx: any,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth = 1
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  /**
   * Helper to draw a circular avatar
   */
  private static async drawCircularAvatar(
    ctx: any,
    avatarUrl: string,
    x: number,
    y: number,
    radius: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    try {
      const img = await loadImage(avatarUrl);
      ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    } catch {
      // Fallback color if avatar fails to load
      ctx.fillStyle = '#475569';
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Helper to abbreviate numbers (e.g. 1500 -> 1.50N, 1250000 -> 1.25Tr)
   */
  public static formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'Tr';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(2).replace(/\.00$/, '') + 'N';
    }
    return num.toString();
  }

  /**
   * 1. Draw Rank Card (Image #3: Level Chat style)
   */
  public static async drawRankCard(
    avatarUrl: string,
    username: string,
    level: number,
    rank: number,
    currentXp: number,
    nextXp: number
  ): Promise<Buffer> {
    const width = 800;
    const height = 220;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    this.drawRoundedRect(ctx, 0, 0, width, height, 24, '#18191c');

    // 2. Header "★ Level Chat"
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('★ Level Chat', 40, 42);

    // 3. User circular avatar
    await this.drawCircularAvatar(ctx, avatarUrl, 100, 130, 60);

    // 4. Name & Details
    const nameX = 180;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`@${username}`, nameX, 105);

    // Level & Rank row
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`LV.${level}`, nameX, 145);

    ctx.fillStyle = '#f1c40f';
    ctx.font = '24px sans-serif';
    ctx.fillText(`🏆 #${rank}`, nameX + 130, 145);

    // 5. XP progress text (align right)
    const ratio = Math.min(1, currentXp / (nextXp || 1));
    const xpText = `${currentXp.toLocaleString()} / ${nextXp.toLocaleString()}`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(xpText, width - 40, 145);
    ctx.textAlign = 'left'; // reset

    // 6. Progress bar
    const barX = 180;
    const barY = 168;
    const barW = width - barX - 40;
    const barH = 14;
    const fillW = Math.max(10, barW * ratio);

    // Track
    this.drawRoundedRect(ctx, barX, barY, barW, barH, 7, '#2d3748');
    // Fill
    this.drawRoundedRect(ctx, barX, barY, fillW, barH, 7, '#5865f2');

    return canvas.toBuffer('image/png');
  }

  /**
   * 2. Draw Level Up Card (Image #2: Thăng Cấp Chat style)
   */
  public static async drawLevelUpCard(
    avatarUrl: string,
    oldLevel: number,
    newLevel: number
  ): Promise<Buffer> {
    const width = 500;
    const height = 180;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    this.drawRoundedRect(ctx, 0, 0, width, height, 20, '#18191c');

    // 2. Circular Avatar
    await this.drawCircularAvatar(ctx, avatarUrl, 80, 90, 50);

    // 3. Star Icon & Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = '26px sans-serif';
    ctx.fillText('★', 160, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Thăng Cấp Chat', 195, 68);

    // 4. Large Level text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`LV.${oldLevel} > ${newLevel}`, 160, 130);

    return canvas.toBuffer('image/png');
  }

  /**
   * 3. Draw Leaderboard Card (Image #1: Bảng Xếp Hạng Tháng style)
   */
  public static async drawLeaderboardCard(
    guildName: string,
    type: 'xp' | 'coins' | 'voice',
    members: Array<{ username: string; avatarUrl: string; value: number; level?: number }>,
    callerRank: { rank: number; username: string; avatarUrl: string; value: number; level?: number } | null,
    guildIconUrl: string | null
  ): Promise<Buffer> {
    const width = 800;
    const height = 1200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    this.drawRoundedRect(ctx, 0, 0, width, height, 24, '#18191c');

    // 2. Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Bảng Xếp Hạng Tháng', 40, 60);

    const typeLabels: Record<string, string> = { xp: '💬 Chat', coins: '💰 Coins', voice: '🎙️ Voice' };
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(typeLabels[type] ?? '🏆 Leaderboard', 40, 125);

    // 3. Draw Podium (Top 3) at y = 180
    // Podium details: Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)
    const podiumCenter = 400;
    const top3 = members.slice(0, 3);
    const podiumOrder = [
      { rank: 2, item: top3[1], x: podiumCenter - 210, y: 220, w: 180, h: 200, color: 'rgba(255,255,255,0.03)' },
      { rank: 1, item: top3[0], x: podiumCenter - 100, y: 190, w: 200, h: 230, color: 'rgba(241,196,15,0.06)' },
      { rank: 3, item: top3[2], x: podiumCenter + 120, y: 220, w: 180, h: 200, color: 'rgba(255,255,255,0.03)' },
    ];

    for (const p of podiumOrder) {
      if (!p.item) continue;
      // Draw Pillar Card
      this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 16, p.color, p.rank === 1 ? 'rgba(241,196,15,0.2)' : 'rgba(255,255,255,0.05)', 1);

      // Draw crown for rank 1
      const avatarY = p.y + 70;
      const avatarX = p.x + p.w / 2;
      if (p.rank === 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', avatarX, p.y - 12);
        ctx.textAlign = 'left';
      }

      // Draw Avatar
      await this.drawCircularAvatar(ctx, p.item.avatarUrl, avatarX, avatarY, 40);

      // Draw rank badge overlapping avatar bottom
      this.drawRoundedRect(ctx, avatarX - 16, avatarY + 22, 32, 18, 9, p.rank === 1 ? '#f1c40f' : '#64748b');
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.rank.toString(), avatarX, avatarY + 35);

      // Name & value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`@${p.item.username}`, avatarX, p.y + p.h - 55);

      const scoreText = p.item.level !== undefined ? `LV.${p.item.level}` : this.formatNumber(p.item.value);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(scoreText, avatarX, p.y + p.h - 30);
      ctx.textAlign = 'left'; // reset
    }

    // 4. Draw list (Ranks 4-10)
    let listY = 460;
    const remaining = members.slice(3, 10);
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const rankNum = i + 4;
      const itemX = 40;
      const itemW = width - 80;
      const itemH = 65;

      // Draw row card
      this.drawRoundedRect(ctx, itemX, listY, itemW, itemH, 12, 'rgba(255, 255, 255, 0.02)');

      // Rank number
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(rankNum.toString(), itemX + 30, listY + 40);

      // Avatar
      await this.drawCircularAvatar(ctx, item.avatarUrl, itemX + 100, listY + 32, 22);

      // Username
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`@${item.username}`, itemX + 150, listY + 39);

      // Score
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      const rowScoreText = item.level !== undefined ? `LV.${item.level}` : this.formatNumber(item.value);
      ctx.fillText(rowScoreText, itemX + itemW - 30, listY + 39);
      ctx.textAlign = 'left';

      listY += 75;
    }

    // 5. Caller's Rank
    if (callerRank) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('🏆 Xếp hạng của bạn', 40, listY + 25);

      const callerY = listY + 45;
      const itemX = 40;
      const itemW = width - 80;
      const itemH = 65;

      this.drawRoundedRect(ctx, itemX, callerY, itemW, itemH, 12, 'rgba(241,196,15,0.05)', 'rgba(241,196,15,0.15)', 1);

      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(callerRank.rank.toString(), itemX + 30, callerY + 40);

      await this.drawCircularAvatar(ctx, callerRank.avatarUrl, itemX + 100, callerY + 32, 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`@${callerRank.username}`, itemX + 150, callerY + 39);

      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      const callerScoreText = callerRank.level !== undefined ? `LV.${callerRank.level}` : this.formatNumber(callerRank.value);
      ctx.fillText(callerScoreText, itemX + itemW - 30, callerY + 39);
      ctx.textAlign = 'left';
    }

    // 6. Footer
    const footerY = height - 50;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 20);
    ctx.lineTo(width - 40, footerY - 20);
    ctx.stroke();

    // Time info
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`🕒 ${nowStr}`, 40, footerY);

    // Guild info (align right)
    ctx.textAlign = 'right';
    ctx.fillText(`${guildName} • discord.gg/bot`, width - 40, footerY);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  /**
   * 4. Draw Profile/Stats Card (Image #4: Thống Kê Người Dùng style)
   */
  public static async drawProfileCard(
    username: string,
    avatarUrl: string,
    nickname: string | null,
    joinedDiscord: Date,
    joinedServer: Date,
    stats: {
      totalMsg: number;
      msg1d: number;
      msg7d: number;
      msg30d: number;
      totalVoiceMin: number;
      voice1d: number;
      voice7d: number;
      voice30d: number;
      chatRank: number;
      voiceRank: number;
      topChatChannel: string;
      topChatCount: number;
      topVoiceChannel: string;
      topVoiceMin: number;
    },
    guildName: string
  ): Promise<Buffer> {
    const width = 1000;
    const height = 750;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    this.drawRoundedRect(ctx, 0, 0, width, height, 24, '#18191c');

    // 2. User info header
    await this.drawCircularAvatar(ctx, avatarUrl, 80, 80, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(nickname || username, 140, 75);

    ctx.fillStyle = '#64748b';
    ctx.font = '16px monospace';
    ctx.fillText(`@${username}`, 140, 100);

    // 3. Joined Info
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Gia nhập từ', 550, 52);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    const discDate = joinedDiscord.toLocaleDateString('vi-VN');
    const servDate = joinedServer.toLocaleDateString('vi-VN');
    ctx.fillText(`🤖 Discord: ${discDate}`, 550, 80);
    ctx.fillText(`🏠 Server: ${servDate}`, 550, 105);

    // 4. Middle Cards: Messages Stats & Voice Stats
    const cardY = 150;
    const cardW = 440;
    const cardH = 260;

    // --- Messages Card (Left) ---
    this.drawRoundedRect(ctx, 40, cardY, cardW, cardH, 16, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)', 1);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('💬 Số tin nhắn trong server', 60, cardY + 35);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${this.formatNumber(stats.totalMsg)} tin nhắn`, 60, cardY + 95);

    // message breakdown
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('1 Ngày', 60, cardY + 145);
    ctx.fillText('7 Ngày', 60, cardY + 180);
    ctx.fillText('30 Ngày', 60, cardY + 215);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${stats.msg1d} tin nhắn`, 400, cardY + 145);
    ctx.fillText(`${stats.msg7d} tin nhắn`, 400, cardY + 180);
    ctx.fillText(`${stats.msg30d} tin nhắn`, 400, cardY + 215);
    ctx.textAlign = 'left';

    // --- Voice Card (Right) ---
    this.drawRoundedRect(ctx, 520, cardY, cardW, cardH, 16, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)', 1);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('🔊 Số giờ voice trong server', 540, cardY + 35);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    const hrs = (stats.totalVoiceMin / 60).toFixed(2).replace(/\.00$/, '');
    ctx.fillText(`${hrs} giờ`, 540, cardY + 95);

    // voice breakdown
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('1 Ngày', 540, cardY + 145);
    ctx.fillText('7 Ngày', 540, cardY + 180);
    ctx.fillText('30 Ngày', 540, cardY + 215);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${(stats.voice1d / 60).toFixed(1)} giờ`, 880, cardY + 145);
    ctx.fillText(`${(stats.voice7d / 60).toFixed(1)} giờ`, 880, cardY + 180);
    ctx.fillText(`${(stats.voice30d / 60).toFixed(1)} giờ`, 880, cardY + 215);
    ctx.textAlign = 'left';

    // 5. Bottom Section: Server Ranks & Top Channels
    const botY = 440;

    // --- Ranks Card (Left) ---
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('🏆 Xếp hạng trong server', 40, botY + 25);

    const miniW = 210;
    const miniH = 120;

    // Chat Rank Box
    this.drawRoundedRect(ctx, 40, botY + 45, miniW, miniH, 12, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('💬 Xếp hạng Chat', 60, botY + 75);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`#${stats.chatRank}`, 60, botY + 115);

    // Voice Rank Box
    this.drawRoundedRect(ctx, 270, botY + 45, miniW, miniH, 12, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('🔊 Xếp hạng Voice', 290, botY + 75);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`#${stats.voiceRank}`, 290, botY + 115);

    // --- Top Channels Card (Right) ---
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('🗣️ Top kênh tương tác nhiều nhất', 520, botY + 25);

    const rowW = 440;
    const rowH = 55;

    // Top Chat channel row
    this.drawRoundedRect(ctx, 520, botY + 45, rowW, rowH, 10, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Chat', 540, botY + 77);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`# ${stats.topChatChannel}`, 600, botY + 77);
    ctx.textAlign = 'right';
    ctx.fillText(`${stats.topChatCount} tin nhắn`, 940, botY + 77);
    ctx.textAlign = 'left';

    // Top Voice channel row
    this.drawRoundedRect(ctx, 520, botY + 110, rowW, rowH, 10, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Voice', 540, botY + 142);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(stats.topVoiceChannel, 600, botY + 142);
    ctx.textAlign = 'right';
    ctx.fillText(`${(stats.topVoiceMin / 60).toFixed(1)} giờ`, 940, botY + 142);
    ctx.textAlign = 'left';

    // 6. Footer
    const footerY = height - 50;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY - 20);
    ctx.lineTo(width - 40, footerY - 20);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (GMT +7)';
    ctx.fillText(`🕒 ${nowStr}`, 40, footerY);

    ctx.textAlign = 'right';
    ctx.fillText(`${guildName} • discord.gg/bot`, width - 40, footerY);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }
}

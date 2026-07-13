# 🤖 Kini Bot 2.0 — Enterprise Discord Bot & Web Dashboard

Chào mừng bạn đến với **Kini Bot 2.0**, một hệ thống Discord Bot đa chức năng cấp doanh nghiệp (Enterprise-grade) tích hợp bảng điều khiển Web Control Panel thời gian thực, hệ thống trí tuệ nhân tạo Gemini AI tự động tìm kiếm mặt đất, và hơn 27 phân hệ (modules) hoạt động hoàn toàn độc lập, mạnh mẽ.

---

## 🚀 Các Tính Năng Nổi Bật

### 1. 🌐 Web Control Panel (Dashboard Quản Trị)
* Giao diện hiện đại, tối ưu trải nghiệm người dùng với các tùy chọn đăng nhập bằng Discord hoặc **Chế độ bỏ qua (Developer Bypass Mode)**.
* **Quản lý Modules**: Bật/tắt các tính năng của bot thông qua nút gạt (sliders), chỉnh sửa trực tiếp cấu hình JSON của từng module và lưu trữ đồng bộ xuống cơ sở dữ liệu.
* **Live System Logs**: Kết nối WebSocket (Socket.io) truyền phát nhật ký hệ thống trực tiếp từ bot lên bảng điều khiển web console theo thời gian thực.
* **Công cụ tải ảnh CDN**: Cho phép tải ảnh trực tiếp từ Dashboard lên một kênh bảo mật trên Discord và tự động sinh ra liên kết Discord CDN vĩnh viễn để sử dụng trong cấu hình.

### 2. 🤖 Gemini AI Search Grounding (Trí Tuệ Nhân Tạo Thời Gian Thực)
* Tích hợp mô hình ngôn ngữ thế hệ mới nhất **Gemini 3.5 Flash** qua API v1beta.
* **Tìm kiếm mặt đất tự động (Grounding)**: Khi nhận được câu hỏi liên quan đến thời gian thực (tin tức, giá cả, thời tiết, tỷ số thể thao, v.v.), bot tự động chạy scraper tìm kiếm DuckDuckGo ngầm, trích xuất dữ liệu mới nhất và làm ngữ cảnh cho Gemini trả lời chính xác thông tin trực tuyến (Hoàn toàn miễn phí, không bị lỗi 429 giới hạn hạn ngạch của Google).
* **Tích hợp thời tiết vệ tinh**: Cào dữ liệu thời tiết trực tiếp từ vệ tinh (`wttr.in`) cho các tỉnh thành Việt Nam.

### 3. 🎨 Dynamic Canvas Cards (Đồ Họa Trực Quan Cao Cấp)
Sử dụng thư viện đồ họa hiệu năng cao `@napi-rs/canvas` để vẽ các thẻ ảnh trực tiếp trên RAM:
* **Thẻ Rank (`/rank`)**: Hiển thị avatar tròn, tên người dùng, thứ hạng, cấp độ hiện tại cùng thanh tiến trình XP được vẽ tỉ mỉ.
* **Bảng Xếp Hạng (`/leaderboard`)**: Hiển thị bục Podium vinh danh Top 3 (có vương miện, huy hiệu) và danh sách Top 4-10 bo góc hiện đại kèm dòng tóm tắt xếp hạng cá nhân của bạn ở chân trang.
* **Thẻ Profile (`/util userinfo`)**: Bảng thống kê chi tiết chia cột số lượng tin nhắn, số phút hoạt động Voice theo chu kỳ (1 ngày, 7 ngày, 30 ngày) cùng các kênh hoạt động tích cực nhất.
* **Thông Báo Thăng Cấp**: Tự động vẽ và gửi thẻ ảnh chúc mừng bắt mắt mỗi khi thành viên thăng cấp độ chat.

### 4. 🎙️ Hệ Thống Nhạc Thực Tế (Real Audio Stream)
* Tận dụng sức mạnh của `@discordjs/voice` và `play-dl` để stream nhạc trực tiếp từ YouTube với độ trễ thấp và chất lượng cao.
* Hàng đợi (Queue) nhạc linh hoạt với đầy đủ các lệnh điều hướng: `/music play`, `skip`, `stop`, `pause`, `volume`, `shuffle`, `loop`, `nowplaying`, `clear`.

### 5. 🛡️ Bảo Mật Anti-Nuke & Scam Detection
* **Anti-Nuke**: Tự động phát hiện hành vi xóa kênh/vai trò hàng loạt, ban thành viên liên tục hoặc lạm dụng Webhook. Tự động thu hồi quyền, kick/ban kẻ phá hoại, cách ly server (Lockdown) và báo cáo về kênh nhật ký bảo mật.
* **Scam Detection**: Tự động rà soát, kiểm duyệt liên kết độc hại, tên miền lừa đảo và tin nhắn spam.

### 6. 💾 Sao Lưu & Khôi Phục Hoàn Chỉnh (Backup & Restore)
* Sao lưu toàn bộ cấu trúc máy chủ (Kênh, Category, Phân quyền chi tiết, Vai trò/Roles) lưu trữ dưới dạng JSON nén trong cơ sở dữ liệu.
* Khôi phục máy chủ tự động thông qua giao diện nút bấm tương tác an toàn chống phá hoại.

---

## 🛠️ Hướng Dẫn Cấu Hình Hệ Thống (`.env`)

Tạo tệp `.env` tại thư mục gốc của bot (`apps/bot/.env`) và cấu hình các biến môi trường sau:

```env
# Discord Bot Credentials
BOT_TOKEN=Mã_Token_Bot_Discord_Của_Bạn
CLIENT_ID=ID_Ứng_Dụng_Discord_Của_Bạn
CLIENT_SECRET=Mã_Bí_Mật_OAuth2_Ứng_Dụng
BOT_PREFIX=kn

# Database (SQLite mặc định)
DATABASE_URL="file:./data/bot.db"

# Web Dashboard Settings
DASHBOARD_PORT=3000
DASHBOARD_URL=http://localhost:3000
SESSION_SECRET=mã_bí_mật_session_tự_chọn
JWT_SECRET=mã_bí_mật_jwt_tự_chọn

# Google Gemini AI Key
GEMINI_API_KEY=Mã_API_Key_Từ_Google_AI_Studio

# Quyền Quản Trị Tối Cao (ID người dùng Discord, cách nhau bằng dấu phẩy)
OWNER_IDS=682618319437824097
```

---

## 🏁 Hướng Dẫn Cài Đặt & Chạy Bot

Yêu cầu hệ thống: **Node.js phiên bản 18 trở lên** và đã cài đặt công cụ quản lý gói **pnpm** (hoặc npm).

### 1. Cài đặt các gói phụ thuộc:
Chạy lệnh cài đặt tại thư mục dự án bot (`apps/bot`):
```bash
npm install
```

### 2. Thiết lập cơ sở dữ liệu SQLite (Prisma):
Đồng bộ hóa cấu trúc Database và khởi tạo thư viện Prisma Client:
```bash
# Khởi tạo tệp cơ sở dữ liệu SQLite
npm run db:push

# Tạo các hàm truy vấn tự động cho Prisma
npm run db:generate
```

### 3. Đăng ký Slash Commands với Discord:
Đẩy toàn bộ 33 slash commands lên máy chủ Discord toàn cầu:
```bash
npm run deploy:commands
```

### 4. Khởi chạy hệ thống ở chế độ phát triển (Development):
```bash
npm run dev
```
* Bảng điều khiển Web Dashboard sẽ khởi chạy tại: `http://localhost:3000`

---

## 🐳 Triển Khai Thực Tế (Docker & PM2)

### Triển khai bằng PM2:
```bash
npm run pm2:start
```

### Triển khai bằng Docker Compose (Khuyên dùng):
Tự động đồng bộ DB, chạy nền và quản lý logs:
```bash
docker-compose up -d --build
```

---

## 🤝 Bản Quyền & Phát Triển
* Dự án được phát triển và vận hành bởi **cao2501** (GitHub: [cao2501](https://github.com/cao2501)).
* Tích hợp các công nghệ đồ họa Canvas, cơ chế RAG Search cho AI, bảo mật Anti-Nuke thời gian thực.

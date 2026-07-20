# Hướng Dẫn Đóng Góp Phát Triển (Contributing to Gamma Beta 2.0)

Cảm ơn bạn đã quan tâm đóng góp phát triển cho dự án **Gamma Beta 2.0**! Để đảm bảo quá trình phát triển diễn ra suôn sẻ, vui lòng tham khảo các hướng dẫn thiết lập bên dưới.

## Quy trình Đóng góp

1. Fork kho lưu trữ này về tài khoản GitHub của bạn.
2. Clone dự án về máy cá nhân và chuyển sang nhánh `main`.
3. Thiết lập môi trường chạy thử nghiệm (Xem phần bên dưới).
4. Thực hiện các chỉnh sửa, nâng cấp tính năng hoặc sửa lỗi.
5. Chạy thử nghiệm cục bộ để đảm bảo bot không phát sinh lỗi bất ngờ.
6. Tạo Pull Request (PR) mô tả rõ ràng các thay đổi của bạn tới nhánh `main` của dự án gốc.

## Hướng dẫn Thiết lập Môi trường Phát triển (Local Setup)

Để chạy thử nghiệm bot cục bộ trên máy tính của bạn, hãy thực hiện các bước sau:

1. **Cài đặt các gói phụ thuộc**:
   Truy cập vào thư mục bot `apps/bot` và chạy lệnh:
   ```bash
   npm install
   ```

2. **Cấu hình môi trường (`.env`)**:
   Tạo tệp `.env` bên trong thư mục `apps/bot` và thiết lập các khóa cấu hình cần thiết bao gồm:
   - `BOT_TOKEN` (Token của Discord Bot thử nghiệm của bạn)
   - `CLIENT_ID` (ID của ứng dụng bot)
   - `CLIENT_SECRET` (Mã bảo mật OAuth2)
   - `DASHBOARD_PORT=3000` (Cổng chạy Dashboard thử nghiệm)
   - `DASHBOARD_URL=http://localhost:3000`
   - `DATABASE_URL="file:./data/bot.db"`
   - `GEMINI_API_KEY` (API Key nếu bạn muốn thử nghiệm AI)
   - `OWNER_IDS` (ID Discord của bạn)

3. **Cài đặt cơ sở dữ liệu (SQLite & Prisma)**:
   Đẩy cấu hình cơ sở dữ liệu SQLite và tự động tạo mã nguồn Prisma Client:
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Đăng ký Slash Commands**:
   Đăng ký các lệnh slash command của bot lên máy chủ Discord thử nghiệm của bạn:
   ```bash
   npm run deploy:commands
   ```

5. **Khởi chạy bot ở chế độ phát triển (Development)**:
   ```bash
   npm run dev
   ```
   Sau khi bot online, bạn có thể truy cập Web Dashboard quản trị tại địa chỉ: `http://localhost:3000`.


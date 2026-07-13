# 📖 Hướng Dẫn Sử Dụng Lệnh & Chức Năng — Kini Bot 2.0

Tài liệu này tổng hợp toàn bộ **33 Lệnh Slash** và các chức năng đi kèm của **Kini Bot 2.0** được chia theo từng module độc lập.

---

## 🏆 1. Achievement System (Hệ thống Thành tựu)
Quản lý các danh hiệu, thành tựu người dùng có thể mở khóa trong máy chủ.

* **`/achievements list [user]`**: Xem danh sách các thành tựu mà bạn (hoặc người khác) đã mở khóa.
* **`/achievements all`**: Xem tất cả các thành tựu có trong máy chủ (những thành tựu ẩn sẽ bị che nếu chưa mở khóa).
* **`/achievements create <name> <description> <icon> [hidden]`**: *[Admin]* Tạo một thành tựu mới cho máy chủ.
* **`/achievements award <user> <name>`**: *[Admin]* Trao tặng trực tiếp một thành tựu cho thành viên.

---

## 🤖 2. AI Assistant (Trợ lý Trí tuệ Nhân tạo)
Tích hợp trí tuệ nhân tạo Google Gemini 1.5 Flash để trò chuyện và xử lý văn bản.

* **`/ai chat <message> [remember]`**: Trò chuyện trực tiếp với AI (ghi nhớ tối đa 20 lượt hội thoại gần nhất).
* **`/ai ask <question>`**: Hỏi một câu hỏi nhanh (phản hồi ngắn, không lưu lịch sử).
* **`/ai summarize <text>`**: Tóm tắt một đoạn văn bản dài thành các ý chính.
* **`/ai translate <text> <to>`**: Dịch văn bản sang ngôn ngữ đích (Việt, Anh, Nhật, Hàn, Pháp, Đức, Tây Ban Nha, Trung).
* **`/ai imagine <prompt>`**: Tạo đoạn mô tả chi tiết (Artist prompt) cho các trình tạo ảnh (Midjourney, SD).
* **`/ai analyze <content>`**: Phân tích cảm xúc văn bản hoặc giải thích mã nguồn (Code).
* **`/ai clear`**: Xóa lịch sử trò chuyện của bạn để làm sạch ngữ cảnh.

---

## 📊 3. Analytics (Phân tích dữ liệu)
Thống kê sự phát triển và hoạt động tương tác trong máy chủ.

* **`/analytics overview`**: Xem tổng quan số liệu thống kê máy chủ.
* **`/analytics messages`**: Xem lượng tin nhắn gửi đi theo thời gian.
* **`/analytics members`**: Biểu đồ thành viên tham gia/rời đi.
* **`/analytics top`**: Xếp hạng các thành viên hoạt động tích cực nhất.

---

## 🛡️ 4. Anti-Nuke (Chống Phá Server)
Bảo vệ server khỏi các hành vi phá hoại hàng loạt một cách tự động.

* **`/antinuke enable`**: Kích hoạt chế độ bảo vệ Anti-Nuke.
* **`/antinuke disable`**: Tắt chế độ bảo vệ.
* **`/antinuke config <alert_channel> [action] [channel_delete_threshold] [role_delete_threshold] [ban_threshold] [auto_lockdown] [anti_webhook]`**:
  * Cấu hình kênh nhận cảnh báo nguy hiểm.
  * Hành động xử lý: `BAN` (Cấm), `KICK` (Đuổi), `STRIP` (Thu hồi mọi vai trò), hoặc `LOG_ONLY` (Chỉ ghi nhật ký).
  * Tùy chỉnh giới hạn hành vi tối đa trong 10 giây.
* **`/antinuke whitelist <user/role>`**: Đưa thành viên hoặc vai trò vào danh sách tin cậy (bỏ qua quét Anti-Nuke).
* **`/antinuke info`**: Xem trạng thái và thông số cấu hình Anti-Nuke hiện tại.

---

## 💾 5. Server Backup (Sao lưu & Khôi phục)
Sao lưu và khôi phục nguyên vẹn cấu trúc kênh, vai trò của máy chủ.

* **`/backup create <name>`**: Lưu trữ trạng thái hiện tại của Server (kênh, phân loại, vai trò, cài đặt phân quyền). Giới hạn tối đa 5 bản sao lưu.
* **`/backup list`**: Danh sách các bản sao lưu đã tạo kèm ID và thời gian.
* **`/backup restore <id>`**: Khôi phục server từ bản sao lưu. *Lệnh này sẽ hiển thị bảng cảnh báo bảo mật nguy hiểm và yêu cầu xác nhận trước khi thực hiện.*
* **`/backup delete <id>`**: Xóa một bản sao lưu không còn sử dụng.

---

## 💰 6. Economy (Kinh tế & Tiền tệ)
Hệ thống tiền tệ ảo trong máy chủ.

* **`/eco balance [user]`**: Xem số dư ví và ngân hàng của bạn (hoặc người khác).
* **`/eco daily`**: Nhận tiền thưởng mỗi ngày.
* **`/eco weekly`**: Nhận tiền thưởng mỗi tuần.
* **`/eco work`**: Làm việc để kiếm coin ngẫu nhiên (cooldown: 1 giờ).
* **`/eco crime`**: Thực hiện hành vi phạm tội để kiếm lượng coin lớn hoặc bị phạt tiền (cooldown: 2 giờ).
* **`/eco rob <user>`**: Cướp tiền từ người dùng khác (tỉ lệ thành công 50%, có thể bị phạt đền tiền).
* **`/eco transfer <user> <amount>`**: Chuyển coin cho người chơi khác.
* **`/eco deposit <amount>`**: Gửi coin từ ví vào ngân hàng (bảo vệ khỏi bị cướp).
* **`/eco withdraw <amount>`**: Rút coin từ ngân hàng về ví.

---

## 🏪 7. Server Shop (Cửa hàng máy chủ)
Mua bán các vai trò hoặc phần thưởng ảo bằng tiền Economy.

* **`/shop list`**: Xem danh sách các mặt hàng đang được bày bán trong shop.
* **`/shop buy <item>`**: Mua hàng. Nếu là loại mặt hàng `ROLE`, bot sẽ tự động cấp vai trò đó cho bạn.
* **`/shop add <name> <price> <type> [role] [description] [stock]`**: *[Admin]* Thêm hàng vào shop (hỗ trợ đặt giới hạn số lượng trong kho).
* **`/shop remove <name>`**: *[Admin]* Xóa sản phẩm khỏi shop.
* **`/shop edit <name> [price] [stock] [enabled]`**: *[Admin]* Điều chỉnh giá bán, kho hàng hoặc ẩn/hiện sản phẩm.

---

## 🎁 8. Giveaway (Phát quà)
Tổ chức các sự kiện bốc thăm may mắn tự động.

* **`/giveaway start <duration> <winners> <prize>`**: Tạo và bắt đầu một đợt phát quà bằng nút bấm tham gia.
* **`/giveaway end <message_id>`**: Kết thúc sớm đợt phát quà và chọn người chiến thắng.
* **`/giveaway reroll <message_id>`**: Chọn lại người trúng thưởng mới.
* **`/giveaway pause <message_id>`**: Tạm ngưng/Tiếp tục thời gian giveaway.
* **`/giveaway list`**: Xem danh sách các giveaway đang diễn ra.

---

## 🏠 9. Guild Management (Quản lý Máy chủ)
Thiết lập các thông số cơ bản cho hệ thống bot tại Server.

* **`/setup info`**: Xem các cấu hình cơ bản hiện tại của máy chủ.
* **`/setup language <lang>`**: Đổi ngôn ngữ hiển thị của bot (`vi` hoặc `en`).
* **`/setup timezone <timezone>`**: Cài đặt múi giờ hoạt động.
* **`/setup prefix <prefix>`**: Cài đặt tiền tố cho các lệnh text cổ điển.

---

## 🌟 10. Leveling System (Hệ thống Cấp độ)
Tăng điểm kinh nghiệm (XP) thông qua tương tác nhắn tin và hoạt động thoại.

* **`/rank [user]`**: Xem thẻ thông tin cấp độ, điểm kinh nghiệm, thứ hạng hiện tại của bạn.
* **`/leaderboard`**: Xem bảng xếp hạng những thành viên có cấp độ cao nhất.
* **`/leveling setup <enabled> [announcement_channel] [level_up_message]`**: Bật/Tắt module và cấu hình thông báo lên cấp.
* **`/leveling addrole <level> <role> [type]`**: Cấu hình tự động trao vai trò khi đạt cấp độ nhất định.
* **`/leveling removerole <level> <role>`**: Xóa vai trò tự động trao cấp độ.
* **`/leveling setxp <user> <xp>`**: *[Admin]* Điều chỉnh thủ công điểm XP của thành viên.
* **`/leveling resetxp <user>`**: *[Admin]* Đưa cấp độ và XP của thành viên về 0.

---

## 📋 11. Logging System (Nhật ký Máy chủ)
Lưu trữ nhật ký các sự kiện diễn ra trong Server để tiện quản lý.

* **`/logging set <event_type> <channel>`**: Cấu hình kênh lưu nhật ký cho một loại sự kiện cụ thể (ví dụ: `MESSAGE_EDIT`, `MEMBER_LEAVE`, `VOICE_JOIN`,...).
* **`/logging disable <event_type>`**: Tắt tính năng log đối với loại sự kiện đó.
* **`/logging list`**: Xem danh sách toàn bộ các kênh log đang cấu hình.

---

## 🎯 12. Daily Missions (Nhiệm vụ Hàng ngày)
Hệ thống nhiệm vụ giúp thành viên kiếm điểm/tiền tệ và huy hiệu.

* **`/missions list`**: Xem các nhiệm vụ hàng ngày/hàng tuần của bạn và tiến độ thực hiện.
* **`/missions claim <mission_id>`**: Nhận phần thưởng sau khi hoàn thành nhiệm vụ.
* **`/missions streak`**: Xem chuỗi điểm danh hàng ngày của bạn.
* **`/missions create <name> <description> <type> <task_type> <target> <rewards>`**: *[Admin]* Thiết lập nhiệm vụ mới.

---

## 🔨 13. Moderation (Quản trị & Kiểm duyệt)
Bộ công cụ dành cho Ban quản trị để giữ gìn trật tự máy chủ.

* **`/ban <user> [reason] [delete_messages_days] [duration]`**: Cấm thành viên tham gia máy chủ (hỗ trợ cấm tạm thời theo thời gian).
* **`/kick <user> [reason]`**: Trục xuất thành viên khỏi máy chủ.
* **`/warn <action> [user] [reason] [points] [warn_id]`**:
  * `add`: Cảnh cáo thành viên (cộng điểm phạt tích lũy).
  * `remove`: Xóa cảnh cáo.
  * `history`: Xem lịch sử bị phạt.
  * `clear`: Xóa sạch lịch sử phạt của thành viên.
* **`/timeout <user> <duration> [reason]`**: Cấm chat/nói chuyện tạm thời của thành viên (Timeout).
* **`/untimeout <user> [reason]`**: Gỡ bỏ trạng thái timeout.
* **`/purge <type> <amount> [filter]`**: Dọn dẹp tin nhắn hàng loạt theo bộ lọc (`all`, `user`, `bot`, `link`, `attachment`, `regex`, `emoji`).

---

## 🎵 14. Music Player (Trình phát nhạc Voice)
Phát nhạc trực tiếp trong kênh đàm thoại của Discord.

* **`/music play <query>`**: Phát nhạc từ đường dẫn YouTube hoặc tìm kiếm theo từ khóa.
* **`/music skip`**: Bỏ qua bài hát đang phát để chuyển sang bài tiếp theo trong hàng đợi.
* **`/music stop`**: Dừng phát nhạc hoàn toàn, xóa hàng đợi và ngắt kết nối khỏi kênh thoại.
* **`/music pause`**: Tạm dừng hoặc tiếp tục phát nhạc.
* **`/music queue`**: Hiển thị danh sách các bài hát đang chờ phát.
* **`/music shuffle`**: Trộn ngẫu nhiên danh sách phát nhạc.
* **`/music loop`**: Kích hoạt/Tắt chế độ lặp lại bài hát hoặc lặp lại cả danh sách.
* **`/music volume <level>`**: Chỉnh âm lượng (từ `0` đến `200`).
* **`/music nowplaying`**: Hiển thị chi tiết bài hát đang phát kèm ảnh thu nhỏ.
* **`/music remove <position>`**: Xóa bài hát tại vị trí cụ thể trong hàng đợi.
* **`/music clear`**: Xóa toàn bộ hàng đợi trừ bài đang phát.

---

## 🗳️ 15. Polls (Bình chọn & Khảo sát)
Tạo các bảng khảo sát lấy ý kiến thành viên.

* **`/poll create <question> <options> [duration] [anonymous]`**: Tạo khảo sát bình chọn nhiều lựa chọn (phân tách các tùy chọn bằng dấu phẩy `,`).
* **`/poll end <message_id>`**: Kết thúc khảo sát sớm và hiển thị kết quả bình chọn cuối cùng.

---

## 💎 16. Premium Manager (Trình Quản lý Gói Cao cấp)
Hệ thống nâng cấp tính năng cao cấp dành cho máy chủ.

* **`/premium info`**: Kiểm tra trạng thái gói Premium của server hiện tại.
* **`/premium activate <guild_id> <days> [plan]`**: *[Owner]* Kích hoạt thời hạn Premium cho một máy chủ (`BASIC`, `PRO`, `ULTIMATE`).
* **`/premium revoke <guild_id>`**: *[Owner]* Thu hồi quyền Premium của máy chủ.
* **`/premium list`**: *[Owner]* Danh sách toàn bộ các máy chủ đang sử dụng Premium.

---

## 🎭 17. Reaction Roles (Vai trò phản hồi)
Tự động cấp vai trò thông qua nút bấm hoặc danh sách chọn.

* **`/reactionrole button <message_id> <emoji> <role> [label] [style]`**: Thêm nút tự chọn vai trò vào một tin nhắn có sẵn.
* **`/reactionrole dropdown <message_id> <role> <label> [emoji] [description]`**: Thêm danh sách thả xuống tự chọn vai trò.
* **`/reactionrole add <channel> <title> <description> [image_url]`**: Tạo một bảng đăng ký vai trò mới.
* **`/reactionrole list`**: Xem danh sách các tin nhắn Reaction Roles đang hoạt động.

---

## ⭐ 18. Starboard (Bảng vàng danh dự)
Tự động ghim các tin nhắn nhận được nhiều cảm xúc ngôi sao ⭐ từ cộng đồng.

* **`/starboard setup <channel> [threshold] [emoji]`**: Thiết lập kênh Starboard, số lượt phản hồi cần thiết để được ghim.
* **`/starboard ignore <channel>`**: Bỏ qua các tin nhắn thuộc kênh cụ thể (không cho phép lên bảng vàng).
* **`/starboard info`**: Xem cấu hình Starboard của máy chủ.

---

## 👥 19. Suggestions (Ý kiến & Góp ý)
Cung cấp kênh cho thành viên gửi góp ý xây dựng cộng đồng.

* **`/suggest add <content> [anonymous]`**: Gửi một ý kiến đóng góp lên kênh góp ý.
* **`/suggest setup <channel>`**: *[Admin]* Thiết lập kênh nhận các bài viết góp ý của thành viên.
* **`/suggest approve <message_id> [comment]`**: *[Admin]* Phê duyệt ý kiến góp ý kèm phản hồi.
* **`/suggest reject <message_id> [comment]`**: *[Admin]* Từ chối góp ý.
* **`/suggest consider <message_id> [comment]`**: *[Admin]* Đánh dấu góp ý đang được xem xét.

---

## 🔊 20. Temporary Voice (Kênh thoại Tạm thời)
Tự động tạo kênh thoại riêng khi thành viên tham gia kênh tổng và tự động xóa khi không còn ai.

* **`/vc setup <hub_channel>`**: Tạo kênh thoại tổng (Hub). Thành viên vào đây sẽ được chuyển sang kênh riêng.
* **`/vc rename <name>`**: Đổi tên kênh thoại riêng của bạn.
* **`/vc limit <limit>`**: Giới hạn số lượng thành viên tối đa được vào kênh (từ `0` - không giới hạn, đến `99`).
* **`/vc lock`**: Khóa kênh (không cho người lạ tham gia).
* **`/vc unlock`**: Mở khóa kênh thoại.
* **`/vc hide`**: Ẩn kênh thoại khỏi danh sách kênh hiển thị.
* **`/vc show`**: Hiện lại kênh thoại.
* **`/vc kick <user>`**: Đuổi một người dùng ra khỏi kênh thoại riêng của bạn.
* **`/vc transfer <user>`**: Nhượng quyền sở hữu kênh thoại cho thành viên khác.
* **`/vc info`**: Xem thông số kênh thoại riêng.

---

## 🎫 21. Ticket System (Hệ thống Hỗ trợ)
Tạo phòng hỗ trợ riêng tư giữa thành viên và ban quản trị.

* **`/ticket panel <channel> <title> <description> [button_label] [category_id]`**: Tạo bảng nhấn nút để mở phòng hỗ trợ (Ticket).
* **`/ticket close [reason]`**: Đóng phòng hỗ trợ hiện tại và tạo tệp transcript lưu nội dung chat.
* **`/ticket claim`**: Quản trị viên nhận xử lý ticket này (chỉ người nhận và chủ ticket mới có quyền xem).
* **`/ticket transfer <user>`**: Chuyển giao ticket cho quản trị viên khác xử lý.
* **`/ticket priority <level>`**: Đặt độ ưu tiên cho ticket (`LOW`, `NORMAL`, `HIGH`, `URGENT`).
* **`/ticket transcript`**: Xuất nội dung chat trong ticket thành tệp văn bản.

---

## 🛠️ 22. Utility (Công cụ & Tiện ích)
Các lệnh hỗ trợ thông tin nhanh chóng.

* **`/util avatar [user]`**: Xem và tải ảnh đại diện của thành viên.
* **`/util userinfo [user]`**: Xem thông tin chi tiết tài khoản thành viên (ngày tạo, ngày tham gia, vai trò,...).
* **`/util serverinfo`**: Xem thông số chi tiết của máy chủ.
* **`/util roleinfo <role>`**: Xem thông tin về vai trò cụ thể.
* **`/util remind <duration> <message>`**: Hẹn giờ nhắc nhở công việc (ví dụ: `10m`, `2h`, `1d`).
* **`/util color <hex>`**: Xem trước màu sắc mã HEX.
* **`/util calc <expression>`**: Máy tính giải các biểu thức toán học nhanh.
* **`/announce send <channel> <message> [title] [color] [image]`**: *[Admin]* Gửi thông báo dạng Embed đẹp mắt.
* **`/announce dm <user> <message> [title]`**: *[Admin]* Gửi tin nhắn trực tiếp dạng Embed tới thành viên.
* **`/announce schedule <channel> <time> <message>`**: *[Admin]* Hẹn giờ gửi thông báo tự động.
* **`/help [module]`**: Xem danh mục hướng dẫn lệnh hoặc chi tiết từng module.

---

## ✅ 23. Member Verification (Xác minh Thành viên)
Chống tài khoản ảo/spam tham gia phá hoại server bằng hệ thống Captcha toán học.

* **`/verify setup <channel> <verified_role> [type]`**: Cấu hình kênh xác minh, vai trò được nhận sau khi xác minh và phương thức (`BUTTON` hoặc `MATH` Captcha).
* **`/verify panel <channel> <title> <description>`**: Gửi bảng nhấn nút xác minh vào kênh cụ thể.
* **`/verify autokick <enabled> <minutes>`**: Tự động Kick tài khoản không hoàn thành xác minh sau số phút cài đặt.
* **`/verify info`**: Xem chi tiết cấu hình xác minh hiện tại của máy chủ.

---

## 👋 24. Welcome & Leave (Chào mừng & Tạm biệt)
Gửi tin nhắn cá nhân hóa chào đón thành viên mới hoặc tiễn thành viên rời nhóm.

* **`/welcome setup <channel> <message> [auto_role]`**: Cấu hình kênh gửi tin nhắn chào mừng, nội dung tin nhắn (hỗ trợ `{user}`, `{server}`, `{count}`) và vai trò tự động cấp khi tham gia.
* **`/welcome leave <channel> <message>`**: Cấu hình kênh và nội dung tin nhắn tiễn biệt khi có thành viên rời đi.
* **`/welcome dm <enabled> <message>`**: Bật/Tắt gửi tin nhắn riêng (DM) chào đón thành viên mới.
* **`/welcome test`**: Thử nghiệm gửi tin nhắn chào mừng giả lập.
* **`/welcome disable`**: Tắt toàn bộ tính năng chào mừng/tiễn biệt.

---

## 👑 25. Owner Management (Lệnh cho Chủ sở hữu Bot)
Nhóm lệnh tối cao dành riêng cho lập trình viên/chủ sở hữu bot.

* **`/owner eval <code>`**: Chạy trực tiếp code JavaScript/TypeScript từ Discord.
* **`/owner shell <command>`**: Thực thi lệnh Terminal trực tiếp trên VPS/máy chủ chạy bot.
* **`/owner stats`**: Xem thông số chi tiết tài nguyên hệ thống (RAM, CPU, Uptime, Node version).
* **`/owner reload <module>`**: Thực hiện hot-reload tải lại một module lập tức mà không cần tắt bot.
* **`/owner broadcast <message>`**: Gửi thông báo đến toàn bộ các máy chủ đang chứa bot.
* **`/owner maintenance`**: Kích hoạt/Tắt chế độ bảo trì (khi bật, chỉ owner mới dùng được bot).

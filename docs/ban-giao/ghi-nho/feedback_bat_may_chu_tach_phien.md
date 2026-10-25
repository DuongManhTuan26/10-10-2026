---
name: feedback-bat-may-chu-tach-phien
description: "Zernio — từ 23/10 22:10 máy chủ cổng 3000 chạy bằng LaunchAgent (không watch): gộp mã xong BẮT BUỘC kickstart; không tự bật song song"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-23T15:11:30.116Z
---

Từ 23/10/2026 22:10 (chủ dự án đồng ý cài TD-27): máy chủ chính chạy bằng LaunchAgent `vn.quanly.fanpage` (`tsx server.ts`, KHÔNG watch, KeepAlive). Sập / kill → launchd tự bật lại (~23 giây, đã thử).

Trước đó (sự cố 23/10 10:55–13:53): bật máy chủ từ Bash của phiên Claude thì nằm chung nhóm tiến trình, ứng dụng ngắt là máy chủ chết theo → đã sửa mo-app.sh bằng setsid; nay LaunchAgent thay thế.

**Why:** không watch nên gộp mã KHÔNG tự nạp mã máy chủ / migration; quên khởi động lại = máy chủ chạy mã cũ.

**How to apply:** sau MỖI lần gộp (hàng đợi = 0): `launchctl kickstart -k gui/$(id -u)/vn.quanly.fanpage`, rồi đọc ~/Library/Logs/quan-ly-fanpage.log có "[migrate] …" + "Sẵn sàng" và health 200. Không bật thêm máy chủ bằng npm run dev / preview_start (tranh cổng 3000). scripts/mo-app.sh tự kickstart khi thấy LaunchAgent. Kịch bản tạm để ~/.zn-tam/. Liên quan [[feedback_khong_preview_may_chu_chinh]].

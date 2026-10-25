---
name: khong-preview-may-chu-chinh
description: "Zernio — KHÔNG bật máy chủ chính cổng 3000 bằng preview_start (app tắt nó khi dọn khung xem trước → khách mất AI); chạy bằng scripts/mo-app.sh (\"Mở app\")"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-19T06:23:11.879Z
---

Máy chủ chính Zernio (cổng 3000, nhận webhook thật qua đường hầm) PHẢI chạy độc lập bằng `scripts/mo-app.sh` (nút "Mở app"
trên Desktop: `nohup npm run dev`, nhật ký ~/Library/Logs/quan-ly-fanpage.log). KHÔNG dùng preview_start {name:"zernio"}.
Thấy máy chủ tắt → báo chủ dự án bấm "Mở app" (hoặc xin phép rồi chạy `KHONG_MO=1 bash scripts/mo-app.sh`), không tự dựng
dưới khung xem trước. Muốn xem giao diện → mở trình duyệt vào http://localhost:3000 bằng url.

**Why:** 19/10/2026 điều tra webhook chết: máy chủ bật bằng preview_start bị app tắt khi dọn khung xem trước (ít nhất 3 lần
trong ngày) → đường hầm trỏ vào chỗ trống → 502 → người canh dựng lại ~30 lần → Cloudflare chặn → khách không có AI
trả lời từ 11:28 tới 13:21. Phiên kiểm duyệt chỉ ra; chính phiên viết code đã bật máy chủ bằng preview_start.

**How to apply:** Trước khi xem log máy chủ, đọc ~/Library/Logs/quan-ly-fanpage.log thay vì preview_logs. Liên quan:
[[hai-phien-viet-va-duyet]], [[verify-before-claiming]].

24/10/2026: lặp lại dù không gọi preview_start — mở lại khung trình duyệt lúc đang ẩn (navigate) làm ứng dụng TỰ bật cấu hình "zernio" (npm run dev) → bản thứ hai chạy ở 3001, nối Neon thật, chạy worker + bot Telegram song song với LaunchAgent (08:30:52–~08:45 UTC ≈ 14 phút; không việc nào bị làm đôi; TD-31). Đã đổi cả ~/.claude/launch.json và .claude/launch.json của repo thành chỉ gắn: {"name":"zernio","url":"http://localhost:3000"} (bản gốc ~/.zn-tam/launch.json.goc). Mỗi lần dùng trình duyệt: preview_list — thấy máy chủ "zernio" có cổng khác 3000 thì preview_stop ngay. Liên quan [[feedback-bat-may-chu-tach-phien]].

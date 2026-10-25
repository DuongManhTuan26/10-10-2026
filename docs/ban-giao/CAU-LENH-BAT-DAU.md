# Câu lệnh dán cho Claude Code mới

Mở Claude Code ở thư mục `/Users/mac/projects/zernio-2a` (hoặc `/Users/mac/projects/zernio`), dán nguyên văn:

---

Bạn tiếp quản dự án "Quản lý Fanpage" (mã zernio) từ một phiên Claude Code trước. Trước khi làm gì:
1. Đọc toàn bộ docs/BAN-GIAO.md, CLAUDE.md, docs/ton-dong.md, docs/quy-trinh-kiem-duyet.md và mọi tệp trong
   docs/ban-giao/ghi-nho/ (đó là yêu cầu và quyết định của tôi — làm trái là sai).
2. Kiểm tra hiện trạng, CHỈ ĐỌC: `git -C /Users/mac/projects/zernio log --oneline -5`, `git status`, máy chủ
   `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health`, `npm run kiem-tra` trong worktree.
3. Báo tôi ngắn gọn bạn đã hiểu: dự án là gì, đang ở đâu, việc nào đang chờ tôi quyết (mục 7 của BAN-GIAO.md).
Sau đó làm tiếp từ mục 7 theo đúng quy trình trong BAN-GIAO.md. Không chạy npm run dev, không đụng .env, không tiêu tiền khi
tôi chưa cho, không xoá dữ liệu.

---

Máy MỚI (không phải máy này): clone https://github.com/DuongManhTuan26/10-10-2026, `npm ci`, đặt tệp khoá
`khoa-api.env` (chủ dự án tự chép từ `~/zernio-ban-giao/` máy cũ bằng USB / AirDrop — không gửi qua chat / email / git)
thành `.env` ở gốc kho, rồi làm theo mục 2 của BAN-GIAO.md.

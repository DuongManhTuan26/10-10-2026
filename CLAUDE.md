# CLAUDE.md — dự án "Quản lý Fanpage" (zernio)

BẮT ĐẦU: đọc `docs/BAN-GIAO.md` (toàn bộ), rồi `docs/ton-dong.md`, `docs/quy-trinh-kiem-duyet.md`, `docs/ban-giao/ghi-nho/`.
Trả lời chủ dự án bằng tiếng Việt, ngắn, có chứng cứ.

## Luật cứng (vi phạm = làm sai)

- Máy chủ cổng 3000 = LaunchAgent `vn.quanly.fanpage`. KHÔNG `npm run dev`, KHÔNG `preview_start` zernio. Gộp xong:
  `launchctl kickstart -k gui/$(id -u)/vn.quanly.fanpage` + đọc dòng mới trong `~/Library/Logs/quan-ly-fanpage.log`
  ("Sẵn sàng") + health 200.
- CSDL là Neon THẬT. Ghi dữ liệu thật / migration: có phép thử tự hoàn tác (`scripts/thu-0NN-hoan-tac.mts`) chạy đạt trước;
  gộp chỉ khi hàng đợi webhook = 0. Không xoá vĩnh viễn dữ liệu tự ý.
- KHÔNG commit / dán `.env`, khoá API, mật khẩu (khoá ở `/Users/mac/projects/zernio/.env`, bản sao `~/zernio-ban-giao/`).
- Nhánh `giao-dien-hop-nhat` ở `/Users/mac/projects/zernio` chỉ nhận `git merge --ff-only`; làm việc trong worktree
  `/Users/mac/projects/zernio-2a`, mỗi mục một nhánh.
- Trước gộp: `npx tsc --noEmit -p .` sạch · `npm run kiem-tra` tất cả đạt · `TEP="…" npx tsx scripts/kiem-tra-nguoc.mts`
  "Mọi chốt chặn đều có phép kiểm thật đứng sau" (không chạy song song hai lượt).
- Tính năng mới = phép kiểm + lỗ đục ngược. Lời dặn AI Bán hàng khoá bằng `scripts/mau/loi-dan-ban-hang.json`.
- Lỗ đục ngược / phép kiểm KHÔNG được chạm thứ thật: kiem-tra-nguoc chạy kiem-tra trong `MOI_TRUONG_CO_LAP` (CSDL .invalid,
  không Telegram / AI); lỗ đục không `import(` / `require(`, không nạp đường ghi DB hay gửi tin thật (30/10/2026 đã gây một
  tin Telegram giả — TD-35). Thêm biến môi trường dẫn ra ngoài thì thêm vào `MOI_TRUONG_CO_LAP`.
- Không tiêu tiền (AI / quảng cáo) khi chưa được chủ dự án cho; đẩy bài quảng cáo phải báo số tiền trước.
- Trình chủ dự án: mỗi mục = đề xuất + nguyên nhân + căn cứ + hệ quả + tiền. Không liệt kê trơn, không hỏi vặt.
- Không tự đổi điều đã chốt; sửa lỗi thì sửa mọi chỗ cùng loại; "Zernio" không bao giờ lộ ra cho khách.
- Khối não: chỉ làm sau cùng, khi mọi thứ khác đã hoàn hảo.

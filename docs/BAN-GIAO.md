# BÀN GIAO DỰ ÁN — "Quản lý Fanpage" (mã nội bộ: zernio) — 25/10/2026

Đọc HẾT tệp này trước khi gõ lệnh đầu tiên. Rồi đọc `CLAUDE.md` (gốc kho), `docs/ton-dong.md`, `docs/quy-trinh-kiem-duyet.md`
và thư mục `docs/ban-giao/ghi-nho/` (34 ghi nhớ: yêu cầu + quyết định của chủ dự án — trái với chúng là làm sai).

Chủ dự án nói tiếng Việt, xưng "tao / mày" khi bực. Trả lời tiếng Việt, ngắn, có chứng cứ.

---

## 1. Dự án là gì

SaaS bán hàng bằng AI cho chủ shop Việt Nam bán qua Fanpage Facebook (và Instagram, TikTok…). Mỗi **cửa hàng** có một
**khối não 4 AI** liền mạch, không tách rời:
① AI Nội dung (viết / đăng bài, ảnh, video, lịch tự đăng) · ② AI Quảng cáo (đẩy bài Meta Ads, nhắm tỉnh / sở thích, dự báo) ·
③ AI Bán hàng (trả lời khách 24/7, chốt đơn, chuyển người thật) · ④ AI Điều hành (chấm mỗi ngày, chẩn đoán + đề xuất, chủ
shop duyệt).

Hạ tầng mạng xã hội qua nhà cung cấp **Zernio** (zernio.com, API v1). TUYỆT ĐỐI không để chữ "Zernio" lọt ra giao diện / lỗi
khách thấy (dùng `giauNhaCungCap`). AI qua **OpenRouter**. CSDL **Neon Postgres THẬT** (có khách thật dùng — mọi lệnh ghi
đều phải cẩn thận, xem §6).

Công nghệ: React 19 + Vite + TypeScript (src/), Express ESM chạy bằng `tsx` (server.ts, server/), migration SQL đánh số
(server/migrations/001…067, tự áp lúc khởi động, sổ `schema_migrations`).

---

## 2. Chạy được ngay (máy này)

- Mã chính: `/Users/mac/projects/zernio` — nhánh làm việc **`giao-dien-hop-nhat`** (luôn sạch; chỉ nhận gộp fast-forward).
- Worktree làm nhánh tính năng: `/Users/mac/projects/zernio-2a` (node_modules + .env là liên kết sang mã chính).
- Máy chủ cổng 3000 chạy bằng **LaunchAgent** `vn.quanly.fanpage` (`tsx server.ts`, KHÔNG watch, tự bật lại khi chết).
  - Gộp mã xong BẮT BUỘC: `launchctl kickstart -k gui/$(id -u)/vn.quanly.fanpage`, rồi đọc nhật ký
    `~/Library/Logs/quan-ly-fanpage.log` (dòng MỚI sau lệnh: "[migrate] …" + "[khởi động] Sẵn sàng…") và
    `curl -s http://localhost:3000/api/health` = 200.
  - KHÔNG chạy `npm run dev`, KHÔNG `preview_start` máy chủ zernio (sự cố TD-31: hai máy chủ cùng chạy worker trên Neon thật).
    `.claude/launch.json` cấu hình "zernio" chỉ GẮN vào `http://localhost:3000`.
- Webhook nhận tin thời gian thực qua Cloudflare tunnel: `scripts/tunnel-watchdog.mjs` (đang chạy nền, tự dựng lại đường
  hầm và trỏ webhook Zernio sang địa chỉ mới).
- Mở app: `bash scripts/mo-app.sh` (tự kickstart LaunchAgent nếu tắt).

### Khoá API / bí mật — KHÔNG có trên GitHub (cố ý)
- Đang dùng: `/Users/mac/projects/zernio/.env` (git bỏ qua).
- Bản sao để bàn giao: `~/zernio-ban-giao/khoa-api.env` (quyền 600, ngoài kho) + `~/zernio-ban-giao/vn.quanly.fanpage.plist`.
- Tên biến cần có (giá trị trong tệp trên): `DATABASE_URL` (Neon), `ZERNIO_API_KEY`, `ZERNIO_API_BASE_URL`,
  `ZERNIO_WEBHOOK_SECRET`, `OPENROUTER_API_KEY`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `APP_URL`,
  `NODE_ENV`, `PORT`, `CLOUDFLARED_PATH`. Mẫu: `.env.example`.
- Máy MỚI: clone kho → `npm ci` → chép `khoa-api.env` thành `.env` ở gốc kho (chủ dự án tự chuyển tệp bằng đường an toàn,
  KHÔNG dán vào chat / git) → cài LaunchAgent theo `docs/launchagent/` → `npm run tunnel` (nền).
- KHÔNG BAO GIỜ commit `.env`, khoá, mật khẩu. Trước khi đẩy GitHub: quét `git grep` + `git log -G` các mẫu khoá.

### GitHub
- Kho bàn giao: https://github.com/DuongManhTuan26/10-10-2026 — `main` và `giao-dien-hop-nhat` = cùng commit mới nhất.
  (Remote tên `kho1010`. Hai remote cũ `origin` = giaodienmoinhat, `moi` = 24-9-2026: không dùng nữa.)

---

## 3. Quy trình làm việc BẮT BUỘC (chủ dự án chốt — làm sai là bị mắng)

1. **Hai phiên**: một phiên viết code, một phiên kiểm duyệt (đọc mã + tự chạy lại phép kiểm). Thiết kế → phiên kiểm duyệt
   duyệt → code → kiểm → phiên kiểm duyệt kiểm độc lập → gộp. Nếu chỉ có MỘT phiên: tự đóng vai kiểm duyệt ở bước cuối
   (đọc lại diff, chạy lại toàn bộ), và nói rõ với chủ dự án là chưa có kiểm độc lập.
2. Mỗi mục một nhánh trong worktree, một commit (bổ sung theo kiểm duyệt = commit thứ hai), thông điệp tiếng Việt có căn cứ.
3. Trước khi gộp: `npx tsc --noEmit -p .` sạch; `npm run kiem-tra` "Tất cả đều đạt" (hiện **1395 điểm**);
   `TEP="tệp1|tệp2" npx tsx scripts/kiem-tra-nguoc.mts` (đục lỗ ngược) "Mọi chốt chặn đều có phép kiểm thật đứng sau" —
   TEP = các tệp trong diff. KHÔNG chạy hai lượt kiem-tra-nguoc cùng lúc (khoá `$TMPDIR/kiem-tra-nguoc.khoa`). Lượt bị ngắt
   giữa chừng → kiểm tệp có kẹt lỗ đục không (chạy lại kiem-tra phải đạt).
   - kiem-tra-nguoc chạy bộ kiểm tra trong MÔI TRƯỜNG CÔ LẬP (khoá giả — `MOI_TRUONG_CO_LAP`, TD-35). Thêm biến môi trường
     nào dẫn ra ngoài (CSDL, nhà cung cấp, AI, Telegram, email…) thì PHẢI thêm vào `MOI_TRUONG_CO_LAP`. Lỗ đục không được
     nạp mô-đun lúc chạy (`import(` / `require(` — bị chặn tự động).
   - Mỗi tính năng mới: thêm phép kiểm (scripts/kiem-tra.mts) + lỗ đục (scripts/kiem-tra-nguoc.mts, chèn trước dòng
     `ten: "tải lại trang không chọn lại cửa hàng đang hướng dẫn (mũi tên tắt mất)"`). Lỗ cũ "không đáng tin" vì mã đổi →
     TRỎ LẠI cho đúng ý, không xoá.
4. Migration ghi Neon thật: viết `scripts/thu-0NN-hoan-tac.mts` (một giao dịch, lock_timeout 3s, ROLLBACK, kiểm sau) và
   chạy đạt TRƯỚC khi gộp. Gộp chỉ khi hàng đợi webhook = 0:
   `cd /Users/mac/projects/zernio && npx tsx docs/ban-giao/cong-cu/hang-doi.mts` → "cho 0" → `git merge --ff-only <hash>` →
   kickstart → đọc nhật ký + health.
5. Lời dặn AI Bán hàng bị KHOÁ nguyên văn bằng bản mẫu `scripts/mau/loi-dan-ban-hang.json` (phép kiểm so nguyên văn). Đổi
   lời dặn thì diff mẫu phải chỉ khác đúng chỗ định đổi.
6. Giao diện: kiểm 1440 và 375 (không tràn ngang), soát 22 màn (docs/ban-giao/cong-cu/soat22.js — chạy hai bước vì
   javascript_tool giới hạn 45 giây), 0 lỗi fetch ≥400 / console. Trả localStorage như cũ sau khi thử
   (zn_cua_hang "370", zn_active_account "6ad369a7eab86410459c7c88", quanLyPhan "tong_quan").

## 4. Luật của chủ dự án (đầy đủ ở docs/ban-giao/ghi-nho/)

- **Trình việc**: MỌI mục trình chủ dự án = đề xuất + nguyên nhân + căn cứ chứng minh + hệ quả từng lựa chọn + tiền. Cấm liệt
  kê trơn (bị mắng nhiều lần). Không hỏi vặt; chỉ hỏi khi tiêu tiền / không hoàn tác / đổi điều đã chốt — gom câu hỏi.
- **Không tự đổi điều đã chốt** (màu, thứ tự, tuỳ chọn "không gài cứng"…). Muốn đổi: hỏi, nêu cũ → mới.
- **Sửa lỗi phải sửa MỌI chỗ cùng loại** (quét bằng máy, không liệt kê tay).
- **Không tiêu tiền khi chưa được phép** (AI, quảng cáo). Đẩy bài quảng cáo: báo số tiền trước.
- **Không xoá vĩnh viễn dữ liệu** tự ý; không tạo tài khoản / gõ mật khẩu thật; mật khẩu admin chủ dự án tự gõ.
- **Thử thật thì đọc trạng thái gốc trước, thử xong trả lại đúng như cũ.**
- **Khối não** (tài liệu / giao vai trò / cách hoạt động): CHỈ làm sau cùng, khi mọi thứ khác đã hoàn hảo và đã báo cáo
  "không còn vấn đề". Bản đề xuất có sẵn: `docs/de-xuat-khoi-nao.md` — chưa trình lại.
- Thiết kế giao diện: màn Tổng quan là mẫu (màu đa dạng theo AI: ① xanh, ② đỏ, ③ tím, ④ vàng; sợi nối phát sáng; thẻ trong
  suốt viền màu "khung-muc"); thanh 4 bước (Hướng dẫn AI → Đang làm → Kết quả → Nhật ký) MỘT màu theo AI; không nút trắng.
- Tên gọi: "Cửa hàng" (đơn vị có bộ não), "Fanpage" (Facebook). Chữ cho khách: "Vui lòng", không "Hãy".
- Kênh = nhân viên: chuyển / gỡ kênh "ra đi người không, quay về người không" (dữ liệu khách + việc ở lại cửa hàng).
- Coi AI là học trò yếu: chặn lỗi bằng code / quy trình, không chạy thử tốn tiền để "tìm mô hình hoàn hảo".

## 5. Đã hoàn thành (mới nhất trước; chi tiết từng mục trong git log + docs/ton-dong.md)

- **H15 / H15b** — AI Nội dung không bịa cam kết khi cửa hàng chưa có tài liệu (đổi trả, bảo hành, khan hiếm, dùng thử,
  kiểm định, lời chứng đám đông); tên Fanpage đúng nguyên văn; chỗ quyết định chung `coTaiLieu` (knowledge.ts). Đo thật: 0 câu
  cam kết, tên đúng 4/4.
- **H14** — câu dặn chung "Viết bằng chữ thường…" làm AI viết toàn chữ thường cho khách (5/8 tin) → sửa; đo 23/23 câu viết hoa.
- **H13** — launch.json chỉ gắn máy chủ (sau sự cố TD-31).
- **H12** — đọc đúng trường tài khoản quảng cáo (`minimumDailyBudget`, `selectable`, `billingStatus`, nguồn tiền nguyên văn);
  chặn đẩy bài: nhiều tài khoản chưa chọn / không chạy được / thiếu thanh toán / dưới tối thiểu / chạm trần chi tiêu.
- **H11 / H11b / H11c** — nối Quảng cáo Meta theo cửa hàng (`/connect/facebook/ads`, máy chủ tự chọn đúng Fanpage); "đã nối"
  = thành công; hết báo nhầm lỗi sau khi nối kênh (phiên cũ). Thử thật: cửa hàng 12 và cửa hàng 1 đều đã nối quảng cáo.
- **H10** giọng điệu AI Nội dung (066) · **H9** nhắm tỉnh / sở thích (thử thật: Hà Nội 3983, dự báo 41,6–49tr → 5–5,9tr →
  2,9–3,4tr) · **H8** đọc tài liệu có trần · **H7** ④ chấm mỗi ngày (065) · **H6** đổi / huỷ lịch bài · **H5** thử thật TD-15/17,
  gỡ kênh TikTok · **H1–H4** giao diện hệ thống, dọn mã chết, đối soát tiền.
- Nối lại TikTok (cửa hàng 1) thật: kênh mới, nhiệm kỳ mới, không kéo dữ liệu cũ.

## 6. Dữ liệu thật hiện có (Neon) — cẩn thận

- Tài khoản chủ dự án: user_id 5 (admin). Cửa hàng: **47** (tên "1": Facebook "Tư Vấn Tài Chính", Instagram, TikTok,
  Meta Ads), **370** (tên "12": Facebook "Chạm Tay Vạn Điều Hay", Meta Ads), "123" (chưa kênh).
- Tài khoản quảng cáo (cùng người Facebook): `act_867161792911070` "Tuan Duong" — **VISA *8686** (đã chọn hẳn cho 370);
  `act_1357505662010463` "Dương Tuấn" — số dư trả trước **0 ₫**. Tối thiểu Meta 26.085 đ/ngày.
- 7 bảng sao lưu `*_truoc_057…060`: giữ tới ~06/11/2026, xoá phải hỏi chủ dự án.
- Chưa có quảng cáo / chiến dịch nào được tạo. Chưa có bài nào đăng từ cửa hàng 370.

## 7. CÒN MỞ — làm tiếp từ đây (thứ tự đề xuất)

1. **Chờ chủ dự án** (đã trình đúng khuôn 24/10, chưa trả lời):
   a. **Đẩy bài thử lần đầu** (chủ dự án ĐÃ đồng ý chạy thử): cần biết Fanpage "Chạm Tay Vạn Điều Hay" bán gì → soạn bài không
      cam kết → gửi duyệt → đăng → đẩy 30.000 đ × 1 ngày, VISA *8686, Hà Nội 25–45, mục tiêu nhắn tin. Hoặc chủ dự án nói
      "đăng bài 1" (bài chào chung đã đo, 0 cam kết). Ghi: ID bài, lệnh gửi, id chiến dịch / quảng cáo, trạng thái, tiền đã chi
      đọc từ nhà cung cấp sau ~1 giờ và lúc kết thúc. Lỗi Meta → dừng, báo nguyên văn.
   b. **TD-32** lời đọc / chữ trên hình video: đề xuất luôn cấm bịa khi cửa hàng chưa có tài liệu (đổi điều đã chốt → chờ).
   c. Chọn tài khoản quảng cáo cho cửa hàng 1 (đề xuất VISA *8686; Fanpage tài chính có thể vướng danh mục đặc biệt Meta).
   d. Cũ: TD-14 (khoá tài khoản có kênh thật), TD-18 (hội thoại chỉ xem — chờ chuyển kênh thật), đường hỗ trợ ĐÃ ĐẶT 30/10
      (VITE_SUPPORT_URL="https://zalo.me/0763012345" trong .env + khoa-api.env, chủ dự án cho số), tên sản phẩm chính thức (tạm "Quản lý Fanpage"), khoá OpenRouter riêng cho nghiên
      cứu, xoá 7 bảng *_truoc_* (~06/11). Hạn mức kênh theo gói: làm khi có gói trả phí.
2. **TD-29** cache ngắn danh sách tài khoản quảng cáo khi tìm tỉnh / sở thích (làm khi chậm / chạm hạn mức).
3. **TD-30** allowlist `adAccountId` khi nối quảng cáo (cửa hàng thứ hai cùng người Facebook thấy tài khoản của nhau).
4. **TD-25** "Dùng tệp đã lưu" sau cờ `ADS_NHAM_TEP_DA_LUU` (tắt) — bật chỉ sau lần đẩy thật đầu tiên đạt + thử tệp riêng.
5. **TD-28** màn Kịch bản tô "Thân thiện" khi chưa có dòng cấu hình (chấp nhận; sửa một dòng nếu chủ dự án muốn).
6. Sau khi MỌI thứ trên xong và báo cáo "không còn vấn đề" → mới trình lại **khối não** (`docs/de-xuat-khoi-nao.md`).

Lỗi đã biết chưa sửa: xem `docs/ton-dong.md` (TD-01 … TD-32; mục "ĐÃ…" là đã xử lý). Không có lỗi mức 3 nào đang mở mà chưa
ghi ở đó.

## 8. Công cụ hay dùng

- `docs/ban-giao/cong-cu/hang-doi.mts` — đếm hàng đợi webhook ("cho N"); sửa đường import nếu đổi máy.
- `docs/ban-giao/cong-cu/soat22.js` — soát 22 màn trong trình duyệt.
- `docs/ban-giao/cong-cu/jsx.py` — tiện ích sửa khối JSX.
- Chụp lời dặn bán hàng: `npx tsx --import ./scripts/loi-dan/moc-gia.mjs scripts/chup-loi-dan.mts <ra.json>`.
- Tài liệu Zernio: OpenAPI hiện hành tải `https://zernio.com/openapi.json` (bản trong docs/ đã cũ); đọc tài liệu TRƯỚC khi làm.
- Kịch bản tạm: để ở `~/.zn-tam/`, không để trong kho.

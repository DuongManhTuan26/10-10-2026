# Đề xuất KHỐI NÃO — tài liệu, giao vai trò, cách hoạt động (24/10/2026)

Chỉ là ĐỀ XUẤT, chưa làm gì. Chủ dự án hướng dẫn rồi mới làm (chốt 23/10). Mỗi mục: hiện trạng (đọc từ mã) → các
phương án → căn cứ → hệ quả → tiền.

## QUYẾT ĐỊNH 30/10/2026 (chủ dự án, cách A) — làm khi tới khối não

Cửa hàng PHẢI được huấn luyện (vai trò + mục đích + tài liệu) thì AI mới biết bán gì / tạo gì. Chưa huấn luyện là trạng
thái mặc định — KHÔNG vá từng đầu ra (bài / ảnh / video) cho ca "chưa tài liệu" (đó là vá ngọn). Khi làm khối não:
1. Thêm chốt gốc: cửa hàng chưa huấn luyện thì AI không tự chạy (viết bài / tự đăng / trả lời khách) — cách hiện cụ thể
   trình khi thiết kế khối não.
2. Cùng lượt đó GỠ hai nhánh "chưa tài liệu" còn lại (lúc ấy không bao giờ chạy nữa): content-ai.ts
   CHUA_CO_TAI_LIEU_BAI_VIET / khoiTaiLieuBaiViet (H15, 24/10) và sales-ai.ts CHUA_CO_TAI_LIEU. Giữ tới lúc đó vì cửa hàng
   chưa huấn luyện hiện vẫn chạy AI thật (370: 0 tài liệu).
Đã làm 30/10: gỡ nhánh "chưa tài liệu" của ảnh (0338842); bác "video chưa tài liệu cấm bịa" + "video không vẽ chữ".

## 0. Hiện trạng một khối não (mỗi cửa hàng một khối, 4 AI)

| | ① Nội dung | ② Quảng cáo | ③ Bán hàng | ④ Điều hành |
|---|---|---|---|---|
| Vai trò | 1 ô chữ tự do | 1 ô chữ tự do | 1 ô chữ tự do + các bước bán + luật nhường người + hàng rào | KHÔNG nhận lệnh; quy trình 7 bước do code cố định; ô chữ = "bối cảnh" |
| Tài liệu | kho riêng, đọc ≤ 24.000 ký tự | kho riêng, ≤ 24.000 | kho riêng, ≤ 40.000 | đọc tài liệu của cả 3 làm bằng chứng |
| Giọng | 4 giọng (H10) | — | 4 giọng | — |
| Mô hình | Sonnet 5 | Sonnet 5 | Sonnet 5 | Opus 5.5 chẩn đoán + GPT-5.6 Terra kiểm |
| Tự chạy | lịch tự đăng | — (đẩy bài bấm tay) | trả lời khách 24/7 | chấm mỗi ngày (H7), chỉ đề xuất |

Tài khoản mới: 4 ô vai trò để TRỐNG (cố ý — mẫu cũ "tư vấn tài chính" nằm sai shop nhiều tháng).

Ba khoảng hở đọc được từ mã:
- **H-a. Một thông tin, nhập nhiều chỗ.** Bảng giá / chính sách phải tải lên riêng cho ① ② ③. Sửa giá ở ③ mà quên ① →
  bài đăng nói giá cũ. ④ có mã nguyên nhân "tai_lieu_sai_gia" nhưng không có nơi nào là "bản đúng" để đối chiếu.
- **H-b. Vai trò là chữ tự do.** Chủ shop không biết viết gì; ô trống thì AI chạy với vai mặc định chung chung.
- **H-c. Vòng lặp chưa khép.** ④ đề xuất (24 mã hành động: sửa tài liệu, sửa lời dặn bán hàng, đổi đối tượng…), chủ shop
  bấm Duyệt thì CHỈ đổi trạng thái thành "đã duyệt" (so-loi.ts chuShopQuyet) — không AI nào nhận việc, không đo lại sau.

## 1. Tài liệu khối não (H-a)

- **PA1 — Kho chung của cửa hàng + nhãn "AI nào đọc".** Một bảng giá tải một lần, đánh dấu ①②③ đọc. Mỗi AI vẫn có tài liệu
  riêng (vd. ① mẫu bài hay, ③ hỏi–đáp).
  Căn cứ: nguyên tắc "4 AI một khối liền mạch"; ④ cần một nguồn đúng để bắt sai giá.
  Hệ quả: đổi lược đồ ai_documents (thêm cột phạm vi), giao diện thẻ Hướng dẫn AI đổi; dữ liệu cũ (Neon hiện 0 tài liệu)
  không phải chuyển. Trần ký tự mỗi AI giữ nguyên.
  Tiền: 0 (không gọi AI thêm).
- **PA2 — Giữ kho riêng, thêm nút "chép sang AI khác" + cảnh báo lệch.** Ít đổi hơn; vẫn hai bản, vẫn có thể lệch.
- **PA3 — Giữ nguyên.**
- Đề xuất: **PA1**.

## 2. Giao vai trò cụ thể (H-b)

- **PA1 — Hồ sơ cửa hàng chung (khung có ô) + lời dặn riêng ngắn.** Ô chung: bán gì, khách là ai, giá khoảng, điểm khác
  biệt, điều cấm nói, giọng thương hiệu. Code ghép hồ sơ vào lời dặn của cả 4 AI; mỗi AI thêm 1 ô "lưu ý riêng".
  Căn cứ: "coi AI là học trò yếu — cầm tay chỉ việc": ô có khung dễ điền đúng, code kiểm được ô thiếu (vd. thiếu "điều
  cấm nói" → ④ báo).
  Hệ quả: thêm một bảng / cột hồ sơ; màn Hướng dẫn AI có phần chung. Lời dặn bán hàng đổi → phải chụp lại mẫu lời dặn và
  duyệt diff như mục 4+5.
  Tiền: 0.
- **PA2 — Giữ ô chữ tự do, thêm mẫu điền sẵn có chỗ trống ("Shop bán …, khách thường …").** Rẻ; nhưng mẫu dễ bị bỏ
  nguyên, đúng lỗi "tư vấn tài chính" cũ.
- **PA3 — AI hỏi chủ shop từng câu rồi tự viết vai trò.** Tiện cho chủ shop; tốn tiền AI mỗi lần, và chữ AI viết lại
  phải được duyệt.
- Đề xuất: **PA1**.

## 3. Cách thức hoạt động — khép vòng ④ (H-c)

- **PA1 — Duyệt = giao việc có địa chỉ.** Mỗi mã hành động gắn một người nhận (①②③ / chủ shop / hệ thống, đã có sẵn trường
  nhanVien). Việc code làm được thì code làm sau khi duyệt (vd. sửa_tai_lieu → mở đúng tài liệu cần sửa kèm đoạn sai;
  doi_gio_dang → đề nghị lịch mới để bấm một lần). Việc dính tiền (tăng / giảm ngân sách, đẩy bài) luôn chờ chủ shop bấm.
  ④ ngày hôm sau đo lại đúng chỉ số đã nêu → ghi "có tác dụng / không".
  Căn cứ: định nghĩa khối não của chủ dự án ("vòng lặp tự hoàn thiện"); LUAT-mot-thu (mỗi lần đổi một thứ để đo được).
  Hệ quả: thêm trạng thái "đang làm / đã đo" cho đề xuất; mỗi mã hành động một màn đích. Làm dần theo mã hay gặp nhất.
  Tiền: lượt đo lại do code tính, 0 đồng; lượt ④ chấm hằng ngày giữ trần hiện tại (0,3 USD / lượt, 1 USD / ngày cả hệ thống).
- **PA2 — Duyệt = ghi việc vào danh sách "Cần xử lý" của chủ shop.** Không tự làm gì; ít rủi ro, nhưng vẫn là người làm tay.
- **PA3 — Cho ④ chế độ tự động trong trần tiền.** Đã có khung (cheDo 'tu_dong' + tranTien) nhưng chưa bật; chỉ nên xét
  sau khi PA1 chạy thật đủ lâu và tỉ lệ đề xuất bị bác thấp.
- Đề xuất: **PA1 trước, PA3 để sau**.

## 4. Thứ tự đề xuất (nếu chủ dự án đồng ý)

1. Hồ sơ cửa hàng chung (mục 2 PA1) — nền cho cả ba mục.
2. Kho tài liệu chung (mục 1 PA1).
3. Khép vòng ④ cho 3 mã hay gặp nhất trước (sửa tài liệu, sửa lời dặn bán hàng, đổi giờ đăng).
Mỗi bước theo quy trình hai phiên: thiết kế → kiểm duyệt → code → thử tự hoàn tác → gộp.

## 5. Cần chủ dự án quyết

1. Mục 1: PA1 / PA2 / PA3?
2. Mục 2: PA1 / PA2 / PA3? Danh sách ô của hồ sơ chung (đề xuất 6 ô ở trên) — thêm / bớt?
3. Mục 3: PA1 / PA2? Việc nào chủ dự án muốn ④ được tự làm sau khi duyệt, việc nào luôn phải bấm tay?

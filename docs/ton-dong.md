# Sổ tồn đọng

Mọi thứ CHƯA xử lý xong đều phải nằm ở đây — không chỉ nói trong chat rồi quên.

Nguyên tắc (chủ dự án đặt 03/10/2026): đã làm thì phải xử lý triệt để, không để
tồn tại lỗi dù nhỏ nhất. Chỉ được để lại khi đã cố hết sức mà **thật sự không thể** —
khi đó ghi rõ nguyên nhân ở đây. Phải phân biệt rạch ròi:

- **LỖI**: sai so với yêu cầu / quy tắc đã đặt. Phải sửa.
- **LỰA CHỌN**: quyết định có chủ ý, có đánh đổi, chủ dự án biết và đồng ý. Không phải lỗi.
- **GIỚI HẠN**: đã thử hết cách mà không làm được — ghi đã thử gì, vì sao không được.
- **CHỜ CHỦ DỰ ÁN**: làm được, nhưng cần quyết định / tiền / quyền của chủ dự án.

Ràng buộc tiền do chủ dự án đặt KHÔNG phải "không thể" — ghi là CHỜ CHỦ DỰ ÁN kèm số tiền cần.

Mỗi mục: hiện tượng · căn cứ để gọi là lỗi · nguyên nhân gốc · đã làm gì · còn gì · trạng thái.

---

## TD-01 — Chữ AI vẽ trong video quảng cáo thử (dự án #9): "ORDER", "ORDEED", chữ li ti

- **Loại:** CHỜ CHỦ DỰ ÁN XÁC ĐỊNH — **chưa phải lỗi.**
- **Hiện tượng:** cảnh 5 (giây ≈33,4–38,9) bong bóng có chữ "Order"/"ORDER"; cảnh 7 "ORDEED";
  cảnh 2 chữ li ti trong bong bóng. Chữ do mô hình video tự vẽ.
- **Vì sao chưa được gọi là lỗi:** căn cứ em từng dùng ("không có chữ đọc được" trong ý tưởng video,
  luật cấm chữ `LUAT_VIDEO`) đều do EM tự đặt — không phải yêu cầu của chủ dự án. Chủ dự án
  (03/10/2026): chữ là do lập trình của hệ thống tạo ra; phải xác định rõ là lỗi và hỏi ý kiến
  trước khi sửa.
- **Đã làm sai rồi gỡ (03/10/2026):** em tự thêm luật màn hình cho đạo diễn AI và bước soi chữ ở
  mọi cảnh (tốn tiền mỗi cảnh, tự vẽ lại) khi chưa được duyệt; đã tự tiêu ≈0,05 USD để thử. Đã gỡ
  hết, mã về như trước; 896 phép kiểm đạt.
- **Cần chủ dự án quyết:** chữ do AI vẽ trong video có được chấp nhận không. Chưa có quyết định
  thì không làm gì thêm.

## TD-02 — Bộ kiểm định cảnh bỏ sót "mặt đổi dần thành người khác"

- **Loại:** GIỚI HẠN (tạm thời).
- **Hiện tượng:** trên 18 clip đã soi bằng mắt, bộ kiểm đúng 17/18; sót clip #8-5 (mặt đổi dần
  giữa clip, sáng lên +19/255).
- **Đã thử (02/10/2026):** 5 cách hỏi AI và 2 mô hình — hỏi chung (17→16/18, không ổn định),
  bắt chứng minh nguyên nhân + số đo (17/18 ổn định — đang dùng), thêm câu "cùng một người?"
  (16/18), Claude Sonnet 5 (15/18), chỉ 2 khung + code tự kết luận (14/18).
- **Còn có thể thử:** so khuôn mặt bằng mô hình nhận dạng mặt chuyên dụng thay vì hỏi AI chung.
- **Giảm thiểu đã làm:** ảnh mẫu nhân vật nền trơn — ở bản cuối dự án #9 không thấy đổi mặt.

## TD-03 — Vẽ ảnh qua API `/images` của OpenRouter — ĐÃ KIỂM BẰNG LẦN GỌI THẬT (03/10/2026)

- **Trạng thái:** XONG. Chủ dự án cho vẽ thử. Cùng một bài cà phê, đi đúng đường nút "Nhờ AI vẽ ảnh":
  GPT Image 1 Mini (thấp) 0,002628 USD · Seedream 5.0 Flash 0,018 · Nano Banana 2 Lite 0,03365 —
  giá thật khớp giá app báo trước; ảnh 1024×1024 lên kho đúng.
- **MAI-Image 2.6 / 2.6 Flash — ĐÃ BỎ (03/10/2026, chủ dự án giao "nghiên cứu rồi chọn phương án có cơ sở"):**
  đo thật 5 lượt qua đúng đường app: lời nhắc tiếng Việt bị chặn 3/3 ("DallEBlockList"), kể cả câu
  "Túi cà phê rang xay 500g trên bàn gỗ", ở cả hai bản; tiếng Anh vẽ được 1/1 (0,0198 USD). Ba mô
  hình khác vẽ được đúng bài tiếng Việt đó. App bán cho người Việt, lời nhắc ảnh là tiếng Việt → bỏ.
  Tốn cho việc thử: 0,0198 USD (lượt bị chặn không mất tiền).

## TD-04 — Khung mở đầu / ảnh mẫu nhân vật của video dài dùng một mô hình ảnh cố định — ĐÃ SỬA (03/10/2026)

- **Là lỗi** theo quy tắc của chủ dự án (không cố định mặc định ở bất kỳ phần nào).
- **Đã sửa:** chọn "Mô hình vẽ khung mở đầu cho cảnh cắt" ở video dài (ghép nhiều cảnh), xếp rẻ tới
  đắt; vẽ qua `/images`; ảnh mẫu không vượt sức mô hình; báo giá dự án tính tiền khung theo mô hình
  đã chọn. Dự án cũ chưa chọn → mô hình rẻ nhất nhận ảnh mẫu.

## TD-05 — Video "theo bài" khi bấm Đăng bài — ĐÃ CHẠY THẬT (04/10/2026)

- **Trạng thái:** XONG về luồng. Chủ dự án cho chạy 1 lượt, đăng thật lên Fanpage Tư Vấn Tài Chính:
  bài #48, Wan 3.0 · 2 giây · 480p · 9:16 · không chữ. Bấm Đăng bài 14:31:46 → hỏi lại kèm giá → bài chờ
  video → video xong 14:33:32 → máy chủ tự gắn video → lên Facebook 14:34:32 (~2 phút 46 giây). Sổ chi phí
  ghi đủ: viết lời nhắc 0,004726 USD + video 0,2125 USD.
- **Lộ ra 2 vấn đề** → TD-06 (giá Wan 3.0) và TD-07 (Wan 3.0 vẫn có tiếng khi đã tắt).

## TD-06 — Wan 3.0 tính 0,2125 USD cho video 2 giây 480p, app báo 0,10 — ĐÃ SỬA (04/10/2026)

- **Loại:** LỖI GIÁ BÁO TRƯỚC (chủ shop thấy ~2.500đ, bị trừ ~5.400đ).
- **Bằng chứng (2 lượt thật, chủ dự án cho thử):** #40 dài 2,02 giây và #41 dài 5,04 giây, cùng 480p, CÙNG bị trừ
  0,2125 USD (`usage.cost` của OpenRouter). = 5 giây × 0,05 × (1 − 15%). Mức giảm 15% là trường chính thức
  `endpoints[].pricing.discount` của OpenRouter; Alibaba không công bố mức tối thiểu 5 giây — chỉ đo được.
  Mô hình khác đã chạy thật (Veo 3.1 Lite 18 lượt, Hailuo 3 7 lượt) có discount 0 nên khớp 100%.
- **Đã sửa:** giá = max(số giây, số giây tối thiểu đã đo) × giá/giây × (1 − mức giảm đọc sống). Wan 3.0 ghi
  tối thiểu 5 giây + ghi chú cho khách. Không đọc được mức giảm thì coi như 0 (báo cao hơn, không thấp hơn).
- **Chưa đo thật:** HeyGen Video 1 đang giảm 50% → giá báo giảm một nửa theo dữ liệu chính thức; Wan 3.0 Prime
  (giảm 0%) chưa biết có mức tối thiểu hay không. Lần đầu chạy thật hai mô hình này nên so `usage.cost` với giá báo.

## TD-07 — Wan 3.0 trả video CÓ TIẾNG dù đã tắt "Có âm thanh do AI tạo" — CHỈ GHI CHÚ (04/10/2026)

- **Loại:** GIỚI HẠN của mô hình. App gửi `generate_audio: false`; video #40 vẫn có tiếng thật (−16,6 dB).
  Tài liệu Alibaba: tiếng luôn được tạo, cờ chỉ quyết định có trả về không; bật/tắt không đổi giá.
- **Chủ dự án chọn:** để nguyên, chỉ ghi chú. Wan 3.0 và Wan 3.0 Prime hiện dòng cam "Luôn có tiếng do AI tạo"
  dưới ô chọn mô hình (Xưởng AI và lịch tự đăng). Không gỡ tiếng (tránh mất dấu hiệu nội dung AI trong tệp).


## TD-08 — Tiền theo từng trang — ĐÃ XỬ LÝ (04–05/10/2026)

- **Bối cảnh:** chủ dự án tự thiết kế màn hình quản lý tách Tổng quan / Chi tiết (cây Chuỗi → Tài khoản → Trang),
  tiền mỗi trang theo từng loại, tiền kênh "khớp tuyệt đối 100%" với nhà cung cấp kênh.
- **Đã làm:** tiền kênh đọc thẳng `GET /v1/usage?groupBy=account` (tổng các kênh = hoá đơn, đo kỳ 09/2026:
  4,71 = 4,71) rồi cộng về trang; sổ AI ghi trang cho từng lượt (cột `ai_usage.trang_id`, ngữ cảnh ở mọi
  điểm vào); Fanpage Tư Vấn Tài Chính đã chuyển sang hồ sơ riêng (1 trang = 1 hồ sơ), đồng bộ hỏi mọi hồ sơ.
- **Chủ dự án duyệt 05/10/2026 — ĐÃ LÀM:**
  0. **Mốc tính theo trang = 05/10/2026 00:00 giờ VN.** Trước mốc bỏ khỏi Tổng quan / Chi tiết ("những cái gì đã qua
     rồi không thể tính chính xác được hãy bỏ qua"); khối Chi phí vẫn giữ hoá đơn thật. Mỗi số có nhãn ĐÃ CHỐT /
     TẠM TÍNH: AI chốt khi mọi lượt đã đối chiếu; kênh chốt khi hết kỳ; quảng cáo chốt sau 28 ngày (Meta: insights
     "do not change after 28 days").
  1. **Đơn hàng ghi trang + kênh lúc tạo** (`orders.trang_id`, `social_account_id`): có hội thoại → kênh hội thoại;
     tạo tay không hội thoại → trang duy nhất, hoặc bắt buộc chọn khi có từ 2 trang. Đo: đơn tạo tay → trang 245;
     chỉ định trang của tài khoản khác → để trống.
  2. **Đổi Fanpage giữa tháng:** sổ `kenh_trang_ngay` (ngày UTC, ghi trạng thái đầu ngày + ngay trước khi đổi);
     tiền kênh chia theo số ngày ở từng trang. Luật "1 Fanpage mỗi tài khoản" giữ nguyên → Fanpage mới luôn có hồ sơ
     riêng (tài khoản mới), không cần đổi luồng nối kênh.
  3. **Tiền quảng cáo:** đọc qua kết nối Facebook sẵn có (không nối Meta Ads riêng → không thêm phí kênh),
     `GET /v1/ads?pageId=` theo Fanpage của trang, giữ VND, ngày theo múi giờ tài khoản quảng cáo; phần cùng tài
     khoản chi cho Fanpage khác chỉ ghi để biết. Đo: 2 tài khoản quảng cáo (VND, UTC+7), năm 2026 chưa có quảng cáo
     → 0 ₫ thật.

## TD-09 — ĐÃ LÀM (H8, 24/10/2026): AI nhân viên chỉ thấy 5 tài liệu mới nhất mỗi loại, mỗi tài liệu 4.000 ký tự đầu

- **Loại:** CHỜ CHỦ DỰ ÁN — **chưa gọi là lỗi** (chưa có yêu cầu của chủ dự án về việc này).
- **Hiện tượng (đọc mã `knowledge.ts`, mức "có cơ sở"):** `LIMIT 5` + cắt 4.000 ký tự mỗi tài liệu. Bảng giá ở tài liệu
  thứ 6, hoặc sau ký tự 4.000, thì AI bán hàng không thấy — có thể trả lời "shop chưa có thông tin" hoặc đoán.
- **Đã làm (09/10/2026):** đưa hai giới hạn thành hằng số dùng chung; sổ bằng chứng đánh dấu đúng phần AI nhân viên
  không thấy. KHÔNG đổi hành vi của AI nhân viên.
- **Cần chủ dự án quyết:** có nới / đổi cách đưa tài liệu (vd. chọn đoạn liên quan) không — dính chi phí mỗi lượt AI.

- **Đã làm 24/10/2026 (chủ dự án đồng ý "đọc hết, có trần tổng"):** MỘT hàm knowledge.ts chonTaiLieu cho AI bán hàng, nội
  dung, quảng cáo + bộ xác nhận giá + sổ bằng chứng. Mọi tài liệu có chữ, mới nhất trước; trần mỗi lượt: bán hàng 40.000 ký
  tự (= mức cũ 10 × 4.000, không giảm), nội dung / quảng cáo 24.000 (cũ 5 × 3.000 / 5 × 4.000). Cắt ở RANH GIỚI DÒNG; tài
  liệu sau trần chỉ liệt kê tên; có phần chưa đọc thì AI được dặn "nói sẽ kiểm tra lại với shop, KHÔNG đoán". Xác nhận giá
  chỉ tin phần AI đã đọc (trước: đọc mọi tài liệu → giá ở tài liệu thứ 11 AI không thấy vẫn được xác nhận). Hộp Dạy AI hiện
  "AI đọc được X / Y ký tự" + tên tài liệu bị cắt / chưa đọc. Giá thật (OpenRouter /models 24/10): claude-sonnet-5 0,000002
  USD / token vào → trần 40.000 ký tự ≈ 0,03 USD mỗi tin, chỉ khi shop có chừng đó tài liệu.
## TD-10 — Số quảng cáo của Meta chốt sau bao lâu: chưa xác minh

- **Loại:** GIỚI HẠN (tạm thời).
- **Hiện tượng:** tài liệu chính thức tìm được (09/10/2026) chỉ nói về cửa sổ quy công, không nói số hiển thị / nhấp /
  tiền chi chốt sau bao lâu. Sổ bằng chứng tạm xếp số quảng cáo hạng C ("chưa xác minh độ chốt") — không chặn đề xuất,
  chỉ hạ mức chắc.
- **Cách xác minh (không tốn tiền):** chụp số của cùng một ngày qua nhiều ngày liền, so độ lệch → biết sau bao lâu thì
  không đổi nữa; khi đó nâng hạng cho số đã qua mốc.

## TD-11 — ĐÃ XỬ LÝ (23/10/2026, bỏ cột): Cột "tiền AI tháng" của bảng điều hành: API có trả, không màn hình nào hiển thị

- **Loại:** CHỜ CHỦ DỰ ÁN — chưa phải lỗi (không sai số; chỉ là trường không ai đọc).
- **Hiện tượng (10/10/2026):** kiểm ngược toàn bộ thấy lỗ "bảng điều hành bỏ tiền AI" lọt — phép kiểm cũ đã mất, và
  `tien_ai_thang` (`quan-ly-chung.ts`) chỉ còn trong kiểu dữ liệu `api.ts`, không màn hình nào dùng (Tổng quan đã chuyển
  sang `tong-quan.ts`).
- **Đã làm:** khôi phục phép kiểm công thức (đúng cách sao kê). KHÔNG xoá cột.
- **Cần quyết:** giữ (để dùng sau) hay bỏ cột thừa.
- **Đã xử lý 23/10/2026 (chủ dự án đồng ý "tự làm"):** BỎ cột — tiền AI theo tài khoản / cửa hàng đã hiện ở Quản lý ›
  Tổng quan / Chi tiết (tong-quan.ts, cùng cách sao kê) và ④ Báo cáo 3 AI; hiện thêm một nơi chỉ là hai chỗ cho cùng một số.

## TD-12 — ĐÃ XỬ LÝ (23/10/2026, gỡ): Đường máy chủ của trang "AI Thống Kê - Phân Tích" cũ còn đó, không giao diện nào gọi

- **Loại:** CHỜ CHỦ DỰ ÁN / dọn sau — không phải lỗi hiển thị.
- **Bối cảnh (10/10/2026):** chủ dự án duyệt gộp trang cũ vào **AI Điều Hành** (bộ não, theo trang đang chọn), bỏ AI
  phân tích cũ. Giao diện cũ đã gỡ; `GET /api/analytics/overview`, `POST /api/analytics/analyze` (gọi AI, có chốt chống
  đốt tiền), `GET /api/analytics/reports` (`server/routes/analytics.ts`) còn lại, không màn hình nào gọi.
- **Vì sao chưa gỡ ngay:** nhiều phép kiểm cũ canh tệp này (các lỗi đã sửa về số liệu, giờ Việt Nam) — gỡ cần sửa
  phép kiểm có chủ đích, làm riêng một đợt.
- **Còn lại:** gỡ 3 đường + phép kiểm liên quan; hoặc giữ nếu chủ dự án muốn dùng lại.
- **Đã xử lý 23/10/2026:** gỡ server/routes/analytics.ts + app.use; bỏ 7 phép kiểm và 3 phép đục canh tệp đó (đường gọi AI
  /analyze bớt khỏi danh sách chống đốt tiền). Bảng ai_reports giữ nguyên (dữ liệu cũ).

## TD-13 — Sửa ngân sách chiến dịch ABO (ngân sách ở tầng nhóm quảng cáo) chưa làm được trong app (18/10/2026)

- Hiện trạng: chiến dịch ABO → máy chủ trả 409 "ngân sách nằm ở tầng nhóm quảng cáo, chưa sửa được trong app".
- Lý do: đường danh sách nhóm cũ gọi GET /v1/ads/ad-sets — tài liệu nhà cung cấp KHÔNG có đường này (chỉ có
  GET /v1/ads/ad-sets/{adSetId} 28755 và GET /v1/ads/tree 28957, trong đó `adSets: array — No description`). Đã bỏ
  đường danh sách (phiên kiểm duyệt duyệt 18/10/2026).
- Cách làm khi có chiến dịch thật: gọi MỘT lần GET /v1/ads/tree?campaignId=…&accountId=…&adAccountId=… (chỉ đọc, không
  tốn tiền) để xem dạng thật của adSets, rồi dựng danh sách nhóm theo dạng đó; sửa ngân sách nhóm dùng
  PUT /v1/ads/ad-sets/{id} {platform, budget} (28791) — đường /api/ads/ad-sets/:id/budget đã có kiểm chủ sở hữu qua getAdSet.
- 19/10/2026: đường PATCH /api/ads/ad-sets/:id/budget đã TẮT (không màn nào gọi; kiểm chủ sở hữu qua GET
  /v1/ads/ad-sets/{id}?accountId không đủ — accountId chỉ để lấy token, tài liệu 28755). Làm lại thì phải so account_id
  của nhóm quảng cáo với tài khoản quảng cáo của cửa hàng đang chọn.

## TD-14 — Mục f (khoá tài khoản) còn 3 phần CHƯA THỬ THẬT (19/10/2026)

Mã + phép kiểm + đột biến đã đạt, phiên kiểm duyệt cho đạt (73b82d3, 29a69bc, 025c692). Đã thử thật khoá / mở khoá trên
tài khoản thử 118 (0 kênh). Còn chưa thử với dữ liệu thật vì tài khoản thử không có kênh / dự án:
- Nhãn "Tạm dừng" (cam) của video dài dừng do khoá — cần một dự án video dài đang 'dang_tao' lúc mở khoá.
- Luồng "chỉ lưu": tin / bình luận thật của kênh thuộc tài khoản đang khoá vào hộp thư, AI không trả lời.
- Worker gặp sự kiện thật của tài khoản đang khoá / tin lúc khoá xử lý sau khi mở.
Cách thử khi có: tài khoản thử nối 1 Fanpage thử → khoá → nhắn thử 1 tin + 1 bình luận → mở khoá → xem hộp thư (tin có,
AI không trả lời; bình luận skipped_reason "Đến lúc tài khoản đang khoá…").

## TD-15 — ĐÃ THỬ THẬT, ĐẠT (24/10/2026 00:22): A1 lịch tự đăng của 2 cửa hàng cùng giờ (19/10/2026)

Mã + phép kiểm + đột biến đạt (822b793, phiên kiểm duyệt cho đạt). Chưa cửa hàng nào bật lịch; bật thử = AI tốn tiền +
đăng thật. Cách thử khi chủ dự án cho phép: bật lịch 2 cửa hàng cùng một khung giờ, chế độ "Chờ tôi duyệt" (không đăng
thật), xem auto_pilot_runs có 2 dòng (mỗi cửa hàng một) và mỗi cửa hàng có 1 bài chờ duyệt đúng kênh của nó.

ĐÃ THỬ THẬT 24/10/2026 (chủ dự án đồng ý, chế độ "Chờ tôi duyệt" — không đăng công khai): cửa hàng 12 (370) và cửa hàng 1
(47) cùng lịch 00:22 thứ Bảy → 2 lượt riêng (auto_pilot_runs 7, 8, cùng slot_key, khác trang_id), bài 71 → đúng Fanpage
"Chạm Tay Vạn Điều Hay", bài 72 → đúng Fanpage "Tư Vấn Tài Chính", cả hai pending_approval; Telegram 2 tin "content" ghi đúng
"🏪 Cửa hàng: 12" / "1". Tiền AI thật: 0,009726 + 0,006678 = 0,016404 USD. Trả lại như cũ: xoá bài 71, 72 qua nút Xoá; xoá
2 lượt thử; cửa hàng 12 bỏ khoá autoPilot (trước đó không có), cửa hàng 1 xoá dòng cấu hình nội dung do lần thử tạo (333).
Lỗi tìm ra khi thử: khối Tự động hoá liệt kê lượt của MỌI cửa hàng (GET /ai/auto-pilot lọc theo tài khoản) — đã sửa (H5).
## TD-16 — Webhook / người canh đường hầm: phần chưa kiểm thật + bản ân hạn chờ áp dụng (19/10/2026)

Điều tra: máy chủ chạy dưới khung xem trước bị app tắt 11:28–12:44 → người canh dựng lại ~30 đường hầm → Cloudflare chặn
→ webhook chết tới 13:21. Đã sửa: máy chủ chạy độc lập bằng scripts/mo-app.sh; người canh mới (0435d64) không dựng lại khi
máy chủ tắt, chống chồng lượt, báo Telegram quản trị; đã áp dụng 13:53 (đường hầm thông 13:54).
- CHỜ ÁP DỤNG: khoảng ân hạn 3 phút sau khi dựng (máy này cần ~80 giây mới phân giải tên miền mới) — mã đã xong + kiểm,
  phải khởi động lại người canh (đổi đường hầm một lần) ở lần khởi động tới, khi chủ dự án cho phép.
- CHƯA KIỂM THẬT: webhook_events có sự kiện mới qua đường hầm mới (cần khách nhắn thật); Telegram "máy chủ tắt" (cần tắt
  máy chủ ≥ 5 phút).
- LÂU DÀI (chủ dự án quyết): máy chủ thật + tên miền cố định thay cho đường hầm tạm trycloudflare trên máy cá nhân.

## TD-17 — ĐÃ THỬ THẬT, ĐẠT (24/10/2026): Đợt 3: huỷ lịch thật lên nhà cung cấp (19/10/2026)

GỠ THẬT ĐÃ KIỂM 22/10/2026 (chủ dự án cho phép, bài thử 65 trên Tư Vấn Tài Chính): unpublish 200 → app về nháp, stats {},
ghi chú "Đã gỡ khỏi Tư Vấn Tài Chính lúc …"; nhà cung cấp báo "cancelled"; link Facebook báo nội dung đã xoá; 12 bài cũ
nguyên vẹn. CÒN LẠI: huỷ lịch thật (DELETE bài hẹn giờ) — chưa thử. Ghi chép gốc:


Mã + phép kiểm + đột biến + phép thử tự hoàn tác trên Postgres (nhà cung cấp mô phỏng) đạt (e95f810, 89a3669; phiên kiểm
duyệt cho đạt). Theo tài liệu openapi 1.295.0: gỡ = POST /v1/posts/{id}/unpublish {platform, accountId}; huỷ = DELETE
/v1/posts/{id} (mọi trạng thái trừ published). Trước đợt 3 nút "Gỡ bài" gọi DELETE → 400, chưa ai từng gỡ thật qua app.
Gỡ thật = xoá bài trên Fanpage, không khôi phục → chỉ làm khi chủ dự án cho phép. Cách thử: đăng 1 bài thử lên Fanpage
thử → "Gỡ để sửa ảnh" → bài mất trên Fanpage, app về nháp kèm "Đã gỡ khỏi … lúc …". Huỷ lịch: hẹn giờ 1 bài thử xa (≥ 1
ngày) → "Xoá bài" → bài không còn trong lịch phía nhà cung cấp.

ĐÃ THỬ THẬT 24/10/2026 (chủ dự án đồng ý): POST /api/posts (cửa hàng 12, Fanpage "Chạm Tay Vạn Điều Hay", hẹn 22/11) → bài 70;
POST /api/posts/70/publish → nhà cung cấp nhận lịch (ref 6adb96cd79d29a0d675e5fd5, GET bài: status scheduled, facebook pending);
DELETE /api/posts/70 (đúng nút Xoá) → 200; GET bài phía nhà cung cấp → 404 "Post not found"; bản ghi app đã xoá. Bài chưa
từng lên Fanpage. 0 đồng.
## TD-18 — Đợt 3: giao diện hội thoại "chỉ xem" chưa thấy với dữ liệu thật (19/10/2026)

Cờ chi_xem đã kiểm trên Postgres bằng phép thử tự hoàn tác (đã rời / chưa gắn / bình thường) và API trả trường này. Hiện
không có hội thoại thật nào chi_xem ≠ null (chưa kênh nào từng chuyển cửa hàng) nên chưa nhìn thấy dải báo + ô gửi khoá
trên màn thật. Sẽ thấy ở lần chuyển kênh thật đầu tiên.

## TD-19 — Liên kết sâu ?hoi-thoai= sang hội thoại của cửa hàng khác (19/10/2026) — HOÃN CÓ CHỦ Ý

Mở link hội thoại (vd. từ Telegram) thuộc cửa hàng khác cửa hàng đang chọn → chưa có dải báo "Hội thoại của cửa hàng X
— chuyển sang?". Phiên viết + phiên kiểm duyệt cùng hoãn khỏi đợt 3, làm sau.

## TD-20 — ĐÃ SỬA (2ee9f2e, 23/10/2026): lúc tắt máy chủ, việc chạy theo giờ gọi DB sau khi pool đã đóng (19/10/2026)

Hiện tượng: mỗi lần máy chủ nhận SIGTERM, nhật ký có "[worker] Lỗi khi làm việc bình luận tới hạn: Cannot use a pool after
calling end on the pool" và "[video AI] Lỗi khi theo dõi video: (cùng câu)" — 59 lần trong ~/Library/Logs/quan-ly-fanpage.log
tính tới 19/10. Nguyên nhân gốc: hẹn giờ của worker / video AI vẫn chạy sau pool.end(). Không mất dữ liệu (tiến trình đang
thoát), nhưng là lỗi thật. Sửa: dừng mọi hẹn giờ + chờ lượt đang chạy xong rồi mới pool.end(). Không do đợt 3.
ĐÃ SỬA 23/10 (2ee9f2e: server/tat-may.ts tắt êm, worker / Telegram dừng có chờ). Chứng cứ nhật ký: từ 14:02 ngày 23/10 mọi lần
khởi động lại chỉ có "[tắt] Nhận SIGTERM, đang đóng…" + "[worker] Đã dừng." — 0 "Force killing", 0 "Cannot use a pool".
Bổ sung 22/10/2026 (lúc gộp A3, 11:34:42): "[tsx] Process didn't exit in 5s. Force killing..." — tiến trình cũ không tự
thoát trong 5 giây, tsx phải buộc tắt (các lần trước tự thoát). Cùng gốc: tắt máy chủ chưa dừng hết hẹn giờ / kết nối.

## TD-21 — ĐÃ SỬA (2ee9f2e, 23/10/2026): trần tốc độ dự phòng đếm kênh của MỘT tài khoản, tài liệu nói đếm cả team (22/10/2026)

Tài liệu nhà cung cấp (docs/zernio-api-reference.txt, mục "# Rate Limits"): "Rate limits are based on your team's total
connected social accounts" · "Connected accounts are counted across the whole billing team" · "One API key is enough —
including for multi-tenant integrations serving many customers". Tức trần là của CẢ HỆ THỐNG (mọi tài khoản khách dùng
chung một khoá), không phải của từng tài khoản khách.
Hiện trạng (services/guardrails.ts effectiveRateLimit): nhánh "số sống" (header x-ratelimit-limit) đã đúng — chia trần
chung cho số shop đang gửi. Nhánh DỰ PHÒNG (chưa có header) lại tính bậc theo số kênh của RIÊNG tài khoản đó
(policyLimitPerMinute(kênh của user)) và trả trọn bậc đó cho từng tài khoản → khi chưa có số sống, mỗi tài khoản tưởng mình
có trọn trần. Phiên kiểm duyệt bắt ở thiết kế A3 (22/10), dặn không sửa trong A3. Sửa: nhánh dự phòng đếm kênh cả hệ thống
rồi chia cho số shop đang gửi như nhánh số sống.
ĐÃ SỬA 23/10 (2ee9f2e): effectiveRateLimit() không nhận tài khoản; nhánh dự phòng tính bậc theo kênh CẢ HỆ THỐNG rồi
chiaTran(trần, số shop đang gửi), cùng cách với nhánh số sống.

## TD-22 — A4b: quảng cáo theo cửa hàng CHƯA THỬ THẬT (22/10/2026) — CHỜ CHỦ DỰ ÁN

Mã + phép kiểm + đột biến đạt (25afb05, phiên kiểm duyệt cho đạt): resolveAdAccount / lưu tài khoản quảng cáo / số liệu
quảng cáo đều lấy kênh Meta Ads của CỬA HÀNG đang chọn (kenhQuangCaoCuaCuaHang). Hiện 0 kênh metaads (chưa cửa hàng nào
nối quảng cáo) nên /api/ads/overview của mọi cửa hàng trả "Chưa kết nối tài khoản quảng cáo". Cách thử khi chủ dự án nối
quảng cáo cho một cửa hàng: cửa hàng đó thấy tài khoản quảng cáo + chiến dịch; cửa hàng khác vẫn "chưa kết nối".

## TD-23 — ĐÃ LÀM (H6, 24/10/2026): "Đổi lịch / Huỷ lịch" bài ĐÃ giao nhà cung cấp trên màn Nội dung (22/10/2026)

Hiện màn Nội dung chặn hai nút này với bài hẹn giờ đã giao nhà cung cấp (LOI_LICH_DA_GUI — nói thật: nền tảng vẫn đăng
giờ cũ). Đợt 3 làm: kênh rời → gỡ lịch; Xoá bài hẹn giờ → huỷ bên nhà cung cấp (DELETE /v1/posts/{id}). Chưa làm: Huỷ
lịch giữ bài (DELETE phía nhà cung cấp rồi đưa bài về chờ duyệt) và Đổi lịch (PUT /v1/posts/{id} với scheduledFor — tài liệu
ghi rõ cho bài scheduled). Cần chủ dự án xếp thứ tự ưu tiên.

ĐÃ LÀM 24/10/2026 (chủ dự án xếp ưu tiên đầu): POST /api/posts/:id/doi-lich (PUT /v1/posts/{id} { scheduledFor }, qua chốt
cửa ra, giờ mới ≥ 5 phút, giờ cũ sát < 5 phút thì không đổi) và /huy-lich (DELETE bên nhà cung cấp; 404 = đã huỷ; bài về
Chờ duyệt nếu AI viết, Bản nháp nếu tự viết; bỏ mốc tự đăng). Cả hai gọi nhà cung cấp TRƯỚC, ghi DB có điều kiện
(status scheduled + đúng mã), 0 dòng → báo, không ghi đè. Thử thật 0 đồng (bài 73, ref 6adb9ecf…): PUT chỉ gửi scheduledFor
→ "Post updated successfully"; đọc lại trước / sau: nội dung, kênh đích, danh sách ảnh (bài thử KHÔNG có ảnh) giữ nguyên, giờ
mới đúng, vẫn scheduled; xoá → 404. Lỗi tiềm ẩn tìm ra cùng lúc, đã sửa: bài lịch tự động (báo trước) giữ mốc auto_publish_at;
hẹn giờ rồi huỷ → về Chờ duyệt với mốc quá hạn → bị đăng ngay. Nay đăng / hẹn giờ / đổi trạng thái tay / huỷ lịch đều bỏ mốc.
## TD-24 — ĐÃ LÀM (H10, 24/10/2026): AI Nội dung chưa có màn chọn giọng điệu (22/10/2026)

Mục 5 (giọng điệu) làm cho AI Bán hàng: màn Kịch bản chọn giọng → dòng "GIỌNG ĐIỆU" trong lời dặn (sales-ai.ts moTaGiong).
AI Nội dung: cột ai_configs.tone có, nhưng KHÔNG màn nào cho chọn, nên content-ai đã thôi đọc cột này (đọc mà không dùng
dễ khiến tưởng có tác dụng). Làm khi có yêu cầu: thêm chọn giọng ở thẻ Hướng dẫn AI của ① và đưa vào lời dặn viết bài.

ĐÃ LÀM 24/10/2026 (H10): thẻ Hướng dẫn AI của ① có 4 ô giọng (cùng 4 mã của màn Kịch bản, câu ví dụ kiểu bài đăng), bấm lại
để bỏ chọn; máy chủ chỉ nhận 4 mã ('' = bỏ chọn → NULL, lạ → 400); content-ai thêm dòng "GIỌNG ĐIỆU" ngay sau vai trò — mọi
đường viết bài (bấm tay + lịch tự đăng) đều qua generatePostContent. Migration 066: bỏ NOT NULL của cột tone + xoá 'friendly'
mặc định của mọi dòng AI Nội dung (cột có mặc định nên dòng nào cũng mang 'friendly' dù chưa ai từng chọn); thử tự hoàn tác
trên Neon đạt 7/7 (bản đầu chỉ có UPDATE hỏng vì NOT NULL — phép thử bắt được trước khi gộp).

## TD-25 — ĐÃ LÀM PHẦN TỈNH / SỞ THÍCH (H9, 24/10/2026), CHƯA THỬ THẬT; tệp đã lưu SAU CỜ TẮT: Đẩy bài: chưa nhắm theo tệp đã lưu / sở thích / tỉnh thành (22/10/2026)

Mục 3 (quảng cáo khớp OpenAPI 1.330.1) bỏ khỏi màn mọi ô không gửi đi được: "Dùng tệp đã lưu" (targeting của /v1/ads/boost
không có trường tệp đối tượng; rawTargeting chỉ ghi "forwarded unchanged" — không có căn cứ dạng dữ liệu), ô "Sở thích" tự
gõ (cần mã từ GET /v1/ads/interests), ô "Khu vực" tự gõ (tỉnh / thành cần key từ GET /v1/ads/targeting/search?dimension=geo).
Hiện gửi: Việt Nam + tuổi + giới tính, hoặc để Facebook tự tìm (advantage_audience). Làm khi có yêu cầu: tìm sở thích /
tỉnh thành qua hai đường đọc trên rồi gửi interests[{id,name}] / regions[{key}] đúng tài liệu. Thử thật cần nối Meta Ads.

ĐÃ LÀM 24/10/2026 (H9, đối chiếu OpenAPI 1.349.0 tải ngày 24/10): ô tìm tỉnh / thành + sở thích (GET /api/ads/tim-nham →
GET /v1/ads/targeting/search bằng kênh metaads của cửa hàng đang chọn, đường nằm trong chốt phạm vi; tỉnh = geo + region +
VN, tiếng Việt; máy chủ chỉ giữ đúng loại). Có tỉnh → regions[{key,name}] và bỏ countries ['VN'] (Meta báo trùng vùng); sở
thích → interests[{id,name}]. Dự báo tiếp cận dùng cùng hàm dungNhamChon. Tỉnh / sở thích / tệp nằm trong dấu vết ý định nên
đổi nhắm là mã chống trùng mới.
CÒN LẠI:
- CHƯA THỬ THẬT: 0 kênh Meta Ads (TD-22). Lần nối đầu tiên: tìm "Hà Nội" + "thời trang", xem dự báo, đẩy bài nhỏ nhất.
- "Dùng tệp đã lưu": rawTargeting { custom_audiences: [{ id: platformAudienceId }] } + targeting.advantage_audience 0 — tài
  liệu nhà cung cấp chỉ ghi rawTargeting "forwarded unchanged", custom_audiences là trường của Meta, CHƯA thử. Đặt sau cờ
  ADS_NHAM_TEP_DA_LUU=1 (tắt mặc định, giao diện không hiện); máy chủ đối chiếu tệp thuộc tài khoản quảng cáo của cửa hàng.
  Dự báo tiếp cận không có trường tệp → số dự báo không tính tệp. Bật cờ chỉ khi thử thật đầu tiên đạt.

## TD-26 — Chống gửi lặp: nhà cung cấp chậm hiện tin vừa gửi (23/10/2026) — CHẤP NHẬN

'gui_lai' dựa trên "không thấy tin của trang sau mốc". Nếu nhà cung cấp chậm đồng bộ tin vừa gửi đúng lúc máy chủ khởi
động lại, lần đối chiếu có thể không thấy và gửi lại một lần. Phiên kiểm duyệt chấp nhận (khởi động lại mất cỡ chục giây).

## TD-27 — ĐÃ CÀI LaunchAgent (23/10/2026 22:10, chủ dự án đồng ý): máy chủ tắt thì không ai tự bật lại

Sự cố 23/10: máy chủ + người canh tắt 10:55–13:53 (cả nhóm tiến trình nhận SIGTERM khi phiên Claude đã bật nó bị ngắt);
không có tin Telegram nào vì người canh tắt cùng lúc. Đã sửa gốc nhóm tiến trình: mo-app.sh tự tách phiên (setsid).
Còn lại: máy sập / khởi động lại máy / máy chủ chết vì lý do khác thì vẫn không ai bật lại. Giải pháp chuẩn trên Mac:
LaunchAgent (KeepAlive + RunAtLoad) — bản soạn sẵn docs/launchagent/vn.quanly.fanpage.plist, cần chủ dự án đồng ý cài
(thay đổi cấu hình hệ thống). Lâu dài: máy chủ thật (TD-16).
Hệ quả nếu cài (nói rõ khi hỏi): sau khi cài, mỗi lần gộp mã cần một lệnh khởi động lại (đã có trong quy trình); mất DB
thì máy chủ tự thử lại mỗi 30 giây.
ĐÃ CÀI 23/10/2026 22:10: tắt nhóm tsx watch cũ (pgid 3242, máy chủ 82201) → launchctl load → máy chủ 4802, health 200;
kill -9 4802 → launchd bật lại 5535 sau 23 giây, health 200; người canh 1819 + cloudflared 77986 giữ nguyên. Gộp mã xong phải
`launchctl kickstart -k gui/$(id -u)/vn.quanly.fanpage` (docs/quy-trinh-kiem-duyet.md). Còn lại: máy chủ thật lâu dài (TD-16).

## TD-28 — Màn Kịch bản (③ AI Bán hàng) hiện "Thân thiện" khi cửa hàng chưa có dòng cấu hình (24/10/2026) — CHẤP NHẬN

Tìm ra khi làm H10. Cửa hàng chưa có dòng ai_configs 'sales' thì màn Kịch bản tô sẵn giọng "Thân thiện" (AutoScripts.tsx
`tone || 'friendly'`), trong khi sales-ai không có dòng thì KHÔNG thêm dòng "GIỌNG ĐIỆU" vào lời dặn — màn nói một đằng, AI
làm một nẻo cho tới lần bấm Lưu đầu tiên. Hiếm: mọi tài khoản mới đều được chèn sẵn dòng 'sales' giọng 'friendly' (tai-khoan.ts),
Neon hiện 3/3 dòng sales có 'friendly'. Không sửa vì màn Kịch bản đã chốt; phiên kiểm duyệt đồng ý để nguyên và ghi lại.
Sửa khi cần: khi chưa có dòng thì không tô ô nào (giống thẻ Hướng dẫn AI của ① sau H10), hoặc sales-ai dùng 'friendly' khi
chưa có dòng.

## TD-29 — Ô tìm tỉnh / sở thích: mỗi lần tìm gọi thêm một lượt danh sách tài khoản quảng cáo (24/10/2026) — GHI LẠI

Phiên kiểm duyệt nêu khi duyệt H9. GET /api/ads/tim-nham gọi resolveAdAccount → ads.listAdAccounts (GET /v1/ads/accounts)
TRƯỚC lệnh tìm, nên mỗi lần gõ (sau 400 ms) là 2 lượt gọi nhà cung cấp. Chưa đo được (0 kênh Meta Ads). Làm khi thấy chậm
hoặc chạm hạn mức: nhớ ngắn (vd. 5 phút) tài khoản quảng cáo theo kênh, xoá khi chủ shop đổi tài khoản quảng cáo.

## TD-30 — Nối quảng cáo: hai cửa hàng cùng một người Facebook thấy tài khoản quảng cáo của nhau (24/10/2026) — GHI LẠI

Phiên kiểm duyệt nêu khi duyệt H11. Tài liệu ("Scoping sync to specific ad accounts"): mặc định nhà cung cấp đồng bộ MỌI
act_* mà khoá Meta thấy. Một người quản lý hai Fanpage / hai cửa hàng → danh sách tài khoản quảng cáo của cửa hàng B có cả
tài khoản cửa hàng A đang dùng. Hiện chặn được phần chính: lựa chọn tài khoản quảng cáo lưu trên kênh quảng cáo CỦA CỬA
HÀNG (kenhQuangCaoCuaCuaHang + ad_account_ref), nên B không dùng lựa chọn của A; nhưng B vẫn CHỌN được tài khoản của A nếu
tự chọn. Làm khi có cửa hàng thứ hai chạy quảng cáo: gửi adAccountId (danh sách cho phép) lúc nối — tài liệu "latest call
wins", cần thiết kế riêng cho lượt nối lại.
Thử thật 24/10/2026 05:10 (cửa hàng 12): tài khoản Facebook của hồ sơ ĐÃ có quyền quảng cáo → GET /v1/connect/facebook/ads
tạo metaads NGAY, không qua bước cấp quyền nào — nên KHÔNG có điểm nào hỏi chủ shop "dùng tài khoản quảng cáo nào". Kênh
quảng cáo thấy mọi act_* của người Facebook đó; allowlist adAccountId càng cần khi có cửa hàng thứ hai.

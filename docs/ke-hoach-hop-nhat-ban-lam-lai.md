# Kế hoạch hợp nhất: bản của em + bản làm lại (`10-10-2026banmoilamlai`) — đề xuất 11/10/2026, CHỜ CHỦ DỰ ÁN DUYỆT

## So sánh (đọc code + chạy kiểm; giao diện bản làm lại mới đọc qua code)
| Phần | Bản của em (`zernio`) | Bản làm lại (`zernio-khoi-nao`) | Lấy |
|---|---|---|---|
| Dữ liệu theo trang | suy từ kênh; hội thoại / khách / bài vẫn theo tài khoản | `trang_id` cho 13 bảng, `X-Trang` + kiểm quyền | làm lại |
| Quyền theo trang | bộ não chỉ chủ trang | `moKhoiNao`: chủ trang · admin con · quản trị tổng | làm lại |
| Lỗi thật L1–L14 | còn đủ 14 lỗi | đã sửa | làm lại |
| Menu | khung bọc + ô chọn ở đầu (lời 10/10) | theo lời 11/10: Tổng quan → Kết nối kênh → 4 AI (không khung) → Telegram → Quản lý cuối | làm lại |
| Thấy đang ở trang nào | luôn thấy | 3/4 AI không thấy (gỡ ở `28e3ecb`) | em — dạng hiển thị, không trùng |
| Bố cục AI | AI Điều Hành cuộn dài | khuôn 4 thẻ, màu theo miền, một nguồn `bon-ai.ts` | làm lại |
| Vòng lặp điều hành | đề xuất + duyệt / bác | báo cáo ngày, chỉ đạo, đo lại, tự hoàn tác — cách đo yếu | làm lại + sửa |
| Chuỗi 4 khâu / Sức khoẻ | trong AI Điều Hành (duyệt 10/10) | Chuỗi 4 khâu còn ở Quản lý | em |
| AI bán hàng | bản cũ | không đơn trùng, đơn nhiều sản phẩm, chuyển người khi khách đòi | làm lại |
| Kiểm ngược | 745/745 | 703/736 (1 phép kiểm giả, 32 lệch) | em (chuẩn) |
| Xoá trang | không xoá dây chuyền | ON DELETE CASCADE 13 bảng | em |

**Quyết định:** nền = bản làm lại; sửa điểm yếu bằng phần bản em làm tốt hơn. Bản em (chưa commit) lưu nhánh dự phòng.

## Giai đoạn (làm từng giai đoạn → kiểm duyệt → báo cáo → duyệt → giai đoạn sau)
0. **Chuẩn bị:** nhánh chính từ bản làm lại; sao lưu DB thật; chạy thử migration 047–051 trên BẢN SAO DB thật, so số dòng; sửa 33 lỗ kiểm ngược → 736/736.
1. **An toàn dữ liệu & quyền:** bỏ xoá dây chuyền (có dữ liệu thì không xoá trang); AI điều hành về đường khối não (bỏ `/quan-ly/dieu-hanh`); trần tiền tự chẩn đoán đếm từ sổ AI (`ai_usage`, gồm lượt hỏng).
2. **Vòng lặp đo đúng:** MỘT thay đổi tối ưu / khối não / lúc (sửa lỗi sai sự thật không tính); chỉ đạo ghi chỉ số đích; kết quả: hiệu quả / không hiệu quả (tự gỡ + báo) / chưa đo được (kéo tới 28 ngày rồi báo, không giữ âm thầm); ghi rõ "so trước–sau, chưa đối chứng"; chỉ đạo có cấu trúc (mã hành động + phần giải thích), không đặt "ưu tiên hơn" lên lời dặn.
3. **Giao diện:** AI Điều hành theo khuôn 4 thẻ (Hướng dẫn: lịch, trần · Đang làm: đề xuất, chỉ đạo · Kết quả: chuỗi 4 khâu, điểm tốt / chưa tốt, biểu đồ · Nhật ký: báo cáo ngày, chỉ đạo đã đo, sổ lỗi); Chuỗi 4 khâu từ Quản lý vào thẻ Kết quả; tên trang ở dòng đầu mỗi AI (chỉ hiển thị; đổi trang chỉ ở Kết nối kênh).
4. **Kiểm thử:** kiểm + kiểm ngược 100%; trình duyệt từng màn hình với 2 trang; rồi chạy thật AI điều hành vài lượt nhỏ (cần hạn mức).

## Rà giao diện bản làm lại trên trình duyệt (11/10/2026, chủ dự án đăng nhập sẵn, chỉ xem)
Tốt: khuôn 4 thẻ rõ, số thứ tự + màu từng AI; Kết nối kênh có bảng "Trang bán hàng" gom theo tài khoản, "● Đang mở";
Hộp thư + Đơn hàng gộp vào ③ › Đang làm; Nhật ký đọc sổ thay đổi; điện thoại hiển thị gọn; Telegram rõ mục khoá / tắt được.
Lỗi thật (đọc code + nhìn màn hình) — nhiều lỗi có sẵn từ code gốc, bản em cũng mắc:
- Tổng quan: nhãn "Tăng" hiện khi có ≥1 đơn (không so kỳ nào); hàng thẻ 2 luôn 7 ngày nhưng 3 thẻ không ghi "7 ngày" (12 đơn
  vs 14 đơn cùng màn hình); biểu đồ "Tỷ lệ AI xử lý" vẽ số KHÁCH MỚI; "tỷ lệ" = tin AI / mọi tin (gồm tin khách) — sai nghĩa;
  chữ trong thẻ bị cắt cụt; "Dòng hoạt động AI" ghi "Chốt đơn" cả đơn do nhân viên chốt.
- Khung "Phân tích của Trợ lý AI" (AI phân tích cũ, ngoài khối não): "Áp dụng đề xuất" chỉ chuyển trang — trùng việc AI Điều hành.
- Số kênh kết nối: Tổng quan 3 · Kết nối kênh 1/16 · Gói dịch vụ 2 — ba phạm vi, không ghi phạm vi.
- ④ AI Điều hành › Hướng dẫn: ô "Vai trò & Định hướng" KHÔNG vào lời dặn (lời dặn do code soạn) — chủ shop gõ mà AI không đọc.
- Mô tả mục tài liệu của ② / ④ chép của AI bán hàng ("để AI trả lời khách…").
- ① Đang làm có số kết quả ("Đã đăng tuần này", "Tương tác trung bình") — đúng chỗ là thẻ Kết quả.
- 3/4 AI không ghi trang đang làm việc (đã xác nhận bằng mắt).

## Rà soát có đếm (11/10/2026 tối, đăng nhập chuoi = admin_con, 3 trang, 2 tài khoản con; chỉ xem, không bấm nút ghi)
Phạm vi đã rà:
- Tĩnh: 349 nút bấm (onClick) phân loại; 126/126 lệnh gọi API của giao diện khớp đường máy chủ; 0 nút "câm".
- API chỉ đọc: 54 đường GET × 5 trường hợp (không chọn trang, trang 1, 2, 3, trang không tồn tại) — không 500 nào; 503 ảnh/video
  chỉ do máy thử không có khoá AI (đúng thiết kế chế độ thử).
- Màn hình: 22 màn (Tổng quan, 4 AI × 4 thẻ, Đơn hàng, Kết nối, Telegram, Gói, Quản lý) × 3 trang = 66 lượt + shop-a 22 + shop-b
  22 (vào bằng "Mở trang", rồi "Quay lại quản lý") = 110 lượt mở màn: 0 lỗi mạng, 0 lỗi console.
- Phân quyền: shop-a gọi vào trang của shop-b 5/5 bị 404; shop-b gọi vào 2 trang của shop-a 12/12 bị 404; shop vào /quan-ly-trang
  bị đưa về Tổng quan. Trình duyệt nhớ mã trang sai → ứng dụng tự về trang đúng (đã thử, đã trả lại).
- Điện thoại 375px: 22/22 màn không tràn ngang.
- Máy chủ: đọc thay đổi của 37 tệp server (khoi-nao, dashboard, chi-dao, dieu-hanh-ngay, canh-bao-telegram, sales-ai, autopilot,
  guardrails, settings, quan-ly, migration 047–051).
- CHƯA rà: góc nhìn quản trị tổng (cần chủ dự án đăng nhập); các nút GHI (lưu, xoá, gửi, kết nối, chạy AI, duyệt/bác, gửi tin
  thử) — không bấm theo luật, chỉ rà bằng đọc code.

Lỗi mới tìm thêm:
- Telegram (khi chủ chuỗi mở): màn hình là Telegram của CHỦ TRANG đang chọn (shop-a) nhưng không ghi điều đó — bấm "Ngắt kết nối"
  là ngắt của shop-a; chủ chuỗi không có chỗ nối Telegram của chính mình (luôn có trang được chọn).
- Báo cáo ngày qua Telegram: thiếu số quảng cáo vẫn in "Tiền mỗi đơn: 0 ₫" (chi phí QC thiếu bị tính 0) — thiếu dữ liệu ≠ 0.
- Duyệt đề xuất kèm chỉ đạo: ghi "đã duyệt" TRƯỚC rồi mới tạo chỉ đạo; AI đó đã đủ 3 chỉ đạo → báo lỗi nhưng đề xuất đã thành
  "đã duyệt", bấm lại báo "đã quyết rồi" (chú thích trong code nói kiểm trước — thực tế kiểm sau). Không cùng một giao dịch.
- Tổng quan "Hôm nay" thật ra là 24 giờ qua (không phải từ 0 giờ); khung "Phân tích của Trợ lý AI" lấy báo cáo mới nhất của
  MỘT trang bất kỳ trong mọi trang, không ghi trang nào.
- Quản lý › Cần xử lý: cảnh báo theo TÀI KHOẢN ("shop-a chưa có tài liệu") trong khi bộ não theo TRANG — shop-a có 2 trang, không
  biết trang nào thiếu. Biểu đồ "Số trang / Tiền theo tài khoản" của chủ chuỗi chỉ có 1 cột (chính mình) — có từ bản gốc.
- Chủ trang tự đặt trần tiền tự chẩn đoán tới 1.000 USD/tháng, tiền từ khoá AI chung — dồn về giai đoạn bảo mật.
- Gói dịch vụ (shop-a đăng nhập thẳng, đã đo): "BÀI ĐÃ ĐĂNG 13" — thật 0 bài đăng (12 nháp + 1 chờ duyệt), đếm mọi bài lập
  trong tháng; "ĐƠN CHỐT ĐƯỢC 14" — thật 14 đơn đang chờ, cả 14 do nhân viên lập, 0 do AI chốt. Có từ bản gốc (bản em cũng sai).
- "Trợ giúp" ở cuối menu dẫn về chính trang Gói dịch vụ (chưa đặt đường hỗ trợ) — nút không giúp gì. Có từ bản gốc.
- Chữ "LOGO" giữ chỗ ở đầu menu, tên tab trình duyệt "BrewManager AI" (tên mẫu cũ) — cả hai bản.
- Nhóm menu "Dữ liệu của trang" chỉ chứa "Báo cáo Telegram" — tên nhóm không đúng nội dung (cần hỏi chủ dự án).
Lượt rà thêm (shop-a đăng nhập thẳng): 23 màn × 2 trang = 46 lượt, 0 lỗi mạng, 0 lỗi console; /quan-ly-trang và /admin đều bị
đưa về Tổng quan.
Lượt rà thêm (shop-b đăng nhập thẳng): 23 màn, 0 lỗi mạng, 0 lỗi console; /quan-ly-trang, /admin về Tổng quan. Màn đăng nhập
cũng còn chữ "LOGO" giữ chỗ. Quản trị tổng: máy thử không có tài khoản admin — chưa rà (lệnh tạo tài khoản thử bị chặn quyền).
Sửa lại nhận định cũ của em: "xoá dây chuyền" KHÔNG phải rủi ro mới — chỉ xoá trang khi chuyển tài khoản TRẮNG thành chủ chuỗi;
xoá tài khoản thì bản gốc cũng xoá dây chuyền theo user. Bỏ khỏi Giai đoạn 2.
Đã kiểm, không phải lỗi: tự ngắt kênh không bị báo "mất kết nối"; kênh hỏng sẵn lúc nâng cấp không bị báo dồn; đơn mới khi đơn cũ
còn mở → báo chủ shop chứ không lên trùng.

## Kế hoạch CẬP NHẬT (thay mục Giai đoạn ở trên)
0. Chuẩn bị: nền = bản làm lại; nhánh dự phòng bản em; sao lưu DB thật; thử migration 047–051 trên bản sao; kiểm ngược 736/736.
1. Sửa lỗi số liệu & nút giả (thứ chủ shop nhìn thấy đầu tiên): toàn bộ danh sách lỗi Tổng quan ở trên; ghi rõ phạm vi mọi
   số đếm (toàn hệ thống / trang đang mở); thay khung AI phân tích cũ bằng tóm tắt từ ④ (báo cáo ngày + đề xuất chờ duyệt);
   ô vai trò ④ → "Mục tiêu của chủ shop" đưa vào sổ bằng chứng có nhãn (hoặc bỏ); sửa mô tả tài liệu ②/④.
2. An toàn dữ liệu & quyền: ④ về đường khối não; trần tiền đếm từ sổ AI; tên trang ở dòng đầu mỗi AI; duyệt + chỉ đạo trong
   MỘT giao dịch; Telegram ghi rõ của ai + chỗ cho chủ chuỗi; thiếu số QC thì in "—"; cảnh báo Quản lý theo trang.
3. Vòng lặp đo đúng (như mục 2 cũ).
4. Giao diện: Chuỗi 4 khâu vào ④ › Kết quả; số liệu đúng thẻ (Đang làm = việc đang xử lý, Kết quả = số liệu).
5. Kiểm thử: kiểm + kiểm ngược 100%; trình duyệt từng thẻ × 2 trang + điện thoại; chạy thật nhỏ (cần hạn mức).

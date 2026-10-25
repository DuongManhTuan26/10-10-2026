---
name: feedback-giao-dien-chinh-phu
description: UI rule for Zernio SaaS — main view shows only the concise key lines; details appear only after clicking; never show main and child content together
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-01T05:21:28.515Z
---

Bên ngoài chỉ hiện phần CHÍNH: vài dòng ngắn, nổi bật, rõ ràng (ví dụ sao kê chi phí: mỗi bên thứ ba một dòng số tiền đã chi + một dòng tổng). Phần CON (chi tiết, cài đặt, biểu đồ, bảng) chỉ hiện khi bấm vào dòng chính. Tuyệt đối không để phần chính và phần con cùng nằm ngoài giao diện.

**Why:** Người dùng (chủ dự án) mắng gay gắt khi khối "Chi phí hệ thống" đổ hết số dư, biểu đồ, 2 bảng, đối chiếu, ngưỡng cảnh báo ra một lượt — "rối tung hết cả mắt", không phân biệt được chính/phụ, và về sau dữ liệu lớn (cả triệu mã) thì không quản lý nổi. Họ đánh giá toàn bộ cách trình bày từ trước tới nay là bừa bộn.

**How to apply:** Mọi màn hình mới hoặc sửa lại: liệt kê trước "dòng chính" (tối đa vài dòng, mỗi dòng một con số/trạng thái), đẩy mọi thứ khác vào lớp bấm-mở. Danh sách dài thì chỉ hiện top vài mục + "xem thêm". Làm mẫu một khối trước để họ duyệt rồi mới áp cho toàn bộ giao diện. Liên quan [[project-zernio-saas]].

**Màu theo nghĩa (bị mắng lần 2, 2026-10-01):** "chỉ biết dùng duy nhất một màu" — số âm/tiền đã chi phải ĐỎ, số 0 xám và không mang dấu âm, số dư/ổn là xanh lá, cảnh báo vàng cam, nguy cấp đỏ. Không dùng màu chủ đạo (cyan) hay tím cho trạng thái. Mẫu chuẩn: src/lib/tien-chi.ts + src/components/ChiPhiHeThong.tsx.

**Ba cấp phải nhìn ra ngay (bị chê lần 3, 2026-10-01):** "không có dòng à? cỡ chữ mục chính, mục phụ lẫn lộn". Cấp 1 dòng chính: chữ lớn đậm. Cấp 2 (mở ra): khung nền tối hơn, KẺ DÒNG giữa từng dòng, chữ vừa KHÔNG đậm, tiêu đề nhóm nhỏ viết hoa. Cấp 3: thụt sâu, vạch dọc bên trái, chữ nhỏ nhạt. Số tiền thẳng cột. Mẫu: src/components/ChiPhiHeThong.tsx (KHUNG_CON, LE_CAP2, LE_CAP3, hang()).

**Màu, độ tương phản, hộp thoại (bị chê lần 4, 2026-10-01):** "nền tối om, thẻ tối om, chữ tối om", "cùng một màu", "hộp thoại không đồng nhất, thu hẹp bé lại". Quy tắc: chọn màu THEO SỐ ĐO (nền↔thẻ ≥1,5; chữ ≥4,5) — không dùng hệ số mờ /NN trên màu thẻ (độ trong suốt nằm sẵn trong token), không làm mờ chữ phụ (text-on-surface-variant/NN). Màu xanh primary CHỈ cho thứ bấm được; tiêu đề mục dùng class `tieu-de-muc` (chữ trắng + vạch nhấn). Mọi hộp thoại dùng src/components/HopThoai.tsx (hai cỡ: lon/vua, rộng gần trọn màn hình), nút NUT_CHINH/NUT_PHU/NUT_CANH_BAO, ô nhập O_NHAP/NHAN_O. scripts/kiem-tra.mts chặn vi phạm.

**Tông màu (chủ dự án chọn 2026-10-01):** KHÔNG dùng xanh lam xám; dùng tông xanh ngọc đậm của thanh menu (sắc ~196°) cho nền/thẻ/viền, nền chung `.nen-app` có lưới 24px + quầng sáng xanh. Muốn đổi sáng/tối thì giữ sắc, chỉ đổi độ chói.

**Thẻ kính (chủ dự án chọn 2026-10-01, theo mẫu thẻ cảnh báo + thẻ kênh):** thẻ là kính TRONG SUỐT ám xanh ngọc, nhìn xuyên lưới nền, nổi nhờ VIỀN xanh ngọc sáng — không phải khối màu đặc. Thứ nổi trên nội dung (hộp thoại, menu, thông báo nổi) dùng nền đặc bg-hop-thoai / bg-noi. Thẻ cảnh báo/lỗi/thành công: kính ám màu theo nghĩa + viền cùng màu.

**Cập nhật hệ màu 10–11/10/2026 (chủ dự án đồng ý kế hoạch giao diện lượt 2):** màu theo MIỀN — ④ Điều hành + Tổng quan xanh ngọc, ② Quảng cáo vàng, ③ Bán hàng xanh lục, ① Nội dung tím, trang hệ thống trắng/xám (lớp `.mien-*` trong index.css, đặt theo đường dẫn ở App.tsx). Trạng thái độc lập: đỏ lỗi · hồng cần làm ngay · cam cảnh báo · lam thông tin · xám; trạng thái "ổn / thành công" = ✓ chữ TRẮNG (không lục, tránh lẫn ③). Riêng số tiền (src/lib/tien-chi.ts) giữ quy ước cũ: chi đỏ, dư xanh lá. Xem [[feedback-khong-tu-doi-da-thong-nhat]].

---
name: feedback-phuong-phap-thiet-ke
description: "Zernio — PHƯƠNG PHÁP THIẾT KẾ được chủ dự án khen \"chuẩn đét\" (Tổng quan 12/10/2026); áp cho MỌI màn tiếp theo"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-17T06:13:42.295Z
---

Chủ dự án khen màn Tổng quan (12/10/2026) và dặn lưu phương pháp này để làm tiếp các màn khác:

1. **Chất liệu cố định**: mọi thẻ là `.khung-muc` / `.the` — trong suốt thấy lưới kẻ vuông, viền màu 55%, nền 5% màu. Chỉ đổi MÀU, không đổi chất liệu ([[feedback-the-trong-suot-sang]]).
2. **Quy tắc màu XANH–ĐỎ–TÍM–VÀNG** (src/lib/bon-ai.ts): ① Nội dung xanh lá #4ade80 · ② Quảng cáo đỏ #ff4d6a · ③ Bán hàng tím #b38bff · ④ Điều hành vàng #facc15. Số liệu sinh ra ở AI nào thì CẢ khung (viền, kẻ dòng, liên kết, biểu tượng, đường biểu đồ) mang màu AI đó — không lệch nửa khung. Phần chung của 4 AI (bộ não, lời chào, chọn kỳ, Tổng quan) = xanh ngọc thương hiệu #22d3ee. Màu theo nghĩa: hồng = cần làm ngay, đỏ lỗi luôn kèm biểu tượng + chữ "Lỗi", cam cảnh báo kèm ⚠, lam thông tin.
3. **Bố cục theo ưu tiên trên → dưới**: việc cần làm ngay → số chính (một ô CHÍNH to nhất có biểu đồ) → sơ đồ / nội dung cốt lõi → xu hướng | hoạt động (hai cột cao bằng nhau, tự cuộn trong) → bảng chi tiết. Không cắt chữ; trống thì một dòng ghi chú, không để khung trống to.
4. **Điểm nhấn thẩm mỹ** (nghiên cứu xu hướng TRƯỚC khi làm, không làm cái phổ biến đơn giản): ô biểu tượng tô màu nhấn có quầng; số lớn chữ số đều cột (.so-lon); biểu đồ nhỏ trong ô số; sơ đồ nút có vòng sáng + dòng dữ liệu chạy (.vong-so, .dong-chay); quầng sáng CHỈ báo trạng thái (đang chạy, có vấn đề nhấp nháy đỏ), không trang trí; chạm cá nhân (lời chào theo giờ + tên).
4b. **Bài học Kết nối kênh (12/10/2026, bị nhắc "quên quy tắc")**: (a) phần CỐ ĐỊNH (thư viện, công cụ) đặt TRÊN; danh sách DÀI DẦN theo thời gian (trang, kênh, lịch sử) đặt CUỐI để kéo dài không đẩy phần cố định xuống; (b) trạng thái ĐÃ KẾT NỐI / THÀNH CÔNG = màu riêng `--color-thanh-cong` (lục bảo #34d399) + huy hiệu ✓, KHÁC màu khung — không dùng chung màu khung; (c) ô cùng loại = LƯỚI ĐỀU cùng kích thước, thẳng hàng cột, không kéo dài thừa trống (điện thoại: 2 cột đều, tên xuống dòng chứ không cắt); (d) KHÔNG tô đặc trạng thái bằng xanh ngọc thương hiệu — trùng màu nút chính (đã thử, bị bắt trả về lục bảo viền mảnh); (e) màn nào CHỈ hiện thứ cốt lõi của màn đó — Kết nối kênh: tên · nền tảng · hạn · tình trạng · thao tác; quyền Đăng bài / Tin nhắn / Bình luận, số liệu AI đã có ở Tổng quan và màn AI thì KHÔNG nhắc lại (sau hàng nghìn tài khoản sẽ rối mắt); (f) danh sách CHA–CON (trang → kênh) phải PHÂN TẦNG rõ (17/10/2026, bị mắng "nhắc đi nhắc lại bao nhiêu lần"): mỗi cha một KHỐI có viền riêng, cách nhau; đầu khối cấp chính = dải nền + vạch nhấn màu thương hiệu, nhãn cấp nhỏ in hoa ("TRANG BÁN HÀNG"), tên to đậm; con cấp phụ = chữ nhỏ hơn, nhạt hơn, ảnh nhỏ hơn, nối bằng đường cây; đang chọn = viền sáng. Không để cha và con cùng cỡ chữ / cùng màu.
5. **Làm DỨT ĐIỂM cả phần bên trong** (chủ dự án 12/10/2026): mọi hộp thoại, các bước trong luồng, dòng mở rộng, menu ⋯, trạng thái trống / đang tải / lỗi, và chỗ các nút dẫn tới — làm xong một màn là xong hẳn, sau chỉ sang màn tiếp, không phải rà lại bên trong.
6. **Kiểm trước khi báo**: màn 1440px + điện thoại 375px (không tràn ngang), `npm run kiem-tra` (không ghi cứng màu nền, không làm mờ chữ phụ).

**Why:** chủ dự án chê các lần trước "đơn giản phổ biến, không điểm nhấn", "làm một màn một kiểu"; lần này khen và yêu cầu nhớ.
**How to apply:** mỗi màn mới làm đúng 5 bước trên; trước khi đổi dạng / chất liệu / thứ đã thống nhất thì hỏi ([[feedback-khong-tu-doi-da-thong-nhat]]).

---
name: project-khoi-nao-ai
description: "Zernio — nguyên tắc cố định \"khối não AI\": 4 AI liền mạch gắn 1-1 với mỗi chuỗi/trang bán hàng, không bao giờ tách rời"
metadata:
  node_type: memory
  type: project
  originSessionId: 16474879-8882-477d-a456-aa7cf4e27dd0
  modified: 2026-10-10T07:21:52.630Z
---

Chủ dự án chốt 10/10/2026 (nguyên tắc cố định, xuyên suốt, không thay đổi):

- Một **khối não AI** = 4 AI cố định, liền mạch: (1) AI viết bài/đăng bài, (2) AI quảng cáo ads, (3) AI bán hàng chốt đơn, (4) AI điều hành — nhận báo cáo năng suất/hiệu suất hằng ngày của 3 AI kia, đối chiếu/rà soát, giữ & phát triển điểm tốt, phân tích nguyên nhân gốc điểm chưa tốt → giải pháp → vòng lặp tự hoàn thiện.
- Mỗi chuỗi/kênh/trang bán hàng độc lập ↔ đúng một khối não độc lập (chuỗi 1 → não 1 … chuỗi N → não N). Dữ liệu, tiền, cấu hình của não nào chỉ thuộc chuỗi đó.
- Chọn chuỗi nào trên giao diện → mở đúng khối não đó với đủ 4 phần.
- TUYỆT ĐỐI không tách 4 AI thành phần rời rạc. Thứ thay đổi được chỉ là chuỗi/kênh/trang, mục tiêu, sản phẩm, nội dung → điều hướng AI bằng prompt + nguồn dữ liệu (tài liệu) riêng; chức năng 4 AI cố định.

**Why:** chủ dự án thấy giao diện/cấu trúc hiện tại lộn xộn, không đồng nhất, rối mắt, không biết chỗ nào vào chỗ nào.

**How to apply:** mọi thiết kế màn hình, bảng dữ liệu, khoá (user_id vs trang_id) đều xoay quanh đơn vị "khối não = trang". Liên quan [[project-zernio-saas]], [[feedback-bao-mat-de-cuoi]], [[feedback-dong-nhat-hai-tang-quan-ly]].

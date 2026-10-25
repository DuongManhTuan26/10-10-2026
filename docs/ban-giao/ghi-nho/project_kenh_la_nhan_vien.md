---
name: kenh-la-nhan-vien
description: "Zernio — luật kinh doanh 19/10: kênh (Fanpage) là NHÂN VIÊN làm thuê cho cửa hàng; dữ liệu và việc thuộc CỬA HÀNG; chuyển kênh \"ra đi người không, quay về cũng người không\""
metadata:
  node_type: memory
  type: project
  originSessionId: afe2e2c9-0ca4-4ad2-a6f1-12e763c919e1
  modified: 2026-10-19T02:27:37.206Z
---

Chủ dự án chốt 19/10/2026: kênh giống một nhân viên làm thuê. Kênh chuyển từ cửa hàng A sang B thì khách, hội thoại, đơn, bài, việc đang dở Ở LẠI A (nhân viên khác của A nhận bàn giao). Kênh sang B là TRẮNG, bộ não B không đọc gì cũ; người cũ nhắn lại = liên hệ mới của B. Quay về A cũng trắng, không mang gì từ B.

**Why:** hai phiên (viết code + giám sát) từng đề xuất "dữ liệu theo kênh" vì suy từ mô hình dữ liệu Facebook (PSID theo Fanpage, một luồng tin). Chủ dự án phê bình nặng, nhất là phiên giám sát: phải suy từ MÔ HÌNH KINH DOANH. Đặc điểm kỹ thuật của nền tảng là thứ phải xử lý cho đúng luật, không phải lý do đổi luật.

**How to apply:** mọi dữ liệu nghiệp vụ chốt cửa hàng lúc tạo (trang_id), không suy từ social_accounts.trang_id lúc đọc. Chỉ những thứ thuộc về chính kênh (tiền kênh theo ngày, hạn mức gửi của nền tảng) mới đi theo kênh. Khi thiết kế, tự hỏi trước: "theo luật kinh doanh, cái này thuộc ai?" rồi mới tới "nền tảng lưu thế nào". Liên quan [[khoi-nao-ai]], [[hai-phien-viet-va-duyet]].

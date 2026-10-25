---
name: feedback-khong-doi-cai-dat-khi-thu
description: "Khi thử giao diện app của chủ dự án, không để lại cài đặt bị đổi; đọc trạng thái gốc từ API (không đọc từ giao diện đang tải) rồi trả về đúng như cũ"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-03T08:53:18.691Z
---

03/10/2026: thử giao diện video, tôi bấm công tắc "AI tạo video" rồi "trả về như cũ" dựa trên nhãn giao diện đọc lúc trang đang tải ("Đang tắt"). Thật ra công tắc đang BẬT → tôi để nó TẮT, cả khu chọn mô hình, độ dài, khung, độ phân giải, video dài biến mất. Chủ dự án tưởng tôi cố ý xoá tính năng.

**Why:** giao diện lúc đang tải hiện sai trạng thái; cài đặt lưu trên máy chủ nên chủ dự án mở app là thấy ngay.

**How to apply:** trước khi bấm bất kỳ công tắc/cài đặt nào để thử, đọc giá trị gốc qua API (vd. GET /api/ai/configs/content), ghi lại; thử xong đặt lại đúng giá trị đó và đọc API xác nhận. Báo cho chủ dự án mọi cài đặt đã đụng tới. Liên quan [[feedback-verify-before-claiming]].

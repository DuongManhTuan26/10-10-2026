---
name: feedback-the-trong-suot-sang
description: "Zernio — mọi thẻ dùng ĐÚNG chất liệu .khung-muc (trong suốt, thấy lưới kẻ vuông, viền màu); chỉ đổi MÀU, không đổi chất liệu; không làm một màn một kiểu"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 980857a1-af64-4180-80b9-71cccadaf19f
  modified: 2026-10-12T03:49:02.339Z
---

Chất liệu thẻ cố định của Zernio = `.khung-muc` trong src/index.css: nền TRONG SUỐT chỉ phủ 5% màu của thẻ (lưới kẻ vuông của nền vẫn hiện), viền màu 55%, quầng nhẹ cùng màu. Chủ dự án bảo "đổi màu cho nổi bật" nghĩa là đổi MÀU (viền, chữ, điểm nhấn theo màu AI), KHÔNG đổi chất liệu (không nền đặc, không phủ trắng, không làm mờ nền).

**Why:** 12/10/2026 em tự đổi thẻ Tổng quan hai lần — sang nền đặc tối, rồi sang kính trắng mờ — đều bị mắng: "màu cố định là màu trong có kẻ vuông… tao bảo thay màu không phải thay chất liệu… làm riêng 1 mình 1 kiểu là không đồng nhất với mô hình".
**How to apply:** thẻ mới dùng `.khung-muc` hoặc `.the` (cùng chất liệu, màu qua --nhan). Trước khi đổi bất cứ thứ gì về giao diện, mở các màn khác xem chuẩn đang dùng. Đổi dạng/chất liệu phải hỏi trước, nói rõ cũ → mới. Liên quan [[feedback-khong-tu-doi-da-thong-nhat]], [[feedback-giao-dien-chinh-phu]].

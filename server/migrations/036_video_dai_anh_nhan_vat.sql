-- Ảnh mẫu nhân vật trên NỀN TRƠN cho video dài (02/10/2026).
--
-- Vì sao: trước đây khung đầu cảnh 1 được dùng làm ảnh mẫu cho mọi cảnh cắt. Đã thấy ở
-- dự án #9: AI ảnh chép luôn căn phòng, đèn đêm và góc máy — 6 khung gần như y hệt, kể cả
-- cảnh "buổi sáng ngập nắng" vẫn ra ban đêm. Ảnh mẫu nền trơn chỉ mang mặt + trang phục.
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS anh_nhan_vat TEXT;

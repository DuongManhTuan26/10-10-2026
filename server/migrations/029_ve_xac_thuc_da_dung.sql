-- Vé xác thực dùng xong chỉ ĐÁNH DẤU, không xoá.
--
-- Đã đo: xoá vé ngay khi dùng đúng làm chốt "tối đa 5 mã mỗi giờ" đếm thiếu —
-- xin mã lần thứ 6 trong giờ vẫn được. Giữ lại vé đã dùng để bộ đếm thấy đủ;
-- vòng dọn hằng giờ xoá vé cũ hơn một ngày.
ALTER TABLE ma_xac_thuc ADD COLUMN IF NOT EXISTS dung_at TIMESTAMPTZ;

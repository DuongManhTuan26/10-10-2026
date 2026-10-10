-- Tiền ngoài video của một dự án video dài: khung mở đầu vẽ bằng AI ảnh, giọng
-- đọc, nhạc nền. Đã thấy 02/10/2026 (dự án #8): "đã tốn" chỉ cộng tiền 8 cảnh
-- video (3,2 USD), thiếu tiền khung, giọng, nhạc — khách thấy rẻ hơn thực tế.
-- Sổ AI (ai_usage) vẫn là căn cứ tính tiền; cột này để hiện đúng tổng của dự án.
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS chi_phi_them NUMERIC NOT NULL DEFAULT 0;

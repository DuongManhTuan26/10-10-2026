-- A1 (19/10/2026): BÀI ĐĂNG THUỘC MỘT CỬA HÀNG. Thiết kế duyệt cùng phiên kiểm duyệt; chủ dự án chốt 19/10:
--   · bài không suy ra được cửa hàng (không kênh đích) → cửa hàng CŨ NHẤT của tài khoản;
--   · xoá cửa hàng → GIỮ bài, bỏ gán (ON DELETE SET NULL) — bài vẫn tính ở Tổng quan / Gói dịch vụ, chỉ không còn
--     nằm dưới cửa hàng nào.
-- Báo cáo chỉ đọc trước khi làm (scripts/bao-cao-a1.mts): 12 bài, 11 đúng một cửa hàng, 1 không kênh đích, 0 nhiều cửa hàng.

-- Sao lưu để quay lại được: cửa hàng gán ở đây suy từ kênh đích tại thời điểm chạy.
CREATE TABLE IF NOT EXISTS posts_truoc_057 AS
SELECT id, user_id, target_account_ids, now() AS sao_luu_luc FROM posts;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;

-- 1. Kênh đích thuộc ĐÚNG MỘT cửa hàng → cửa hàng đó.
UPDATE posts p SET trang_id = x.trang_id
  FROM (SELECT p2.id, MIN(s.trang_id) AS trang_id, COUNT(DISTINCT s.trang_id) AS so
          FROM posts p2
          JOIN social_accounts s ON s.id = ANY(p2.target_account_ids) AND s.user_id = p2.user_id
         WHERE s.trang_id IS NOT NULL
         GROUP BY p2.id) x
 WHERE x.id = p.id AND x.so = 1 AND p.trang_id IS NULL;

-- 2. Còn lại (không kênh đích / kênh đã xoá / nhiều cửa hàng) → cửa hàng cũ nhất của tài khoản.
UPDATE posts p SET trang_id = (SELECT MIN(t.id) FROM trang t WHERE t.user_id = p.user_id)
 WHERE p.trang_id IS NULL;

CREATE INDEX IF NOT EXISTS posts_trang_idx ON posts (trang_id, status, created_at DESC);

-- Ô lịch tự đăng theo CỬA HÀNG: khoá cũ (user_id, slot_key) làm hai cửa hàng cùng giờ đụng nhau → ô của cửa hàng
-- thứ hai bị bỏ lặng lẽ. Khoá mới có trang_id; chỉ áp cho dòng CÓ trang_id (NULL thì Postgres coi là khác nhau, chỉ mục
-- sẽ mất tác dụng chống trùng — mã chèn luôn ghi trang_id). Dòng cũ giữ nguyên trang_id NULL.
ALTER TABLE auto_pilot_runs ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS auto_pilot_runs_user_slot_key;
CREATE UNIQUE INDEX IF NOT EXISTS auto_pilot_runs_trang_slot_key
  ON auto_pilot_runs (user_id, trang_id, slot_key) WHERE trang_id IS NOT NULL;

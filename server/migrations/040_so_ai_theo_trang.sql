-- Tiền AI theo TỪNG TRANG (chủ dự án 04/10/2026: "tổng mỗi tài khoản tiêu bao nhiêu → mỗi trang tiêu bao nhiêu, cụ thể
-- từng loại"). Trước đây sổ chỉ ghi tài khoản: tài khoản có 2 trang thì không tách được tiền của từng trang.
--
-- Lượt cũ: chỉ điền khi tài khoản có ĐÚNG MỘT trang (không thể là trang nào khác). Tài khoản nhiều trang thì để
-- trống — màn hình ghi "chưa rõ trang", không chia bừa.
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ai_usage_trang_ngay ON ai_usage (trang_id, created_at);

UPDATE ai_usage a SET trang_id = t.id
  FROM trang t
 WHERE a.trang_id IS NULL
   AND t.user_id = a.user_id
   AND (SELECT count(*) FROM trang t2 WHERE t2.user_id = a.user_id) = 1;

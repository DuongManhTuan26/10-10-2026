-- KÊNH LÀ NHÂN VIÊN — đợt 2b: KHÁCH, BÌNH LUẬN, KỊCH BẢN thuộc CỬA HÀNG (chủ dự án chốt 19/10/2026; thiết kế duyệt cùng
-- phiên kiểm duyệt). Chỉ THÊM + điền + sao lưu + RAISE.
--  · customers.trang_id chốt lúc tạo (= cửa hàng của hội thoại); trang_goc = cửa hàng LÚC TẠO, không FK, không SET NULL —
--    xoá cửa hàng thì trang_id về NULL nhưng trang_goc còn → hồ sơ mồ côi của cửa hàng đã xoá KHÔNG BAO GIỜ bị kênh khác
--    nhận / dùng lại (điều kiện 1 phiên kiểm duyệt). Chỉ hồ sơ trang_goc NULL (tạo lúc kênh chưa gắn) mới được nhận.
--  · Khoá khách mới: (cửa hàng, nền tảng, mã) — quay về cửa hàng cũ dùng lại hồ sơ cũ (chủ dự án chốt C5).
--  · comments.trang_id + nhiem_ky_id chốt theo giờ bình luận; auto_scripts.trang_id + tat_ly_do (kênh rời → tắt).
-- Báo cáo chỉ đọc trước (scripts/bao-cao-a2.mts): 4 khách (0 nhiều cửa hàng / kênh, 0 mất kênh), 42 bình luận (0 mất kênh),
-- 1 kịch bản (0 "mọi kênh").

CREATE TABLE IF NOT EXISTS customers_truoc_059 AS
SELECT id, user_id, social_account_id, now() AS sao_luu_luc FROM customers;
CREATE TABLE IF NOT EXISTS comments_truoc_059 AS
SELECT id, user_id, social_account_id, now() AS sao_luu_luc FROM comments;
CREATE TABLE IF NOT EXISTS auto_scripts_truoc_059 AS
SELECT id, user_id, social_account_id, is_active, now() AS sao_luu_luc FROM auto_scripts;

-- ── KHÁCH ───────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS trang_goc BIGINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM customers cu
     WHERE (SELECT COUNT(DISTINCT c.trang_id) FROM conversations c WHERE c.customer_id = cu.id AND c.trang_id IS NOT NULL) > 1
  ) THEN
    RAISE EXCEPTION '059: có khách dính hội thoại của nhiều cửa hàng — dừng, cần quyết cách tách trước';
  END IF;
END $$;

-- 1. Cửa hàng của hội thoại (chốt theo nhiệm kỳ — 058).
UPDATE customers cu SET trang_id = x.trang_id
  FROM (SELECT customer_id, MIN(trang_id) AS trang_id FROM conversations
         WHERE customer_id IS NOT NULL AND trang_id IS NOT NULL GROUP BY customer_id) x
 WHERE x.customer_id = cu.id AND cu.trang_id IS NULL;
-- 2. Chưa có hội thoại → cửa hàng của kênh ghi trên bản ghi khách.
UPDATE customers cu SET trang_id = s.trang_id
  FROM social_accounts s
 WHERE s.id = cu.social_account_id AND s.trang_id IS NOT NULL AND cu.trang_id IS NULL;
-- 3. Còn lại → cửa hàng cũ nhất của tài khoản (hiện 0 dòng).
UPDATE customers cu SET trang_id = (SELECT MIN(t.id) FROM trang t WHERE t.user_id = cu.user_id)
 WHERE cu.trang_id IS NULL;
UPDATE customers SET trang_goc = trang_id WHERE trang_goc IS NULL;

DROP INDEX IF EXISTS customers_identity_key;
-- Mọi ON CONFLICT của customers phải ghi đúng: (trang_id, platform, participant_id) WHERE trang_id IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS customers_trang_identity_key
  ON customers (trang_id, platform, participant_id) WHERE trang_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_trang_idx ON customers (trang_id);

-- ── BÌNH LUẬN ───────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE comments ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS nhiem_ky_id BIGINT REFERENCES kenh_nhiem_ky(id) ON DELETE SET NULL;
UPDATE comments m SET nhiem_ky_id = k.id, trang_id = k.trang_id
  FROM kenh_nhiem_ky k
 WHERE k.account_id = m.social_account_id AND k.den_luc IS NULL AND m.nhiem_ky_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM comments m JOIN social_accounts s ON s.id = m.social_account_id
     WHERE s.trang_id IS NOT NULL AND m.nhiem_ky_id IS NULL
  ) THEN
    RAISE EXCEPTION '059: còn bình luận có kênh gắn cửa hàng mà chưa gắn được nhiệm kỳ — dừng';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS comments_trang_idx ON comments (trang_id, created_at DESC);

-- ── KỊCH BẢN ────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE auto_scripts ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
ALTER TABLE auto_scripts ADD COLUMN IF NOT EXISTS tat_ly_do TEXT;
UPDATE auto_scripts a SET trang_id = s.trang_id
  FROM social_accounts s
 WHERE s.id = a.social_account_id AND a.trang_id IS NULL;
-- Kịch bản "mọi kênh" (không gắn kênh) → cửa hàng cũ nhất (hiện 0 dòng).
UPDATE auto_scripts a SET trang_id = (SELECT MIN(t.id) FROM trang t WHERE t.user_id = a.user_id)
 WHERE a.trang_id IS NULL;
CREATE INDEX IF NOT EXISTS auto_scripts_trang_idx ON auto_scripts (trang_id) WHERE is_active;

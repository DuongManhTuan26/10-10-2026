-- KÊNH LÀ NHÂN VIÊN — đợt 2a: NHIỆM KỲ KÊNH + hội thoại chốt cửa hàng (chủ dự án chốt 19/10/2026: "ra đi tay trắng,
-- quay về người không", mọi nền tảng). Thiết kế duyệt cùng phiên kiểm duyệt.
--
-- Mỗi lần một kênh vào một cửa hàng là MỘT nhiệm kỳ (quay về cửa hàng cũ = nhiệm kỳ MỚI). Hội thoại chốt cửa hàng + nhiệm
-- kỳ lúc phát sinh: cùng một luồng tin của nhà cung cấp sau khi kênh chuyển → dòng hội thoại MỚI ở nhiệm kỳ mới.
-- conversations.id (TEXT) GIỮ NGUYÊN làm khoá chính → messages / orders / send_attempts / hoi_thoai_cham không đổi.
-- Dòng cũ: ma_luong = id. Nhiệm kỳ sau: id = ma_luong || '~' || nhiem_ky_id (services/nhiem-ky.ts — maHoiThoai).
--
-- Báo cáo chỉ đọc trước (scripts/bao-cao-a2.mts): 4 kênh (0 đã ngắt, 0 chưa gắn cửa hàng), 2 hội thoại (0 mất kênh).

-- Sao lưu cột cũ để quay lại được.
CREATE TABLE IF NOT EXISTS conversations_truoc_058 AS
SELECT id, user_id, social_account_id, customer_id, now() AS sao_luu_luc FROM conversations;

CREATE TABLE IF NOT EXISTS kenh_nhiem_ky (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  TEXT        NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  -- Xoá cửa hàng → giữ nhiệm kỳ (lịch sử), bỏ gán — cùng luật "giữ dữ liệu" của 057.
  trang_id    BIGINT      REFERENCES trang(id) ON DELETE SET NULL,
  tu_luc      TIMESTAMPTZ NOT NULL,
  den_luc     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Mỗi kênh tối đa MỘT nhiệm kỳ đang mở.
CREATE UNIQUE INDEX IF NOT EXISTS kenh_nhiem_ky_mot_mo ON kenh_nhiem_ky (account_id) WHERE den_luc IS NULL;
CREATE INDEX IF NOT EXISTS kenh_nhiem_ky_kenh ON kenh_nhiem_ky (account_id, tu_luc);

-- Mọi kênh đang gắn cửa hàng (kể cả đã ngắt) → một nhiệm kỳ mở từ lúc tạo kênh.
INSERT INTO kenh_nhiem_ky (user_id, account_id, trang_id, tu_luc)
SELECT s.user_id, s.id, s.trang_id, s.created_at
  FROM social_accounts s
 WHERE s.trang_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM kenh_nhiem_ky k WHERE k.account_id = s.id AND k.den_luc IS NULL);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ma_luong TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS nhiem_ky_id BIGINT REFERENCES kenh_nhiem_ky(id) ON DELETE SET NULL;

UPDATE conversations SET ma_luong = id WHERE ma_luong IS NULL;
UPDATE conversations c SET nhiem_ky_id = k.id, trang_id = k.trang_id
  FROM kenh_nhiem_ky k
 WHERE k.account_id = c.social_account_id AND k.den_luc IS NULL AND c.nhiem_ky_id IS NULL;

-- Không được còn hội thoại nào có kênh gắn cửa hàng mà chưa gắn nhiệm kỳ (dừng hẳn, không để lặng lẽ).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM conversations c JOIN social_accounts s ON s.id = c.social_account_id
     WHERE s.trang_id IS NOT NULL AND c.nhiem_ky_id IS NULL
  ) THEN
    RAISE EXCEPTION '058: còn hội thoại có kênh gắn cửa hàng mà chưa gắn được nhiệm kỳ — dừng';
  END IF;
END $$;

ALTER TABLE conversations ALTER COLUMN ma_luong SET NOT NULL;
-- Một luồng tin của nhà cung cấp: tối đa một dòng mỗi nhiệm kỳ.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_luong_nhiem_ky ON conversations (ma_luong, nhiem_ky_id);
CREATE INDEX IF NOT EXISTS conversations_ma_luong ON conversations (ma_luong);
CREATE INDEX IF NOT EXISTS conversations_trang_gan_day ON conversations (trang_id, last_message_at DESC);

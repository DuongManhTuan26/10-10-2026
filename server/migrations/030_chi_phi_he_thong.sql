-- Cài đặt chung của toàn hệ thống (không thuộc shop nào), trước hết là ngưỡng
-- cảnh báo chi phí: số dư AI tối thiểu, số ngày còn đủ tiêu, mức tiêu bất thường.
--
-- Không gắn user_id: đây là cài đặt của chủ hệ thống, áp cho mọi shop.
CREATE TABLE IF NOT EXISTS cai_dat_he_thong (
  khoa        TEXT        PRIMARY KEY,
  gia_tri     JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ mục cho sao kê chi phí theo thời gian (theo ngày, theo shop, theo loại).
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage (created_at DESC);

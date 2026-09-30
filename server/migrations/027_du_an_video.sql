-- Dự án video nhiều cảnh: kịch bản → video dài, ảnh tham chiếu → video dài,
-- trend → video.
--
-- Một dự án = nhiều cảnh tạo LẦN LƯỢT (cảnh sau lấy khung cuối của cảnh trước
-- làm khung đầu, để nối liền mạch), rồi ghép thành một video. Mỗi cảnh là một
-- dòng video_ai như video một cảnh thường, chỉ thêm du_an_id và thứ tự.

CREATE TABLE IF NOT EXISTS du_an_video (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trang_id        BIGINT      NOT NULL REFERENCES trang(id) ON DELETE CASCADE,
  -- 'kich_ban' | 'tham_chieu' | 'trend'
  loai            TEXT        NOT NULL,
  y_tuong         TEXT        NOT NULL DEFAULT '',
  -- Ảnh tham chiếu (địa chỉ kho): nhân vật, sản phẩm, bối cảnh.
  anh_tham_chieu  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Mô tả nhất quán dùng chung cho MỌI cảnh: nhân vật, trang phục, bối cảnh,
  -- đạo cụ, phong cách. Đây là thứ giữ các cảnh giống nhau.
  nhat_quan       TEXT        NOT NULL DEFAULT '',
  -- [{ "soGiay": 8, "moTa": "...", "tomTat": "..." }]
  phan_canh       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  model           TEXT        NOT NULL,
  do_net          TEXT        NOT NULL,
  khung           TEXT        NOT NULL,
  co_tieng        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- 'nhap' (mới phân cảnh, chờ duyệt) | 'dang_tao' | 'dang_ghep' | 'xong' | 'loi'
  trang_thai      TEXT        NOT NULL DEFAULT 'nhap',
  gia_uoc_tinh    NUMERIC(14,6),
  gia_thuc        NUMERIC(14,6),
  url             TEXT,
  loi             TEXT,
  dang_xu_ly_tu   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  xong_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS du_an_video_trang_idx ON du_an_video (trang_id, created_at DESC);
CREATE INDEX IF NOT EXISTS du_an_video_dang_chay_idx ON du_an_video (updated_at)
  WHERE trang_thai IN ('dang_tao', 'dang_ghep');

ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS du_an_id BIGINT REFERENCES du_an_video(id) ON DELETE CASCADE;
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS thu_tu INTEGER;
-- Video → video: địa chỉ video nguồn (kho).
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS video_nguon TEXT;
-- Ảnh tham chiếu gửi kèm cảnh này.
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS anh_tham_chieu JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS video_ai_du_an_idx ON video_ai (du_an_id, thu_tu) WHERE du_an_id IS NOT NULL;

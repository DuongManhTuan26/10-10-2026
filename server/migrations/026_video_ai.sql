-- AI tạo video cho bài đăng.
--
-- Tạo một video mất từ 30 giây tới vài phút, lâu hơn hẳn một yêu cầu web.
-- Nên mỗi lượt là một VIỆC: gửi đi, lưu mã việc ở đây, worker hỏi thăm định
-- kỳ, xong thì tải video về kho của mình. Chủ shop đóng trang giữa chừng cũng
-- không mất video đã trả tiền.

CREATE TABLE IF NOT EXISTS video_ai (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trang_id        BIGINT      NOT NULL REFERENCES trang(id) ON DELETE CASCADE,
  model           TEXT        NOT NULL,
  loi_mo_ta       TEXT        NOT NULL,
  so_giay         INTEGER     NOT NULL,
  do_net          TEXT        NOT NULL,
  khung           TEXT        NOT NULL,
  co_tieng        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Ảnh làm khung hình mở đầu (địa chỉ kho), để video bám đúng sản phẩm thật.
  anh_mo_dau      TEXT,
  -- Mã việc bên nhà cung cấp AI.
  ma_viec         TEXT,
  -- 'dang_tao' | 'xong' | 'loi'
  trang_thai      TEXT        NOT NULL DEFAULT 'dang_tao',
  gia_uoc_tinh    NUMERIC(14,6),
  gia_thuc        NUMERIC(14,6),
  -- Địa chỉ video trong kho media, gắn được thẳng vào bài.
  url             TEXT,
  loi             TEXT,
  -- Worker đang xử lý tới đâu: chống hai tiến trình cùng tải một video.
  dang_xu_ly_tu   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  xong_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS video_ai_trang_idx ON video_ai (trang_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_ai_dang_tao_idx ON video_ai (created_at) WHERE trang_thai = 'dang_tao';

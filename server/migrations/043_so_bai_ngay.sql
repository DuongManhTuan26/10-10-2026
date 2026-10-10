-- Số liệu từng bài đăng chụp theo NGÀY (giờ VN) — phần 2, chuỗi 4 AI (duyệt 05/10/2026).
-- Số của nền tảng là CỘNG DỒN trọn đời bài; chụp mỗi ngày để (1) biết tăng bao nhiêu trong một khoảng và (2) so các
-- bài ở cùng "tuổi" (vd. sau 2 ngày) — so bài cũ với bài mới bằng số cộng dồn là so lệch.
CREATE TABLE IF NOT EXISTS so_bai_ngay (
  ngay         DATE   NOT NULL,
  account_id   TEXT   NOT NULL,
  post_ref     TEXT   NOT NULL,
  user_id      BIGINT NOT NULL,
  trang_id     BIGINT,
  post_id      BIGINT,             -- bài trong hệ thống (posts.id) nếu đăng qua hệ thống; null = đăng ngoài
  ai_tao       BOOLEAN,            -- posts.ai_generated
  dang_luc     TIMESTAMPTZ,
  hien_thi     INT NOT NULL DEFAULT 0,
  tiep_can     INT NOT NULL DEFAULT 0,
  thich        INT NOT NULL DEFAULT 0,
  binh_luan    INT NOT NULL DEFAULT 0,
  chia_se      INT NOT NULL DEFAULT 0,
  nhap         INT NOT NULL DEFAULT 0,
  luot_xem     INT NOT NULL DEFAULT 0,
  la_quang_cao BOOLEAN NOT NULL DEFAULT false,
  luc_chup     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ngay, account_id, post_ref)
);
CREATE INDEX IF NOT EXISTS so_bai_ngay_trang ON so_bai_ngay (trang_id, ngay);

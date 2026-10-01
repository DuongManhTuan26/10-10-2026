-- Xác thực bằng email khi đăng nhập và đăng ký (bắt buộc khi chạy thật).
--
-- Mật khẩu đúng chưa đủ: hệ thống gửi một mã 6 số vào email, gõ đúng mã mới
-- có phiên đăng nhập. Kẻ biết mật khẩu mà không mở được hộp thư thì chịu.
--
-- Mỗi lượt là một "vé": mã chỉ lưu bản băm, sống 10 phút, sai 5 lần là vé
-- chết — muốn mã mới phải nhập lại mật khẩu (và lần nhập đó lại bị đếm bởi
-- chốt chống dò mật khẩu).

CREATE TABLE IF NOT EXISTS ma_xac_thuc (
  -- Mã vé ngẫu nhiên, trình duyệt giữ để gửi kèm mã 6 số.
  id            TEXT        PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'dang_nhap' | 'dang_ky'
  muc_dich      TEXT        NOT NULL,
  ma_hash       TEXT        NOT NULL,
  -- Email đã nhận mã (với trang con là email chủ chuỗi).
  gui_toi       TEXT        NOT NULL,
  so_lan_sai    INTEGER     NOT NULL DEFAULT 0,
  het_han       TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ma_xac_thuc_user_idx ON ma_xac_thuc (user_id, created_at DESC);

-- Email đã được chứng minh là của chủ tài khoản (gõ đúng mã một lần).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_xac_thuc_at TIMESTAMPTZ;

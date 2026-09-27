-- Chặn một máy đăng ký tài khoản liên tục.
--
-- Đã tái hiện: đăng ký liên tiếp 8 tài khoản từ cùng một máy, 8/8 lọt, không
-- một lần bị chặn. Một đoạn lệnh chạy vòng lặp là đẻ hàng nghìn tài khoản mỗi
-- phút, phình database.
--
-- Đây là chốt CHỐNG LẠM DỤNG, không phải hạn mức thương mại: không giới hạn
-- tổng số tài khoản, không giới hạn số trang của chủ chuỗi. Chỉ chặn một địa
-- chỉ IP đăng ký dồn dập trong thời gian ngắn.
CREATE TABLE IF NOT EXISTS dang_ky_theo_ip (
  id         BIGSERIAL   PRIMARY KEY,
  ip         TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dang_ky_theo_ip_idx ON dang_ky_theo_ip (ip, created_at DESC);

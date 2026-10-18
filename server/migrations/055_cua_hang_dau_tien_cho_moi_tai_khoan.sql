-- Mọi tài khoản đều có CỬA HÀNG ĐẦU TIÊN — y như tài khoản đăng ký mới (chủ dự án 18/10/2026: tài khoản nào cũng là
-- bản sao 100% phần dùng thường của quản trị tổng).
--
-- Vì sao: chủ chuỗi cũ (054 chuyển thành tài khoản thường) chưa từng được cấp cửa hàng, nên 4 màn AI không có chỗ ghi
-- và Kết nối kênh hiện "0 cửa hàng" — khác hẳn tài khoản đăng ký mới. Ở đây chỉ dựng cửa hàng với mã hồ sơ tạm
-- ("cho-cap-<id>", cùng cách taoTaiKhoan làm); hồ sơ nền tảng thật được cấp ở lần mở Kết nối kênh đầu tiên
-- (GET /connections/trang → ensureProfile), vì gọi nhà cung cấp không làm được trong SQL.
INSERT INTO trang (user_id, profile_ref, ten)
SELECT u.id, 'cho-cap-' || u.id, 'Cửa hàng đầu tiên'
  FROM users u
 WHERE NOT EXISTS (SELECT 1 FROM trang t WHERE t.user_id = u.id)
ON CONFLICT DO NOTHING;

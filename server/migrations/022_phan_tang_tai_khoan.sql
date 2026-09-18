-- Phân tầng tài khoản: quản trị tổng → admin con → tài khoản trang.
--
-- Quyết định kiến trúc (chủ sản phẩm chốt ngày 19/09/2026):
--   MỖI TÀI KHOẢN CHỈ MỘT TRANG FACEBOOK và một ních cho mỗi nền tảng khác.
--   Muốn chạy nhiều trang thì lập nhiều tài khoản, độc lập hoàn toàn với nhau.
--   Một tài khoản "admin con" đứng trên, tự lập ra các tài khoản trang của
--   mình và nhìn tất cả trên một bảng tổng quan.
--
-- Vì sao cách ly hẳn thay vì dùng chung: không chung đụng thì không có đường
-- nào lẫn bộ não, lẫn bảng giá, lẫn hộp thư giữa hai trang.
--
-- Đã đo phía Zernio ngày 19/09/2026 trước khi chốt:
--   /usage → limits.profiles = -1 (không giới hạn hồ sơ)
--            planName "Usage-Based", tính theo connectedAccounts
--   Nghĩa là 10 trang tốn tiền như nhau dù nằm trong 1 hay 10 tài khoản.
--   Cách ly KHÔNG đắt hơn dùng chung.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;

-- RESTRICT chứ không CASCADE: xoá tài khoản admin con mà kéo theo mọi tài
-- khoản trang của họ là xoá sạch hộp thư, đơn hàng và tài liệu của từng trang
-- chỉ bằng một cú bấm. Phải buộc dọn từng trang trước, có ý thức.

CREATE INDEX IF NOT EXISTS users_parent_idx ON users (parent_id) WHERE parent_id IS NOT NULL;

-- Vai trò mới: 'admin_con' — chủ chuỗi, quản lý các tài khoản trang mình lập.
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'admin_con', 'shop'));
END $$;

/*
 * Mở trang thay cho tài khoản con.
 *
 * Admin con bấm "Mở trang này" thì hệ thống cấp một phiên của tài khoản trang
 * đó. Phải ghi lại phiên ấy do AI nào mở, vì hai lý do:
 *   1. Giao diện phải hiện rõ "bạn đang xem thay trang X" kèm nút quay lại —
 *      không thì người dùng tưởng mình vẫn ở tài khoản của mình và thao tác
 *      nhầm lên dữ liệu của trang khác.
 *   2. Sau này truy được ai đã vào trang nào, lúc nào.
 */
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mo_boi BIGINT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sessions_mo_boi_idx ON sessions (mo_boi) WHERE mo_boi IS NOT NULL;

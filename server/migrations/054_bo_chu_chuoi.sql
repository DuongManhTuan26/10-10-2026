-- Bỏ tầng chủ chuỗi (admin con) và tài khoản con — chủ dự án chốt 18/10/2026.
--
-- Vì sao: luật cũ "1 tài khoản = 1 Fanpage" (022) bắt muốn nhiều Fanpage phải lập chủ chuỗi + nhiều tài khoản con,
-- mỗi tài khoản con một chìa khoá đăng nhập. Nay một tài khoản tự giữ NHIỀU cửa hàng (mỗi cửa hàng một hồ sơ nền
-- tảng + một bộ não), nên tầng chuỗi thừa. Mọi tài khoản là tài khoản dùng thường — bản sao phần dùng thường của
-- quản trị tổng.
--
-- Chủ dự án chọn: chủ chuỗi cũ chuyển thành tài khoản thường (không mất gì); tài khoản con cũ (@noi-bo.local) tách
-- ra đứng riêng để quản trị nhìn thấy ở màn Quản lý và TỰ xoá — hệ thống không tự xoá dữ liệu.

-- Giữ lại dấu vết quan hệ cũ trước khi tách, phòng khi cần tra lại (bảng chỉ để đọc, không mã nào dùng).
CREATE TABLE IF NOT EXISTS lien_ket_chuoi_cu (
  con_id   BIGINT PRIMARY KEY,
  cha_id   BIGINT NOT NULL,
  luc_tach TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO lien_ket_chuoi_cu (con_id, cha_id)
SELECT id, parent_id FROM users WHERE parent_id IS NOT NULL
ON CONFLICT (con_id) DO NOTHING;

UPDATE users SET parent_id = NULL, updated_at = now() WHERE parent_id IS NOT NULL;
UPDATE users SET role = 'shop', updated_at = now() WHERE role = 'admin_con';

DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'shop'));
END $$;

-- Đơn hàng theo TRANG và sổ "kênh thuộc trang nào theo ngày" (chủ dự án duyệt 05/10/2026).
--
-- orders.trang_id / social_account_id: CHỐT lúc tạo đơn (kênh khách nhắn tới), không suy lại sau — kênh có thể đổi
-- Fanpage, suy lại là gán nhầm đơn cũ sang trang mới. Đơn cũ để trống (số theo trang chỉ tính từ mốc 05/10/2026).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS social_account_id TEXT;
CREATE INDEX IF NOT EXISTS orders_trang_ngay ON orders (trang_id, created_at);

-- Mỗi ngày (UTC — cùng cách nhà cung cấp kênh đếm ngày-kênh) một dòng cho mỗi kênh: thuộc trang nào, có nối không.
-- Đổi Fanpage giữa tháng thì tiền kênh của tháng chia theo số ngày ở từng trang. Giữ cả khi kênh/tài khoản đã xoá.
CREATE TABLE IF NOT EXISTS kenh_trang_ngay (
  ngay       DATE   NOT NULL,
  account_id TEXT   NOT NULL,
  user_id    BIGINT NOT NULL,
  trang_id   BIGINT,
  dang_noi   BOOLEAN NOT NULL,
  PRIMARY KEY (ngay, account_id)
);
CREATE INDEX IF NOT EXISTS kenh_trang_ngay_tk ON kenh_trang_ngay (account_id, ngay);

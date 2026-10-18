-- Trang bán hàng CHỦ SHOP TỰ CHỌN cho một kênh không gắn Fanpage (Instagram, TikTok, YouTube…) — chủ dự án 17/10/2026:
-- "chuyển sang trang nào là do người dùng tự do lựa chọn… không để mặc định ở bất kỳ đâu".
-- Trước đây kênh không có Fanpage luôn bị đồng bộ xếp vào trang CHÍNH của hồ sơ — chọn trang khác thì lượt đồng bộ sau
-- kéo về. Có lựa chọn ở đây thì đồng bộ giữ đúng lựa chọn. Kênh Facebook không dùng cột này (mỗi Fanpage một trang —
-- chủ dự án duyệt 05/10/2026). Trang bị xoá thì lựa chọn tự bỏ, kênh về trang chính của hồ sơ.
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS trang_chon BIGINT REFERENCES trang(id) ON DELETE SET NULL;

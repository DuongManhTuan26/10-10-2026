-- Mốc khoá / mở khoá tài khoản (mục f, chủ dự án chốt 18–19/10/2026: khoá thì AI dừng hẳn; mở khoá thì việc tới hạn
-- trong lúc khoá KHÔNG tự bùng ra). NULL = chưa từng khoá / mở — mọi điều kiện dùng cột này phải xử lý NULL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS khoa_luc TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mo_khoa_luc TIMESTAMPTZ;

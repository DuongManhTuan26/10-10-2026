-- Video tự tạo theo lịch tự đăng (chủ dự án 03/10/2026: video cùng cơ chế công tắc như ảnh).
--   video_ai.tu_dong     : video do lịch tự đăng tạo — để tính trần tiền video mỗi tháng.
--   posts.cho_video_id   : bài đang chờ video này xong mới đăng (video mất 1–5 phút).
--   posts.cho_video_guard: chế độ đăng đã chọn lúc tạo bài (publish / notify / approve).
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS tu_dong BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cho_video_id BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cho_video_guard TEXT;
CREATE INDEX IF NOT EXISTS posts_cho_video ON posts (cho_video_id) WHERE cho_video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS video_ai_tu_dong_thang ON video_ai (trang_id, created_at) WHERE tu_dong;

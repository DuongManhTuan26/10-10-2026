-- NGUỒN của hội thoại và đơn (phần 2 — chuỗi 4 AI, chủ dự án duyệt 05/10/2026): nối quảng cáo / bài đăng → hội thoại
-- → đơn bằng MÃ THẬT, không đoán.
--   conversations.origin: 'quang_cao' (bấm quảng cáo nhắn tin — Meta gửi ad_id ở tin đầu), 'lien_ket' (link m.me có ref),
--     'binh_luan' (khách trả lời tin nhắn riêng AI gửi từ bình luận của họ), 'tu_nhan' (không có tín hiệu nào).
--     'message' = hội thoại có từ trước khi ghi nguồn → không tính vào báo cáo nguồn.
--   hoi_thoai_cham: MỖI lần chạm có mã (bấm quảng cáo / link / bình luận) — khách quay lại qua quảng cáo khác vẫn ghi.
--   orders.origin*: nguồn của lần chạm GẦN NHẤT trước khi chốt đơn, chốt cứng lúc tạo đơn.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origin_ad_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origin_ref TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origin_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS hoi_thoai_cham (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id         BIGINT NOT NULL,
  loai            TEXT NOT NULL CHECK (loai IN ('quang_cao', 'lien_ket', 'binh_luan')),
  ad_id           TEXT,
  ref             TEXT,
  post_id         TEXT,
  luc             TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Cùng một quảng cáo / link / bài cho cùng hội thoại chỉ ghi một lần (giao lặp, rà soát hộp thư gửi lại).
CREATE UNIQUE INDEX IF NOT EXISTS hoi_thoai_cham_mot_lan
  ON hoi_thoai_cham (conversation_id, loai, coalesce(ad_id, ''), coalesce(ref, ''), coalesce(post_id, ''));
CREATE INDEX IF NOT EXISTS hoi_thoai_cham_hoi_thoai ON hoi_thoai_cham (conversation_id, luc DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS origin_ad_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS origin_post_id TEXT;

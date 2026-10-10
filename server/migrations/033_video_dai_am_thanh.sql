-- Video dài có giọng đọc, nhạc nền và phụ đề (02/10/2026).
--
-- Vì sao: video quảng cáo 1 phút cần lời đọc tiếng Việt MỘT giọng xuyên suốt,
-- nhạc nền liền một bài, và chữ trên màn hình (phần lớn người xem Facebook tắt
-- tiếng). Mô hình video tự nói thì tiếng Việt không bảo đảm và mỗi clip một
-- giọng (đã tra tài liệu Veo 3.1) — nên làm riêng rồi trộn khi ghép.
--
-- am_thanh: {"giongDoc": bool, "giong": text, "nhac": bool, "moTaNhac": text, "phuDe": bool}
-- nhac_url: bài nhạc đã tạo, giữ lại để ghép lại không phải trả tiền lần nữa.
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS am_thanh JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS nhac_url TEXT;

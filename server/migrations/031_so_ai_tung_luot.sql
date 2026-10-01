-- Sổ AI ghi TỪNG LƯỢT đủ để đối chiếu với nhà cung cấp và tính tiền từng tài khoản.
--
-- Đã đo ngày 01/10/2026: sổ của app ghi 1,53 USD trong khi nhà cung cấp trừ
-- 2,66 USD. Không truy được lệch ở đâu vì sổ không lưu mã giao dịch, và ba chỗ
-- bị trừ tiền mà không ghi (AI trả rỗng, ảnh/video tạo xong nhưng lưu kho hỏng).
--
--   viec      — tính năng cụ thể (trả lời khách, viết bài, chia cảnh...). Cột
--               task cũ quá thô: "content" gộp cả viết bài lẫn chia cảnh video.
--               Dòng cũ để NULL — không đoán bừa dòng cũ là việc gì.
--   ma_ncc    — mã giao dịch nhà cung cấp trả về; duy nhất, ghi trùng là lỗi.
--   cost_ncc  — tiền nhà cung cấp chốt khi tra lại đúng mã đó.
--   doi_chieu_at — lúc đã tra lại xong.
--   loi       — lượt bị trừ tiền nhưng hỏng (vẫn phải tính, vẫn phải hiện).
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS viec TEXT;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS ma_ncc TEXT;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS cost_ncc NUMERIC(14,8);
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS doi_chieu_at TIMESTAMPTZ;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS loi TEXT;

-- Lượt trả lời tin nhắn rẻ tới 0,000008 USD: 6 chữ số thập phân làm tròn mất
-- cả lượt. Nâng lên 8 để cộng lại khớp tới từng xu với nhà cung cấp.
ALTER TABLE ai_usage ALTER COLUMN cost_usd TYPE NUMERIC(14,8);

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_ma_ncc_idx ON ai_usage (ma_ncc) WHERE ma_ncc IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_usage_cho_doi_chieu_idx ON ai_usage (created_at)
  WHERE ma_ncc IS NOT NULL AND doi_chieu_at IS NULL;

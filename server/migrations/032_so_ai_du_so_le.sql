-- Sửa hai lỗi của sổ AI từng lượt (031), cả hai đã tái hiện ngày 01/10/2026.
--
-- 1. Mất số lẻ: ghi 0,000000975 USD thì lưu thành 0,00000098. Tổng khoá AI
--    nhà cung cấp báo có tới 9 số lẻ (2,655274975), nên giới hạn 8 số lẻ làm
--    sổ lệch dần khỏi nhà cung cấp. Bỏ hẳn giới hạn: NUMERIC giữ đúng từng số.
ALTER TABLE ai_usage ALTER COLUMN cost_usd TYPE NUMERIC;
ALTER TABLE ai_usage ALTER COLUMN cost_ncc TYPE NUMERIC;

-- 2. Nghẽn hàng đợi đối chiếu: luôn lấy lượt cũ nhất trước, nên lượt nào nhà
--    cung cấp mãi không trả số thì đứng chặn mãi ở đầu hàng — đã thấy lượt
--    thật phía sau không bao giờ được đối chiếu. Ghi lúc tra gần nhất để xoay
--    vòng: lượt vừa tra hỏng xuống cuối hàng, nhường lượt khác.
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS tra_luc TIMESTAMPTZ;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS so_lan_tra INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS ai_usage_cho_doi_chieu_idx;
CREATE INDEX IF NOT EXISTS ai_usage_cho_doi_chieu_idx ON ai_usage (tra_luc NULLS FIRST, created_at)
  WHERE ma_ncc IS NOT NULL AND doi_chieu_at IS NULL;

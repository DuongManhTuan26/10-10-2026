-- 062 (22/10/2026): kịch bản bình luận "Chỉ một số bài cụ thể" làm THẬT (phiên kiểm duyệt duyệt thiết kế mục 2).
-- Trước: apply_to lưu chuỗi gì cũng được, không có danh sách bài, bộ máy (comment-ai.ts) không đọc → kịch bản chạy ở MỌI
-- bài dù chủ shop chọn "chỉ một số bài". Nay: danh sách mã bài (đúng giá trị comments.platform_post_id — đã đối chiếu
-- với GET /v1/inbox/comments của Fanpage thật 22/10) + hai ràng buộc.
-- Dữ liệu lúc viết: 1 kịch bản, apply_to 'all' → câu chuẩn hoá không đổi dòng nào.

ALTER TABLE auto_scripts ADD COLUMN IF NOT EXISTS bai_ap_dung TEXT[] NOT NULL DEFAULT '{}';

UPDATE auto_scripts SET apply_to = 'all', updated_at = now() WHERE apply_to NOT IN ('all', 'specific');
-- 'specific' mà chưa có bài nào (chưa từng chọn được) = chưa bao giờ chạy đúng ý → về 'all' như bộ máy vẫn chạy.
UPDATE auto_scripts SET apply_to = 'all', updated_at = now() WHERE apply_to = 'specific' AND cardinality(bai_ap_dung) = 0;

ALTER TABLE auto_scripts DROP CONSTRAINT IF EXISTS auto_scripts_apply_to_hop_le;
ALTER TABLE auto_scripts ADD CONSTRAINT auto_scripts_apply_to_hop_le CHECK (apply_to IN ('all', 'specific'));
ALTER TABLE auto_scripts DROP CONSTRAINT IF EXISTS auto_scripts_bai_cu_the_co_bai;
ALTER TABLE auto_scripts ADD CONSTRAINT auto_scripts_bai_cu_the_co_bai
  CHECK (apply_to = 'all' OR cardinality(bai_ap_dung) BETWEEN 1 AND 100);

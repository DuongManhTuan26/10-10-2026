-- 066 (24/10/2026): GIỌNG ĐIỆU CỦA ① AI NỘI DUNG (TD-24, H10). ai_configs.tone có mặc định 'friendly' nên mọi dòng 'content'
-- đều mang 'friendly' dù CHƯA TỪNG có màn nào cho chọn (AITrainingModal chỉ ghi vai trò, PUT /auto-pilot chỉ ghi settings,
-- taoTaiKhoan không gửi tone). Từ nay AI Nội dung đọc tone → bỏ giá trị không phải do chủ shop chọn, để lời dặn viết bài
-- không tự đổi. Các AI khác giữ nguyên (AI Bán hàng có màn chọn, mặc định 'friendly' đang hiện đúng trên màn Kịch bản).
-- Cột tone khai NOT NULL từ 001 → phải bỏ ràng buộc thì mới có "chưa chọn" (NULL). Mặc định 'friendly' giữ nguyên.
-- (thu-066-hoan-tac.mts bắt được: bản chỉ có UPDATE hỏng ngay ở dòng đầu.)
ALTER TABLE ai_configs ALTER COLUMN tone DROP NOT NULL;
UPDATE ai_configs SET tone = NULL WHERE kind = 'content';

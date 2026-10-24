-- 067 (24/10/2026): NỐI QUẢNG CÁO META CHO CỬA HÀNG (H11). Tài khoản metaads chỉ sinh qua GET /v1/connect/facebook/ads +
-- select-page (tài liệu "Connecting Meta Ads only"); máy chủ tự chọn ĐÚNG Fanpage của cửa hàng ở chặng quay về, nên phiên
-- cấp quyền phải nhớ đây là lượt nối quảng cáo và của cửa hàng nào. Bảng tạm (mỗi tài khoản một dòng, sống 15 phút).
ALTER TABLE pending_connections ADD COLUMN IF NOT EXISTS loai TEXT;
ALTER TABLE pending_connections ADD COLUMN IF NOT EXISTS trang_id BIGINT;

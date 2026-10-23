-- 064 (23/10/2026): CHỦ SHOP GỠ KÊNH = NHÂN VIÊN NGHỈ VIỆC (phiên kiểm duyệt duyệt thiết kế). Chỉ THÊM cột rỗng; không sửa
-- dòng nào (Neon 23/10: 4 kênh, 0 kênh mất kết nối — không có dữ liệu cũ phải chuyển).
-- go_luc NULL = đang làm hoặc "nghỉ ốm" (nhà cung cấp tắt / thiếu trong danh sách: giữ nhiệm kỳ, hiện "Mất kết nối").
-- go_luc có giá trị = chủ shop bấm "Ngắt kết nối" trong app: nhiệm kỳ đã đóng, kịch bản tắt, ẩn khỏi danh sách kênh.
-- Nối lại (kênh xuất hiện lại trong danh sách nhà cung cấp) → đồng bộ xoá go_luc + mở nhiệm kỳ MỚI (services/trang.ts).
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS go_luc TIMESTAMPTZ;

-- 063 (23/10/2026): CHỐNG GỬI LẶP SAU KHI BỊ CẮT (phiên kiểm duyệt duyệt thiết kế). Chỉ THÊM cột rỗng; không sửa dòng nào.
-- Lần gửi tin ghi trước mã lần khởi động + mã kích hoạt (tin khách AI đang trả lời) + băm nội dung, để lượt sau đối chiếu
-- với nhà cung cấp lần gửi bị bỏ dở (services/chong-gui-lap.ts). Trả lời công khai bình luận ghi "đang gửi" trước khi gọi.
ALTER TABLE send_attempts ADD COLUMN IF NOT EXISTS ma_khoi_dong TEXT;
ALTER TABLE send_attempts ADD COLUMN IF NOT EXISTS ma_kich_hoat TEXT;
ALTER TABLE send_attempts ADD COLUMN IF NOT EXISTS noi_dung_bam TEXT;
CREATE INDEX IF NOT EXISTS send_attempts_dang_do_idx ON send_attempts (conversation_id)
  WHERE decision = 'allowed' AND outcome = 'pending' AND ma_khoi_dong IS NOT NULL;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS public_dang_gui_luc TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS public_dang_gui_ma TEXT;

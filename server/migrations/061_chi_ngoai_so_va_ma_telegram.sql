-- 061 (22/10/2026): (1) KHOẢN CHI NGOÀI APP ĐÃ ĐỐI CHIẾU — gốc của cảnh báo "Nhà cung cấp AI trừ nhiều hơn sổ của app
-- 8,0733096 USD" (Telegram 25 lần từ 12/10). (2) Bảng mã nối Telegram (thay Map trong bộ nhớ — khởi động lại giữa lúc
-- người dùng đang nối là gãy). Thiết kế duyệt cùng phiên kiểm duyệt. Chỉ THÊM; không sửa / xoá dòng nào.
--
-- (1) Căn cứ (phiên viết tìm 22/10, phiên kiểm duyệt duyệt): kịch bản nghiên cứu AI Điều hành scripts/bo-de-dieu-hanh/*
-- gọi THẲNG nhà cung cấp AI bằng chung khoá với app, 05–09/10, không qua sổ ai_usage.
--   · bo_de_jsonl 7.890923 = tổng usage.cost trong 7 tệp ket-qua/*.jsonl (2026-10-05T15-28-12-628Z, 2026-10-05T15-30-09-921Z,
--     giam-sat-2026-10-09T05-18-28-559Z, …05-33-39-502Z, …05-50-43-174Z, …09-16-10-619Z, …09-28-15-022Z); [tu, den] = lúc bắt
--     đầu tệp sớm nhất → lúc ghi xong tệp muộn nhất.
--   · bo_de_phan_bien 0.1823866 = PHẦN CÒN LẠI của khoản lệch (8.0733096 − 7.890923). Tệp phan-bien-…json không lưu tiền;
--     nhật ký phiên 09/10 còn dòng phan-bien.mts in ra "Tiền: 0.1823 USD" (làm tròn 4 số lẻ → thật trong [0.18225; 0.18235)),
--     phần còn lại nằm đúng trong khoảng đó.
-- Mốc đối chiếu hiện tại 2026-10-01T06:02:28Z — cả hai khoản nằm sau mốc nên doiChieuTong trừ chúng (services/chi-phi.ts
-- chiNgoaiSoSauMoc). Màn Chi phí hệ thống hiện từng khoản, không giấu.

INSERT INTO cai_dat_he_thong (khoa, gia_tri)
VALUES ('chi_ngoai_so', jsonb_build_array(
  jsonb_build_object(
    'ma', 'bo_de_jsonl', 'usd', 7.890923,
    'tu', '2026-10-05T15:28:12Z', 'den', '2026-10-09T09:34:31Z',
    'lyDo', 'Nghiên cứu AI Điều hành (bộ đề + giám sát), chạy thẳng nhà cung cấp bằng khoá của app',
    'canCu', 'Tổng usage.cost trong 7 tệp scripts/bo-de-dieu-hanh/ket-qua/*.jsonl'
  ),
  jsonb_build_object(
    'ma', 'bo_de_phan_bien', 'usd', 0.1823866,
    'tu', '2026-10-09T05:16:07Z', 'den', '2026-10-09T05:16:07Z',
    'lyDo', 'Nghiên cứu AI Điều hành (phản biện bộ đề), chạy thẳng nhà cung cấp bằng khoá của app',
    'canCu', 'Suy từ phần còn lại của khoản lệch, khớp dòng in "Tiền: 0.1823 USD" của phan-bien.mts (tệp kết quả không lưu tiền)'
  )
))
ON CONFLICT (khoa) DO NOTHING;

-- (2) Mã nối Telegram đã phát (sống 15 phút): chỉ chủ mã mới dò được trạng thái. Trước nằm trong Map bộ nhớ.
CREATE TABLE IF NOT EXISTS ma_telegram_da_phat (
  ma         TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  het        TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ma_telegram_da_phat_het_idx ON ma_telegram_da_phat (het);

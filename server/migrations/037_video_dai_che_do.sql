-- Chế độ làm video dài (03/10/2026):
--   'ghep_canh': tạo từng cảnh rồi ghép (mọi mô hình) — cách cũ.
--   'noi_dai'  : NỐI DÀI GỐC của hãng — mỗi đoạn sau đưa đoạn trước làm reference_video, lời nhắc
--                "Extend @Video 1…" (Seedance 2.5, theo hướng dẫn chính thức BytePlus).
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS che_do TEXT NOT NULL DEFAULT 'ghep_canh';

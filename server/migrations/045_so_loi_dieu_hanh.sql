-- ĐỀ XUẤT của AI điều hành + SỔ LỖI — bước 4 (chủ dự án duyệt 09/10/2026; docs/nghien-cuu-bo-de-ai-dieu-hanh.md mục 14).
--
-- de_xuat_dieu_hanh: mỗi lần chạy quy trình là một dòng — đủ để soát lại (nhật ký vào/ra từng bước) và để ĐÁNH GIÁ
-- TỔNG THỂ (chủ dự án 09/10/2026: không chỉ đếm lỗi giảm, mà cả chất lượng quyết định, chi phí, tốc độ, cơ hội bỏ lỡ):
-- chủ shop duyệt / bác, số lượt AI, tiền, thời gian, bị code chặn gì.
--
-- so_loi_ai: lỗi của AI theo BA MỨC của quy trình kiểm duyệt (nghi vấn → có cơ sở → đã xác nhận). Chủ shop bác một đề
-- xuất CHƯA chắc là AI sai (có thể là ý muốn của chủ shop) → chỉ là "nghi vấn". Lỗi do code kiểm cứng bắt được là "đã
-- xác nhận" (máy đo, không phải ý kiến). Sổ KHÔNG tự đổi lời dặn AI — lỗi đã xác nhận được người soát biến thành phép
-- kiểm / câu hỏi kiểm (cột da_thanh_quy_tac ghi tên).

CREATE TABLE IF NOT EXISTS de_xuat_dieu_hanh (
  id              BIGSERIAL   PRIMARY KEY,
  luc             TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         BIGINT      NOT NULL,
  trang_id        BIGINT      NOT NULL,
  van_de          TEXT        NOT NULL,
  ket_qua         TEXT        NOT NULL,
  ly_do           TEXT        NOT NULL,
  ket_luan        TEXT        NOT NULL,
  quyet_dinh      JSONB       NOT NULL,
  muc_chac        JSONB       NOT NULL,
  vi_pham         JSONB       NOT NULL,
  ghi_chu         JSONB       NOT NULL,
  khoang_trong    JSONB       NOT NULL,
  so_luot_ai      INT         NOT NULL,
  tien_usd        NUMERIC     NOT NULL,
  thoi_gian_ms    INT         NOT NULL,
  nhat_ky         JSONB       NOT NULL,
  trang_thai      TEXT        NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet', 'da_duyet', 'bac')),
  ly_do_chu_shop  TEXT,
  luc_chu_shop    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS de_xuat_dieu_hanh_trang ON de_xuat_dieu_hanh (trang_id, luc DESC);

CREATE TABLE IF NOT EXISTS so_loi_ai (
  id                BIGSERIAL   PRIMARY KEY,
  luc               TIMESTAMPTZ NOT NULL DEFAULT now(),
  de_xuat_id        BIGINT      REFERENCES de_xuat_dieu_hanh(id) ON DELETE SET NULL,
  user_id           BIGINT,
  trang_id          BIGINT,
  nguon             TEXT        NOT NULL CHECK (nguon IN ('kiem_cung', 'chu_shop_bac', 'ket_qua_xau', 'soat_tay')),
  loai              TEXT        NOT NULL,
  mo_ta             TEXT        NOT NULL,
  muc               TEXT        NOT NULL CHECK (muc IN ('nghi_van', 'co_co_so', 'da_xac_nhan')),
  da_thanh_quy_tac  TEXT
);
CREATE INDEX IF NOT EXISTS so_loi_ai_loai ON so_loi_ai (loai, luc DESC);

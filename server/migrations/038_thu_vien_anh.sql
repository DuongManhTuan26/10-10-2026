-- Thư viện ảnh SẢN PHẨM / NHÂN VẬT của từng Trang, dùng lại cho ảnh và video AI (chủ dự án 03/10/2026,
-- học từ Pippit/Dreamina: lưu sản phẩm, nhân vật một lần, gọi lại mọi lúc).
-- Lưu NGUYÊN TỆP trong cơ sở dữ liệu: kho media của nhà cung cấp chỉ giữ tệp tạm 7 ngày, lưu địa chỉ
-- thì sau một tuần thư viện chết hết. Khi dùng, app đưa tệp lên kho lại để có địa chỉ mới.
CREATE TABLE IF NOT EXISTS thu_vien_anh (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trang_id    BIGINT      NOT NULL REFERENCES trang(id) ON DELETE CASCADE,
  loai        TEXT        NOT NULL CHECK (loai IN ('san_pham', 'nhan_vat')),
  ten         TEXT        NOT NULL,
  kieu        TEXT        NOT NULL,
  du_lieu     BYTEA       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS thu_vien_anh_trang ON thu_vien_anh (trang_id, created_at DESC);

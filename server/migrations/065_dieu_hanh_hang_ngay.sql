-- 065 (24/10/2026): ④ AI ĐIỀU HÀNH CHẤM MỖI NGÀY (sơ đồ: "chấm mỗi ngày là đích"; chủ dự án đồng ý chỉ cửa hàng có hoạt động;
-- phiên kiểm duyệt duyệt thiết kế H7). Chỉ TẠO BẢNG mới, không sửa dòng nào.
-- Mỗi (cửa hàng, ngày giờ VN) đúng MỘT dòng: giành chỗ bằng INSERT … ON CONFLICT DO NOTHING TRƯỚC khi gọi AI → máy chủ khởi
-- động lại giữa lượt không chạy lại ngày đó (không tiêu tiền hai lần). Xoá tài khoản / cửa hàng → dòng đi theo (CASCADE).
CREATE TABLE IF NOT EXISTS dieu_hanh_hang_ngay (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trang_id    BIGINT      NOT NULL REFERENCES trang(id) ON DELETE CASCADE,
  ngay        DATE        NOT NULL,
  trang_thai  TEXT        NOT NULL CHECK (trang_thai IN ('dang_chay', 'khong_hoat_dong', 'khong_van_de', 'de_xuat', 'loi', 'cham_tran')),
  van_de      TEXT,
  de_xuat_id  BIGINT,
  tien_usd    NUMERIC     NOT NULL DEFAULT 0,
  ghi_chu     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  xong_luc    TIMESTAMPTZ,
  UNIQUE (trang_id, ngay)
);
CREATE INDEX IF NOT EXISTS dieu_hanh_hang_ngay_ngay ON dieu_hanh_hang_ngay (ngay);

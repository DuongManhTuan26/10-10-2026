-- Lựa chọn trang ĐANG CHỜ cho một kênh sắp nối: ghi lúc chủ shop bấm nối (biết trang + hồ sơ + nền tảng, chưa biết mã
-- kênh). Lượt đồng bộ đầu tiên thấy kênh mới của đúng (hồ sơ, nền tảng) thì xếp thẳng vào trang đó rồi xoá dòng này —
-- không để kênh rơi vào trang nào khác dù chỉ một lúc. Hồ sơ được chọn sao cho CHƯA có nền tảng đó (mỗi hồ sơ một tài
-- khoản mỗi nền tảng), nên kênh của (hồ sơ, nền tảng) đó chắc chắn là kênh vừa nối.
CREATE TABLE IF NOT EXISTS kenh_cho_trang (
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_ref TEXT        NOT NULL,
  platform    TEXT        NOT NULL,
  trang_id    BIGINT      NOT NULL REFERENCES trang(id) ON DELETE CASCADE,
  het         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, profile_ref, platform)
);

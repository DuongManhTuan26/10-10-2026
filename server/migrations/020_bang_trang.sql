-- Mỗi Trang bán hàng là một môi trường độc lập.
--
-- VÌ SAO CẦN
--
-- Toàn bộ "bộ não" của AI — vai trò, tài liệu, bảng giá — đang gắn với TÀI
-- KHOẢN, không gắn với Trang. Đổi Trang thì cái đầu không đổi theo. Đã thấy
-- tận mắt trên dữ liệu thật: tài khoản gắn Trang "Chạm Tay Vạn Điều Hay" mà
-- vai trò AI vẫn là "chuyên viên tư vấn tài chính".
--
-- Với hai Trang bán hai thứ khác nhau — quần lót nam và bột sắn dây — dùng
-- chung một bộ não là chắc chắn nói sai sản phẩm và sai GIÁ với khách thật.
--
-- KIẾN TRÚC
--
-- Mỗi Trang có hồ sơ Zernio riêng. Đã đo và chứng minh được: hai hồ sơ, hai
-- Trang Facebook khác nhau, cùng nhận tin nhắn và bình luận cùng lúc, không
-- cái nào đá cái nào. Đó là cách duy nhất vòng qua giới hạn "một kết nối
-- Facebook chỉ phục vụ một Trang" của nhà cung cấp.
--
-- Người dùng KHÔNG bao giờ nhìn thấy chữ "hồ sơ" — với họ chỉ là "thêm Trang".
--
-- trang_id luôn SUY RA TỪ KÊNH, không chọn độc lập: hội thoại, bình luận, bài
-- đăng đều đã mang social_account_id, và giao diện đã có sẵn bộ chọn kênh.
-- Không phát minh khái niệm mới cho người dùng phải học.

CREATE TABLE IF NOT EXISTS trang (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Hồ sơ Zernio riêng của Trang này. Mỗi Trang một hồ sơ.
  profile_ref   TEXT        NOT NULL,
  -- id và tên Trang trên nền tảng. Để trống khi chưa gắn kênh nào.
  page_id       TEXT,
  ten           TEXT        NOT NULL DEFAULT 'Trang chưa đặt tên',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Một hồ sơ Zernio chỉ thuộc về đúng một Trang.
  CONSTRAINT trang_profile_ref_key UNIQUE (profile_ref)
);

CREATE INDEX IF NOT EXISTS trang_user_idx ON trang (user_id);

-- Kênh thuộc Trang nào. ON DELETE SET NULL: xoá Trang không được làm mất kênh,
-- vì hội thoại và đơn hàng cũ còn tham chiếu tới kênh đó.
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS trang_id BIGINT
  REFERENCES trang(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS social_accounts_trang_idx ON social_accounts (trang_id);

-- Bộ não gắn theo Trang.
--
-- CHỈ hai bảng này. Luật an toàn (handoff_rules), hàng rào tốc độ
-- (guardrail_configs) và cảnh báo Telegram giữ ở cấp tài khoản có chủ đích:
-- đó là chính sách và an toàn của chủ shop, không phải kiến thức sản phẩm.
ALTER TABLE ai_configs   ADD COLUMN IF NOT EXISTS trang_id BIGINT
  REFERENCES trang(id) ON DELETE CASCADE;
ALTER TABLE ai_documents ADD COLUMN IF NOT EXISTS trang_id BIGINT
  REFERENCES trang(id) ON DELETE CASCADE;

-- Dựng Trang đầu tiên cho dữ liệu đang có, giữ nguyên mọi thứ.
DO $$
DECLARE u RECORD; t BIGINT;
BEGIN
  FOR u IN SELECT id, profile_ref FROM users WHERE profile_ref IS NOT NULL LOOP
    SELECT id INTO t FROM trang WHERE profile_ref = u.profile_ref;
    IF t IS NULL THEN
      INSERT INTO trang (user_id, profile_ref, ten)
      VALUES (u.id, u.profile_ref,
              COALESCE((SELECT display_name FROM social_accounts
                         WHERE user_id = u.id AND platform = 'facebook'
                         ORDER BY created_at LIMIT 1), 'Trang đầu tiên'))
      RETURNING id INTO t;
    END IF;

    UPDATE social_accounts SET trang_id = t WHERE user_id = u.id AND trang_id IS NULL;
    UPDATE ai_configs      SET trang_id = t WHERE user_id = u.id AND trang_id IS NULL;
    UPDATE ai_documents    SET trang_id = t WHERE user_id = u.id AND trang_id IS NULL;
  END LOOP;
END $$;

-- Sau khi đã điền xong thì bắt buộc phải có, để không bao giờ sinh ra bản ghi
-- bộ não không thuộc Trang nào.
ALTER TABLE ai_configs   ALTER COLUMN trang_id SET NOT NULL;
ALTER TABLE ai_documents ALTER COLUMN trang_id SET NOT NULL;

-- Mỗi Trang một vai trò cho mỗi loại AI.
DROP INDEX IF EXISTS ai_configs_user_kind_key;
ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_user_id_kind_key;
CREATE UNIQUE INDEX IF NOT EXISTS ai_configs_trang_kind_key
  ON ai_configs (trang_id, kind);

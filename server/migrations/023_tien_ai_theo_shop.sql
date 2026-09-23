-- Ghi tiền AI theo TỪNG SHOP.
--
-- Trước đây chi phí mỗi lượt gọi có sẵn (OpenRouter trả về trong usage.cost)
-- nhưng KHÔNG lưu ở đâu cả. Hậu quả: không biết shop nào tiêu bao nhiêu.
-- Shop trả 390.000đ/tháng mà đốt 900.000đ tiền AI thì mình lỗ, và lỗ âm thầm
-- cho tới khi nhìn hoá đơn tổng cuối tháng — lúc đó không truy được của ai.
--
-- Đây là bảng ghi sự kiện, chỉ thêm không sửa. Một dòng là một lượt gọi AI.

CREATE TABLE IF NOT EXISTS ai_usage (
  id            BIGSERIAL   PRIMARY KEY,
  -- Không tham chiếu users(id): xoá tài khoản rồi thì số tiền đã tiêu vẫn
  -- phải còn để đối chiếu hoá đơn của nhà cung cấp.
  user_id       BIGINT,
  -- 'sales' | 'content' | 'ads' | 'analytics' | 'vision' | 'image'
  task          TEXT        NOT NULL,
  model         TEXT        NOT NULL DEFAULT '',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  -- Chi phí thật của lượt gọi, do nhà cung cấp báo về. 6 chữ số thập phân vì
  -- một lượt trả lời tin nhắn thường chỉ tốn vài phần nghìn đô.
  cost_usd      NUMERIC(14,6) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tra theo shop và theo khoảng thời gian là hai việc duy nhất bảng này phục vụ.
CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx ON ai_usage (user_id, created_at DESC);

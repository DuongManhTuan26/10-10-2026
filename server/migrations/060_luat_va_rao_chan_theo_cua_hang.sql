-- A3 (22/10/2026): LUẬT CHUYỂN NGƯỜI THẬT + RÀO CHẮN theo CỬA HÀNG; lượt gửi ghi cửa hàng của việc. Thiết kế duyệt cùng
-- phiên kiểm duyệt. Chỉ THÊM + điền + sao lưu + RAISE; không xoá dòng nào.
--  · Sơ đồ chủ dự án chốt (§ "DỮ LIỆU RIÊNG CỦA CỬA HÀNG", A3): "Luật chuyển người thật + rào chắn riêng từng cửa hàng
--    (cửa hàng mới chép bộ mặc định)". Ghi chú cũ ở 020 ("giữ ở cấp tài khoản có chủ đích") được thay bằng quyết định này.
--  · Rào chắn tách theo BẢN CHẤT: trần tin / phút là trần thật của nhà cung cấp cho cả khoá API → GIỮ ở guardrail_configs
--    (cấp tài khoản; xem TD-21). Lời tự giới thiệu, trần AI / giờ, tự ngắt khi lỗi, nghỉ giữa hai tin riêng → THEO CỬA HÀNG
--    (bảng rao_chan_cua_hang). Các cột đó trên guardrail_configs GIỮ NGUYÊN (không xoá), không còn đọc / ghi.
--  · Cửa hàng chưa có dòng → mặc định trong mã (luatCuaCuaHang / loadConfig), không chèn ở các chỗ tạo cửa hàng.
-- Báo cáo chỉ đọc trước (22/10): handoff_rules 7 tài khoản × 7 luật, không cửa hàng; guardrail_configs chỉ tài khoản 5 (giá
-- trị mặc định); send_attempts 63 dòng (44 không hội thoại = trả lời bình luận); orders 0.

CREATE TABLE IF NOT EXISTS handoff_rules_truoc_060 AS
SELECT id, user_id, rule_key, enabled, config, now() AS sao_luu_luc FROM handoff_rules;
CREATE TABLE IF NOT EXISTS send_attempts_truoc_060 AS
SELECT id, user_id, social_account_id, conversation_id, now() AS sao_luu_luc FROM send_attempts;

-- ── LUẬT CHUYỂN NGƯỜI THẬT ─────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE handoff_rules ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE CASCADE;
-- 1. Dòng đang có → cửa hàng CŨ NHẤT của tài khoản (giữ nguyên dòng).
UPDATE handoff_rules h SET trang_id = (SELECT MIN(t.id) FROM trang t WHERE t.user_id = h.user_id)
 WHERE h.trang_id IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM handoff_rules WHERE trang_id IS NULL) THEN
    RAISE EXCEPTION '060: còn luật chuyển người thật không gắn được cửa hàng (tài khoản không có cửa hàng) — dừng';
  END IF;
END $$;
ALTER TABLE handoff_rules ALTER COLUMN trang_id SET NOT NULL;
-- Bỏ khoá CŨ (user_id, rule_key) TRƯỚC khi chép: bản chép cho cửa hàng thứ hai có cùng (user_id, rule_key) với dòng gốc
-- (phiên kiểm duyệt bắt 22/10 — để sau thì 060 vỡ "duplicate key", máy chủ không khởi động).
DROP INDEX IF EXISTS handoff_rules_user_key;
-- Mọi ON CONFLICT của handoff_rules phải ghi đúng: (trang_id, rule_key).
CREATE UNIQUE INDEX IF NOT EXISTS handoff_rules_trang_key ON handoff_rules (trang_id, rule_key);
-- 2. Chép cho các cửa hàng còn lại của tài khoản → mỗi cửa hàng giữ đúng bộ luật tài khoản đang dùng.
INSERT INTO handoff_rules (user_id, trang_id, rule_key, enabled, config)
SELECT h.user_id, t.id, h.rule_key, h.enabled, h.config
  FROM handoff_rules h
  JOIN trang t ON t.user_id = h.user_id AND t.id <> h.trang_id
 WHERE h.trang_id = (SELECT MIN(t2.id) FROM trang t2 WHERE t2.user_id = h.user_id)
ON CONFLICT (trang_id, rule_key) DO NOTHING;

-- ── RÀO CHẮN THEO CỬA HÀNG ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rao_chan_cua_hang (
  id                       BIGSERIAL   PRIMARY KEY,
  trang_id                 BIGINT      NOT NULL UNIQUE REFERENCES trang(id) ON DELETE CASCADE,
  user_id                  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disclosure_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  disclosure_text          TEXT        NOT NULL DEFAULT
    'Em là trợ lý tự động của shop, nếu cần gặp nhân viên anh/chị nhắn "gặp người thật" giúp em nhé.',
  max_ai_sends_per_hour    INTEGER     NOT NULL DEFAULT 0,
  auto_pause_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  failure_rate_threshold   INTEGER     NOT NULL DEFAULT 30,
  failure_min_samples      INTEGER     NOT NULL DEFAULT 10,
  auto_pause_minutes       INTEGER     NOT NULL DEFAULT 60,
  author_dm_cooldown_hours INTEGER     NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Chép giá trị tài khoản đang dùng vào MỌI cửa hàng của tài khoản đó (hiện chỉ tài khoản 5).
INSERT INTO rao_chan_cua_hang (trang_id, user_id, disclosure_enabled, disclosure_text, max_ai_sends_per_hour,
                               auto_pause_enabled, failure_rate_threshold, failure_min_samples, auto_pause_minutes,
                               author_dm_cooldown_hours)
SELECT t.id, g.user_id, g.disclosure_enabled, g.disclosure_text, g.max_ai_sends_per_hour, g.auto_pause_enabled,
       g.failure_rate_threshold, g.failure_min_samples, g.auto_pause_minutes, g.author_dm_cooldown_hours
  FROM guardrail_configs g JOIN trang t ON t.user_id = g.user_id
ON CONFLICT (trang_id) DO NOTHING;
DROP TRIGGER IF EXISTS so_thay_doi_rao_chan_cua_hang ON rao_chan_cua_hang;
CREATE TRIGGER so_thay_doi_rao_chan_cua_hang AFTER INSERT OR UPDATE OR DELETE ON rao_chan_cua_hang
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at');
COMMENT ON COLUMN guardrail_configs.disclosure_enabled IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.disclosure_text IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.max_ai_sends_per_hour IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.auto_pause_enabled IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.failure_rate_threshold IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.failure_min_samples IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.auto_pause_minutes IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';
COMMENT ON COLUMN guardrail_configs.author_dm_cooldown_hours IS 'KHÔNG còn đọc / ghi từ 060 — xem rao_chan_cua_hang.';

-- ── LƯỢT GỬI GHI CỬA HÀNG CỦA VIỆC ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE send_attempts ADD COLUMN IF NOT EXISTS trang_id BIGINT REFERENCES trang(id) ON DELETE SET NULL;
-- 1. Theo hội thoại (058 / 2b: cửa hàng chốt theo nhiệm kỳ).
UPDATE send_attempts s SET trang_id = c.trang_id
  FROM conversations c WHERE c.id = s.conversation_id AND s.trang_id IS NULL;
-- 2. Không hội thoại (trả lời bình luận) → nhiệm kỳ của kênh lúc gửi.
UPDATE send_attempts s SET trang_id = nk.trang_id
  FROM kenh_nhiem_ky nk
 WHERE nk.account_id = s.social_account_id AND s.trang_id IS NULL
   AND s.created_at >= nk.tu_luc AND (nk.den_luc IS NULL OR s.created_at < nk.den_luc);
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM send_attempts WHERE trang_id IS NULL;
  RAISE NOTICE '060: % lượt gửi không suy được cửa hàng (gửi trước khi có nhiệm kỳ / kênh đã xoá) — giữ NULL', n;
END $$;
CREATE INDEX IF NOT EXISTS send_attempts_trang_idx ON send_attempts (trang_id, created_at DESC);

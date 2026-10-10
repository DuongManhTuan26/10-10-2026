-- SỔ THAY ĐỔI — bước 0 của AI điều hành (chủ dự án duyệt 09/10/2026; docs/nghien-cuu-bo-de-ai-dieu-hanh.md mục 14).
--
-- Vì sao: trước bản này các bảng cài đặt / tài liệu / lời dặn / lịch đăng / hàng rào / kênh chỉ giữ TRẠNG THÁI HIỆN TẠI.
-- AI điều hành không trả lời được câu quan trọng nhất khi chẩn đoán: "cái gì vừa đổi, lúc nào, từ gì sang gì" — loại
-- bằng chứng mạnh nhất về CƠ CHẾ. Không có nó, AI chỉ còn đoán.
--
-- Vì sao dùng TRIGGER thay vì sửa từng chỗ ghi: đếm bằng máy có 6 bảng, ~20 chỗ ghi rải ở routes / services; sửa tay
-- là sót (quy trình kiểm duyệt, bước 1), và chỗ ghi viết THÊM sau này cũng sót. Trigger bắt MỌI lần ghi.
--
-- An toàn: ghi sổ hỏng KHÔNG BAO GIỜ được làm hỏng lần ghi gốc (chủ shop vẫn lưu được cài đặt) — lỗi trong khối riêng,
-- chỉ cảnh báo. Chỉ ghi các cột THẬT SỰ đổi; bỏ cột đếm / giờ cập nhật / bản sao thô của nhà cung cấp.
-- Ai đổi: hệ thống không biết chắc ở tầng trigger → để trống ("chưa rõ"), KHÔNG đoán là chủ shop. Đường ghi nào biết
-- mình là ai (AI điều hành, tự ngắt an toàn…) đặt `SET LOCAL app.nguon_thay_doi` trong cùng giao dịch.

CREATE TABLE IF NOT EXISTS so_thay_doi (
  id         BIGSERIAL   PRIMARY KEY,
  luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    BIGINT,
  trang_id   BIGINT,
  bang       TEXT        NOT NULL,
  ban_ghi    TEXT,
  hanh_dong  TEXT        NOT NULL CHECK (hanh_dong IN ('them', 'sua', 'xoa')),
  -- Chỉ các cột đã đổi: giá trị trước / sau.
  truoc      JSONB,
  sau        JSONB,
  -- null = chưa rõ ai đổi.
  nguon      TEXT
);
CREATE INDEX IF NOT EXISTS so_thay_doi_trang ON so_thay_doi (trang_id, luc);
CREATE INDEX IF NOT EXISTS so_thay_doi_user ON so_thay_doi (user_id, luc);

CREATE OR REPLACE FUNCTION ghi_so_thay_doi() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  bo_qua text[] := TG_ARGV;
  cu jsonb;
  moi jsonb;
  truoc jsonb := '{}'::jsonb;
  sau jsonb := '{}'::jsonb;
  r jsonb;
  k text;
  -- Văn bản tài liệu có thể dài: khi THÊM / SỬA chỉ ghi độ dài + dấu vân tay (bản đầy đủ vẫn nằm trong bảng gốc);
  -- khi XOÁ ghi cả văn bản (bảng gốc không còn).
  rut jsonb;
BEGIN
  BEGIN
    IF TG_OP <> 'INSERT' THEN cu := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN moi := to_jsonb(NEW); END IF;
    FOR k IN SELECT jsonb_object_keys(COALESCE(moi, cu)) LOOP
      CONTINUE WHEN k = ANY (bo_qua);
      IF TG_OP = 'UPDATE' THEN
        IF (cu -> k) IS DISTINCT FROM (moi -> k) THEN
          truoc := truoc || jsonb_build_object(k, cu -> k);
          sau := sau || jsonb_build_object(k, moi -> k);
        END IF;
      ELSIF TG_OP = 'INSERT' THEN
        sau := sau || jsonb_build_object(k, moi -> k);
      ELSE
        truoc := truoc || jsonb_build_object(k, cu -> k);
      END IF;
    END LOOP;
    IF TG_OP = 'UPDATE' AND sau = '{}'::jsonb THEN RETURN NULL; END IF;
    IF sau ? 'extracted_text' THEN
      rut := jsonb_build_object('do_dai', length(sau ->> 'extracted_text'), 'van_tay', md5(COALESCE(sau ->> 'extracted_text', '')));
      sau := jsonb_set(sau, '{extracted_text}', rut);
      IF truoc ? 'extracted_text' THEN
        truoc := jsonb_set(truoc, '{extracted_text}', jsonb_build_object('do_dai', length(truoc ->> 'extracted_text'), 'van_tay', md5(COALESCE(truoc ->> 'extracted_text', ''))));
      END IF;
    END IF;
    r := COALESCE(moi, cu);
    INSERT INTO so_thay_doi (user_id, trang_id, bang, ban_ghi, hanh_dong, truoc, sau, nguon)
    VALUES (
      (r ->> 'user_id')::bigint,
      (r ->> 'trang_id')::bigint,
      TG_TABLE_NAME,
      COALESCE(r ->> 'id', r ->> 'user_id'),
      CASE TG_OP WHEN 'INSERT' THEN 'them' WHEN 'UPDATE' THEN 'sua' ELSE 'xoa' END,
      NULLIF(truoc, '{}'::jsonb),
      NULLIF(sau, '{}'::jsonb),
      NULLIF(current_setting('app.nguon_thay_doi', true), '')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'so_thay_doi (%): %', TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS so_thay_doi_ai_configs ON ai_configs;
CREATE TRIGGER so_thay_doi_ai_configs AFTER INSERT OR UPDATE OR DELETE ON ai_configs
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at');

DROP TRIGGER IF EXISTS so_thay_doi_ai_documents ON ai_documents;
CREATE TRIGGER so_thay_doi_ai_documents AFTER INSERT OR UPDATE OR DELETE ON ai_documents
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'storage_path');

DROP TRIGGER IF EXISTS so_thay_doi_guardrail_configs ON guardrail_configs;
CREATE TRIGGER so_thay_doi_guardrail_configs AFTER INSERT OR UPDATE OR DELETE ON guardrail_configs
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at');

DROP TRIGGER IF EXISTS so_thay_doi_handoff_rules ON handoff_rules;
CREATE TRIGGER so_thay_doi_handoff_rules AFTER INSERT OR UPDATE OR DELETE ON handoff_rules
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at');

DROP TRIGGER IF EXISTS so_thay_doi_auto_scripts ON auto_scripts;
CREATE TRIGGER so_thay_doi_auto_scripts AFTER INSERT OR UPDATE OR DELETE ON auto_scripts
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at', 'stats', 'zernio_automation_id');

-- Kênh: chỉ quan tâm kết nối / cần nối lại / tạm ngắt AI / gắn trang / tài khoản quảng cáo — bỏ bản sao thô, ảnh,
-- số người theo dõi, giờ đồng bộ (đồng bộ chạy thường xuyên, ghi lại sẽ ngập sổ).
DROP TRIGGER IF EXISTS so_thay_doi_social_accounts ON social_accounts;
CREATE TRIGGER so_thay_doi_social_accounts AFTER INSERT OR UPDATE OR DELETE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION ghi_so_thay_doi('created_at', 'updated_at', 'raw', 'last_synced_at', 'followers_count',
    'profile_picture', 'profile_url', 'username', 'display_name', 'token_expires_at');

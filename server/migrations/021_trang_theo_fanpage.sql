-- Trang phải khoá theo FANPAGE ĐANG GẮN, không phải theo hồ sơ Zernio.
--
-- Đo thật trên API Zernio ngày 18/09/2026:
--   hồ sơ "hoangtuan" (6a83cc4f…) chứa 3 kênh: facebook, instagram, tiktok
--   kênh facebook 6a84601777… gắn Fanpage 851314991396686
--   kênh đó CHỌN ĐƯỢC cả Fanpage 686754604528250, đổi bằng
--   PUT /accounts/{id}/facebook-page — và profileId KHÔNG đổi theo.
--
-- Hậu quả của cách khoá cũ: chủ shop bấm "Đổi Trang" sang Fanpage khác thì
-- profile_ref giữ nguyên, nên trang_id giữ nguyên, nên Fanpage mới THỪA KẾ
-- nguyên bộ não của Fanpage cũ — vai trò, kịch bản, bảng giá. Bán bột sắn dây
-- bằng bảng giá quần lót, không một dòng báo lỗi nào.
--
-- Mã Fanpage nằm sẵn trong bản ghi kênh Zernio tại metadata.selectedPageId,
-- mình đã lưu cả cục vào social_accounts.raw nên lấy lại được, không cần gọi
-- thêm API nào.

ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS page_id TEXT;

UPDATE social_accounts
   SET page_id = raw->'metadata'->>'selectedPageId'
 WHERE page_id IS NULL
   AND raw->'metadata'->>'selectedPageId' IS NOT NULL;

-- Trang nào đang phục vụ Fanpage nào: lấy theo kênh facebook thuộc Trang đó.
UPDATE trang t
   SET page_id = s.page_id
  FROM social_accounts s
 WHERE s.trang_id = t.id
   AND s.platform = 'facebook'
   AND s.page_id IS NOT NULL
   AND t.page_id IS NULL;

-- Một hồ sơ nay có thể có NHIỀU Trang — mỗi Fanpage một Trang. Khoá duy nhất
-- cũ chặn đúng điều đó nên phải bỏ, thay bằng khoá theo cặp (hồ sơ, Fanpage).
-- COALESCE để các nền tảng không có khái niệm Fanpage (Instagram, TikTok) vẫn
-- nằm được đúng một Trang cho mỗi hồ sơ.
ALTER TABLE trang DROP CONSTRAINT IF EXISTS trang_profile_ref_key;

CREATE UNIQUE INDEX IF NOT EXISTS trang_ho_so_fanpage_key
  ON trang (profile_ref, COALESCE(page_id, ''));

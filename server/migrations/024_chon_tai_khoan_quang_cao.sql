-- Chủ shop chọn tài khoản quảng cáo nào để chạy.
--
-- Đo thật ngày 24/09/2026: một kênh Meta Ads trả về HAI tài khoản quảng cáo
--   act_1357505662010463 "Dương Tuấn"  (accountStatus 1)
--   act_867161792911070  "Tuan Duong"  (của Business)
-- Mã cũ tự chọn cái đầu tiên đang hoạt động, không hỏi và không hiện ra.
-- Chiến dịch nằm ở tài khoản kia thì trang quảng cáo trống trơn, mà chủ shop
-- không có cách nào biết vì sao — không một dòng nào nói đang xem tài khoản nào.

ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS ad_account_ref TEXT;

COMMENT ON COLUMN social_accounts.ad_account_ref IS
  'Tài khoản quảng cáo chủ shop đã chọn. NULL thì lấy cái đầu đang hoạt động.';

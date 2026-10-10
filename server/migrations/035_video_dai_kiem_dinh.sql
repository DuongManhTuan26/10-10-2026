-- Kiểm định từng cảnh video dài ngay khi vẽ xong; cảnh lỗi thì vẽ lại đúng cảnh đó (02/10/2026).
--
-- Vì sao: mô hình video ngẫu nhiên — đã đo ở dự án #8: 6/8 cảnh tự trôi đêm→ngày hoặc mờ chồng.
-- Phát hiện sau khi ghép là đã trả tiền cả video; phát hiện từng cảnh thì chỉ vẽ lại cảnh đó.
--
-- video_ai.kiem_dinh: NULL = chưa kiểm; 'dat'; 'loi: <lý do>'; 'khong_kiem_duoc: <lý do>'.
-- video_ai.bo_qua: cảnh bị loại vì lỗi (đã trả tiền — tiền chuyển vào du_an_video.chi_phi_them).
-- du_an_video.tu_kiem: chủ shop bật/tắt tự kiểm + vẽ lại; so_lan_ve_lai: đã vẽ lại mấy cảnh (có trần).
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS kiem_dinh TEXT;
ALTER TABLE video_ai ADD COLUMN IF NOT EXISTS bo_qua BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS tu_kiem BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE du_an_video ADD COLUMN IF NOT EXISTS so_lan_ve_lai INTEGER NOT NULL DEFAULT 0;

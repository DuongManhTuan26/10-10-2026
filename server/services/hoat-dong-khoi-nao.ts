/**
 * HOẠT ĐỘNG KHỐI NÃO (31/10/2026, chủ dự án: "nhân viên AI chuyển động theo trạng thái làm việc THẬT", ưu tiên tốc độ).
 *
 * Một câu SQL CHỈ ĐỌC gom việc thật của 4 AI trong 10 phút gần nhất của MỘT cửa hàng, từ các bảng sẵn có (mỗi nhánh có chỉ
 * mục theo trang_id). Không có mốc "đang xử lý" (chủ dự án: báo xong là đủ) — chỉ: nhận việc, hoàn thành, bàn giao, báo cáo,
 * cảnh báo. Không trả nội dung tin khách / tên khách — chỉ nhãn chung.
 *
 *   ai     = nhân viên làm việc đó; luong_tu → luong_den = dòng chảy giữa các văn phòng (giao dữ liệu / bàn giao / báo cáo).
 *   tuoi   = số giây từ lúc xảy ra tới lúc đọc (tính ở máy chủ — không lệ thuộc đồng hồ máy khách).
 */
import { query } from "../db.js";

export type MaNhanVien = "noi_dung" | "quang_cao" | "ban_hang" | "dieu_hanh";
export type LoaiViec = "nhan" | "xong" | "ban_giao" | "bao_cao" | "canh_bao";
export interface SuKienKhoiNao {
  ai: MaNhanVien;
  loai: LoaiViec;
  chu: string;
  luong_tu: MaNhanVien | "ba_ai" | null;
  luong_den: MaNhanVien | null;
  tuoi: number;
}

export const CAU_HOAT_DONG = `
WITH su AS (
  -- ① viết / tạo ảnh / tạo video xong (sổ chi phí AI ghi SAU khi gọi xong)
  SELECT 'noi_dung' AS ai, 'xong' AS loai,
         CASE u.task WHEN 'video' THEN 'Tạo xong video' WHEN 'image' THEN 'Tạo xong ảnh' ELSE 'Viết xong nội dung' END AS chu,
         NULL::text AS luong_tu, NULL::text AS luong_den, u.created_at AS luc
    FROM ai_usage u WHERE u.trang_id = $1 AND u.task IN ('content', 'image', 'video') AND u.created_at > now() - interval '10 minutes'
  UNION ALL
  -- ① đăng bài lên Fanpage → bài sẵn cho ② đẩy quảng cáo
  SELECT 'noi_dung', 'ban_giao', 'Đã đăng bài', 'noi_dung', 'quang_cao', p.published_at
    FROM posts p WHERE p.trang_id = $1 AND p.status = 'published' AND p.published_at > now() - interval '10 minutes'
  UNION ALL
  SELECT 'noi_dung', 'canh_bao', 'Đăng bài lỗi', NULL, NULL, p.updated_at
    FROM posts p WHERE p.trang_id = $1 AND p.status = 'failed' AND p.updated_at > now() - interval '10 minutes'
  UNION ALL
  -- ② đẩy bài / đổi chiến dịch / tệp đối tượng (sổ thay đổi ghi sau khi nền tảng nhận)
  SELECT 'quang_cao', 'xong',
         CASE d.bang WHEN 'quang_cao_day_bai' THEN 'Đã đẩy bài quảng cáo' WHEN 'quang_cao_chien_dich' THEN 'Đã cập nhật chiến dịch'
                     ELSE 'Đã cập nhật tệp đối tượng' END, NULL, NULL, d.luc
    FROM so_thay_doi d WHERE d.trang_id = $1 AND d.bang IN ('quang_cao_day_bai', 'quang_cao_chien_dich', 'quang_cao_doi_tuong')
     AND d.luc > now() - interval '10 minutes'
  UNION ALL
  -- ② khách đến từ quảng cáo → ③ tiếp
  SELECT 'quang_cao', 'ban_giao', 'Khách từ quảng cáo', 'quang_cao', 'ban_hang', c.created_at
    FROM conversations c WHERE c.trang_id = $1 AND c.origin = 'quang_cao' AND c.last_message_at > now() - interval '10 minutes'
     AND c.created_at > now() - interval '10 minutes'
  UNION ALL
  -- ③ khách nhắn (nhận việc) / AI trả lời (xong)
  SELECT 'ban_hang', CASE m.sender_type WHEN 'customer' THEN 'nhan' ELSE 'xong' END,
         CASE m.sender_type WHEN 'customer' THEN 'Khách nhắn tin' ELSE 'Đã trả lời khách' END, NULL, NULL, m.created_at
    FROM conversations c JOIN messages m ON m.conversation_id = c.id
   WHERE c.trang_id = $1 AND c.last_message_at > now() - interval '10 minutes'
     AND m.created_at > now() - interval '10 minutes' AND m.sender_type IN ('customer', 'ai')
  UNION ALL
  -- ③ chốt đơn → báo ④
  SELECT 'ban_hang', 'bao_cao', 'Chốt đơn mới', 'ban_hang', 'dieu_hanh', o.created_at
    FROM orders o WHERE o.trang_id = $1 AND o.status <> 'cancelled' AND o.created_at > now() - interval '10 minutes'
  UNION ALL
  SELECT 'ban_hang', 'canh_bao', 'Cần người tiếp khách', NULL, NULL, c.handoff_at
    FROM conversations c WHERE c.trang_id = $1 AND c.handoff_at > now() - interval '10 minutes'
  UNION ALL
  SELECT 'ban_hang', 'canh_bao', 'Gửi tin không thành công', NULL, NULL, a.created_at
    FROM send_attempts a WHERE a.trang_id = $1 AND a.outcome = 'failed' AND a.created_at > now() - interval '10 minutes'
  UNION ALL
  -- ④ lượt chấm hằng ngày đọc số của cả 3 AI
  SELECT 'dieu_hanh', 'xong', 'Chấm điểm 3 AI xong', 'ba_ai', 'dieu_hanh', h.xong_luc
    FROM dieu_hanh_hang_ngay h WHERE h.trang_id = $1 AND h.xong_luc > now() - interval '10 minutes'
  UNION ALL
  SELECT 'dieu_hanh', 'bao_cao', 'Có đề xuất chờ duyệt', NULL, NULL, x.luc
    FROM de_xuat_dieu_hanh x WHERE x.trang_id = $1 AND x.luc > now() - interval '10 minutes'
)
SELECT ai, loai, chu, luong_tu, luong_den, GREATEST(0, EXTRACT(EPOCH FROM now() - luc))::int AS tuoi
  FROM su ORDER BY luc DESC LIMIT 40`;

export async function hoatDongKhoiNao(trangId: number): Promise<SuKienKhoiNao[]> {
  return (await query<SuKienKhoiNao>(CAU_HOAT_DONG, [trangId])).rows;
}

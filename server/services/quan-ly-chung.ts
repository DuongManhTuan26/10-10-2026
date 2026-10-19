/**
 * Danh sách tài khoản cho màn hình QUẢN LÝ của quản trị tổng: MỘT câu lệnh, MỘT bộ cột.
 *
 * Chủ dự án 18/10/2026: bỏ tầng chủ chuỗi (admin con) — mọi tài khoản là tài khoản dùng thường, đứng ngang hàng;
 * mỗi tài khoản tự giữ nhiều cửa hàng.
 */

import { query } from "../db.js";
import { DAU_NGAY_VN, DAU_THANG_VN } from "../moc-thoi-gian.js";

export type PhamVi = { loai: "tong" };

/** Một dòng tài khoản — giống hệt nhau ở cả hai màn hình. */
export const COT_QUAN_LY = `
  u.id, u.email, u.name, u.plan, u.role, u.is_active, u.created_at,
  (u.id = $1) AS la_toi,
  /* --- Kênh --- */
  (SELECT count(*)::int FROM social_accounts s WHERE s.user_id = u.id AND s.connected) AS kenh_noi,
  (SELECT count(*)::int FROM social_accounts s WHERE s.user_id = u.id AND s.needs_reconnection) AS kenh_can_noi_lai,
  -- CHỈ Fanpage đang còn nối (không thì thẻ hiện "Fanpage: X" cạnh cảnh báo "Chưa nối Fanpage nào").
  (SELECT s.display_name FROM social_accounts s
    WHERE s.user_id = u.id AND s.platform = 'facebook' AND s.connected ORDER BY s.created_at LIMIT 1) AS ten_fanpage,
  /* --- Bộ não AI --- */
  (SELECT count(*)::int FROM ai_configs c
    WHERE c.user_id = u.id AND c.kind = 'sales' AND coalesce(c.system_prompt, '') <> '') AS da_day_vai_tro,
  (SELECT count(*)::int FROM ai_documents d WHERE d.user_id = u.id AND d.kind = 'sales') AS so_tai_lieu,
  (SELECT count(*)::int FROM ai_documents d WHERE d.user_id = u.id) AS tai_lieu,
  (SELECT coalesce((c.settings -> 'tuChu' ->> 'bat')::boolean, FALSE) FROM ai_configs c
    WHERE c.user_id = u.id AND c.kind = 'sales' ORDER BY c.id LIMIT 1) AS ai_tu_chu,
  (SELECT count(*)::int FROM auto_scripts a WHERE a.user_id = u.id AND a.is_active) AS kich_ban_bat,
  /* --- Vận hành --- */
  (SELECT count(*)::int FROM messages m WHERE m.user_id = u.id AND m.created_at >= now() - interval '7 days') AS tin_7_ngay,
  (SELECT count(*)::int FROM messages m
    WHERE m.user_id = u.id AND m.sender_type = 'ai' AND m.created_at >= now() - interval '7 days') AS ai_tra_loi_7_ngay,
  (SELECT max(m.created_at) FROM messages m WHERE m.user_id = u.id) AS hoat_dong_cuoi,
  (SELECT count(*)::int FROM conversations c WHERE c.user_id = u.id) AS hoi_thoai,
  (SELECT count(*)::int FROM conversations c WHERE c.user_id = u.id AND c.status = 'waiting_human') AS cho_nguoi,
  /* Cả tài khoản (màn quản trị liệt kê theo tài khoản) — không theo cửa hàng. */
  (SELECT count(*)::int FROM posts p WHERE p.user_id = u.id) AS bai,
  (SELECT t.enabled FROM telegram_configs t WHERE t.user_id = u.id) AS telegram,
  /* --- Kết quả --- */
  (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id AND o.created_at >= ${DAU_NGAY_VN}) AS don_hom_nay,
  (SELECT count(*)::int FROM orders o
    WHERE o.user_id = u.id AND o.created_at >= ${DAU_THANG_VN} AND o.status <> 'cancelled') AS don_thang,
  (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id) AS don,
  (SELECT COALESCE(SUM(o.total), 0)::bigint FROM orders o
    WHERE o.user_id = u.id AND o.created_at >= ${DAU_THANG_VN} AND o.status <> 'cancelled') AS doanh_thu_thang,
  -- Cùng cách tính với sao kê: số nhà cung cấp đã chốt, chưa chốt thì số lúc gọi.
  (SELECT COALESCE(SUM(coalesce(a.cost_ncc, a.cost_usd)), 0)::text FROM ai_usage a
    WHERE a.user_id = u.id AND a.created_at >= ${DAU_THANG_VN}) AS tien_ai_thang`;

/**
 * Danh sách tài khoản theo phạm vi. toiId: người đang xem (đánh dấu dòng của chính mình — dòng đó dùng
 * "Đổi mật khẩu" thay vì "cấp lại", không khoá / xoá được chính mình).
 */
export async function layDanhSachQuanLy(phamVi: PhamVi, toiId: number) {
  void phamVi; // chỉ còn một phạm vi: cả hệ thống (chủ dự án 18/10/2026 bỏ tầng chủ chuỗi)
  const rows = await query(`SELECT ${COT_QUAN_LY} FROM users u ORDER BY u.created_at`, [toiId]);
  return rows.rows;
}

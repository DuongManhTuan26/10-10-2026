/**
 * Phụ thuộc THẬT của bộ xoá (services/xoa-tai-khoan.ts): database + nhà cung cấp. Tách riêng để phần thứ tự lệnh thử
 * được bằng hàm giả trong bộ kiểm tra.
 */
import { query } from "../db.js";
import * as zernio from "./zernio.js";
import { ghiKenhTheoNgay } from "./trang.js";
import type { KenhNcc, PhuThuocXoa } from "./xoa-tai-khoan.js";

/** Kênh thật trong một hồ sơ — kèm hồ sơ vượt hạn mức, không lọc trạng thái (tài liệu GET /v1/accounts). */
export async function lietKeKenhHoSo(profileId: string): Promise<KenhNcc[]> {
  const ds = await zernio.listAccounts(profileId, { includeOverLimit: true });
  return ds.map((a) => ({
    id: a._id,
    platform: a.platform,
    ten: a.displayName || a.username || a._id,
    dangNoi: !(a.needsReconnection === true || a.isActive === false || a.enabled === false),
  }));
}

export const la404NhaCungCap = (e: unknown) => e instanceof zernio.ZernioError && e.status === 404;

export const phuThuocXoaThat: PhuThuocXoa = {
  async docHoSoCuaToi(userId) {
    const r = await query<{ nguon: string; id: string }>(
      `SELECT 'hồ sơ mặc định' AS nguon, profile_ref AS id FROM users WHERE id = $1 AND profile_ref IS NOT NULL
       UNION ALL
       SELECT 'cửa hàng "' || ten || '"', profile_ref FROM trang WHERE user_id = $1
       UNION ALL
       SELECT DISTINCT 'kênh đã nối', profile_ref FROM social_accounts WHERE user_id = $1 AND profile_ref IS NOT NULL`,
      [userId]
    );
    return r.rows;
  },
  async docHoSoDungChung(userId, ids) {
    if (ids.length === 0) return new Map();
    const r = await query<{ id: string; email: string }>(
      `SELECT x.id, u.email FROM (
          SELECT profile_ref AS id, id AS user_id FROM users WHERE profile_ref = ANY($2::text[])
          UNION SELECT profile_ref, user_id FROM trang WHERE profile_ref = ANY($2::text[])
          UNION SELECT profile_ref, user_id FROM social_accounts WHERE profile_ref = ANY($2::text[])
        ) x JOIN users u ON u.id = x.user_id
        WHERE x.user_id <> $1`,
      [userId, ids]
    );
    return new Map(r.rows.map((x) => [x.id, x.email]));
  },
  lietKeKenh: lietKeKenhHoSo,
  async khoaTaiKhoan(userId) {
    // Cùng cơ chế nút "Khoá tài khoản" (routes/admin.ts): chặn đăng nhập + giết mọi phiên, kể cả phiên quản trị mở vào.
    await query("UPDATE users SET is_active = FALSE, updated_at = now() WHERE id = $1", [userId]);
    await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [userId]);
  },
  async chotSoKenhNgay() {
    await ghiKenhTheoNgay();
  },
  ngatKenh: (id) => zernio.disconnectAccount(id),
  xoaHoSo: (id) => zernio.xoaHoSo(id),
  async xoaTaiKhoan(userId) {
    await query("DELETE FROM users WHERE id = $1", [userId]);
  },
  la404: la404NhaCungCap,
};

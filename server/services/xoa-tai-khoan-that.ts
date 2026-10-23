/**
 * Phụ thuộc THẬT của bộ xoá (services/xoa-tai-khoan.ts): database + nhà cung cấp. Tách riêng để phần thứ tự lệnh thử
 * được bằng hàm giả trong bộ kiểm tra.
 */
import { query, transaction } from "../db.js";
import * as zernio from "./zernio.js";
import { ghiKenhTheoNgay } from "./trang.js";
import { khoaTaiKhoan as khoaTaiKhoanChung } from "./tai-khoan-mo.js";
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

/*
 * XOÁ TÀI KHOẢN = XOÁ DỮ LIỆU (sơ đồ mục 1). Phần lớn bảng xoá theo khoá ngoại ON DELETE CASCADE từ users / trang; các bảng
 * dưới đây KHÔNG có khoá ngoại (sổ ghi theo user_id) nên phải xoá tay — bỏ sót từ 041–060 tới 23/10/2026 (mục 11a).
 * Mọi bảng có cột user_id phải thuộc: khoá ngoại xoá theo, BANG_XOA_THEM, BANG_SAO_LUU hoặc BANG_GIU (phép kiểm khoá).
 */
export const BANG_XOA_THEM = ["de_xuat_dieu_hanh", "so_loi_ai", "so_thay_doi", "so_bai_ngay", "hoi_thoai_cham"] as const;
/** Bảng sao lưu của migration (bản sao đầy đủ, có dữ liệu khách) — xoá dòng của tài khoản nếu bảng còn. */
export const BANG_SAO_LUU = [
  "posts_truoc_057", "conversations_truoc_058", "customers_truoc_059", "comments_truoc_059", "auto_scripts_truoc_059",
  "handoff_rules_truoc_060", "send_attempts_truoc_060",
] as const;
/** CỐ Ý GIỮ sau khi xoá tài khoản — sổ TIỀN, phải khớp hoá đơn nhà cung cấp kể cả khi tài khoản không còn. */
export const BANG_GIU: Record<string, string> = {
  kenh_trang_ngay: "migration 041: tiền kênh chia theo ngày ở từng cửa hàng — 'Giữ cả khi kênh/tài khoản đã xoá'",
  ai_usage: "sổ tiền AI — đối chiếu nhà cung cấp tính cả lượt của tài khoản đã xoá (chi-phi.ts: user_id không còn)",
};

/** Xoá mọi dữ liệu của tài khoản trong MỘT giao dịch có sẵn (kịch bản thử tự hoàn tác gọi đúng hàm này). */
export async function xoaDuLieuTaiKhoan(
  c: { query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, ts?: unknown[]) => Promise<{ rows: T[] }> },
  userId: number
): Promise<void> {
  // users TRƯỚC: xoá dây chuyền chạy trigger ghi so_thay_doi (dòng "xoá" của ai_configs, tài liệu…) — xoá sổ SAU
  // mới không còn dòng sinh ra trong lúc xoá.
  await c.query("DELETE FROM users WHERE id = $1", [userId]);
  for (const bang of BANG_XOA_THEM) await c.query(`DELETE FROM ${bang} WHERE user_id = $1`, [userId]);
  for (const bang of BANG_SAO_LUU) {
    const co = await c.query<{ co: boolean }>("SELECT to_regclass($1) IS NOT NULL AS co", [`public.${bang}`]);
    if (co.rows[0]?.co) await c.query(`DELETE FROM ${bang} WHERE user_id = $1`, [userId]);
  }
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
    // Đúng hàm của nút "Khoá tài khoản": chặn đăng nhập + giết mọi phiên + ghi mốc khoá (AI dừng hẳn — mục f).
    await khoaTaiKhoanChung(userId);
  },
  async chotSoKenhNgay() {
    await ghiKenhTheoNgay();
  },
  ngatKenh: (id) => zernio.disconnectAccount(id),
  xoaHoSo: (id) => zernio.xoaHoSo(id),
  async xoaTaiKhoan(userId) {
    await transaction((c) => xoaDuLieuTaiKhoan(c, userId));
  },
  la404: la404NhaCungCap,
};

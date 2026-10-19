/**
 * Chọn KÊNH ĐÍCH để đăng bài — hàm thuần (không gọi database), để bộ kiểm tra thử hành vi bằng dữ liệu giả.
 *
 * Luật (B1-G, duyệt 18/10/2026 cùng phiên kiểm duyệt):
 *  - Bài không có danh sách kênh thì KHÔNG đăng. Bản cũ rơi về "mọi kênh đang nối của cả tài khoản" — một tài khoản
 *    nhiều cửa hàng thì bài của cửa hàng này lên cả Fanpage của cửa hàng khác.
 *  - Lịch tự đăng chỉ đăng vào kênh của ĐÚNG cửa hàng sở hữu lịch đó (kể cả khi lịch có danh sách kênh: kênh đã chuyển
 *    sang cửa hàng khác thì bị loại). Danh sách rỗng = mọi kênh của cửa hàng này, không phải của cả tài khoản.
 */

export type CauLenhKenh = { sql: string; thamSo: unknown[] } | { loi: string };

const COT = "SELECT id, platform FROM social_accounts";
const DANG_NOI = "connected = TRUE AND platform <> 'metaads'";

export const LOI_BAI_KHONG_KENH = "Bài chưa chọn kênh đăng. Vui lòng mở bài, chọn kênh rồi đăng lại.";
export const LOI_LICH_KHONG_CUA_HANG = "Chưa xác định được cửa hàng của lịch tự đăng, nên không đăng.";
/** A1 (19/10/2026): bài có cửa hàng đã xoá (trang_id NULL) — không biết đăng dưới danh nghĩa ai. */
export const LOI_BAI_KHONG_CUA_HANG = "Bài này không còn thuộc cửa hàng nào (cửa hàng đã xoá), nên không đăng.";
/** A1: mọi kênh đã chọn của bài đã chuyển sang cửa hàng khác. */
export const LOI_KENH_DA_CHUYEN =
  "Kênh của bài đã chuyển sang cửa hàng khác, nên bài không đăng lên đó nữa. Vui lòng chọn kênh của cửa hàng này rồi đăng lại.";

/**
 * Kênh đích của một bài: đúng danh sách bài đã chọn, còn nối, thuộc tài khoản VÀ thuộc ĐÚNG cửa hàng của bài (A1 —
 * kênh đã chuyển sang cửa hàng khác thì bị loại: bài của bộ não cũ không được lên kênh của bộ não mới).
 */
export function cauLenhKenhBai(
  userId: number,
  trangCuaBai: number | null | undefined,
  kenhDaChon: string[] | null | undefined
): CauLenhKenh {
  if (!kenhDaChon || kenhDaChon.length === 0) return { loi: LOI_BAI_KHONG_KENH };
  if (trangCuaBai == null) return { loi: LOI_BAI_KHONG_CUA_HANG };
  return {
    sql: `${COT} WHERE user_id = $1 AND trang_id = $2 AND ${DANG_NOI} AND id = ANY($3::text[])`,
    thamSo: [userId, trangCuaBai, kenhDaChon],
  };
}

/** Kênh đích của lịch tự đăng: chỉ kênh của cửa hàng sở hữu lịch. */
export function cauLenhKenhLich(userId: number, trangId: number | null, kenhDaChon: string[]): CauLenhKenh {
  if (trangId == null) return { loi: LOI_LICH_KHONG_CUA_HANG };
  const goc = `${COT} WHERE user_id = $1 AND trang_id = $2 AND ${DANG_NOI}`;
  return kenhDaChon.length
    ? { sql: `${goc} AND id = ANY($3::text[])`, thamSo: [userId, trangId, kenhDaChon] }
    : { sql: goc, thamSo: [userId, trangId] };
}

/**
 * A1 (19/10/2026): bài thuộc MỘT cửa hàng — kênh đích của bài chỉ được là kênh của chính cửa hàng đó. Trả về các kênh
 * NẰM NGOÀI cửa hàng (rỗng = hợp lệ). Dùng chung lúc tạo bài (cửa hàng đang chọn) và lúc sửa kênh (cửa hàng của bài).
 */
export const LOI_KENH_NGOAI_CUA_HANG = "Kênh không thuộc cửa hàng của bài này. Vui lòng chọn lại kênh của đúng cửa hàng.";
/** Lúc TẠO bài: bài sẽ thuộc cửa hàng đang chọn (góp ý phiên kiểm duyệt 19/10 — câu riêng cho đúng nghĩa). */
export const LOI_KENH_NGOAI_CUA_HANG_DANG_CHON = "Kênh không thuộc cửa hàng đang chọn. Vui lòng chọn lại kênh của cửa hàng này.";
export function kenhNgoaiCuaHang(kenhCuaBai: string[], kenhCuaCuaHang: string[]): string[] {
  const co = new Set(kenhCuaCuaHang);
  return [...new Set(kenhCuaBai)].filter((id) => !co.has(id));
}

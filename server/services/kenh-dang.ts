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

/** Kênh đích của một bài: đúng danh sách bài đã chọn, còn nối, thuộc tài khoản. */
export function cauLenhKenhBai(userId: number, kenhDaChon: string[] | null | undefined): CauLenhKenh {
  if (!kenhDaChon || kenhDaChon.length === 0) return { loi: LOI_BAI_KHONG_KENH };
  return {
    sql: `${COT} WHERE user_id = $1 AND ${DANG_NOI} AND id = ANY($2::text[])`,
    thamSo: [userId, kenhDaChon],
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

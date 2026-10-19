/**
 * CHỐT CỬA RA — "kênh là nhân viên, ra đi tay trắng, quay về người không" (chủ dự án chốt 19/10/2026; đợt 1 duyệt cùng
 * phiên kiểm duyệt).
 *
 * MỌI lệnh gửi ra ngoài nhân danh một cửa hàng — tin nhắn, trả lời bình luận, tin riêng, đăng bài, sửa / gỡ bài, đẩy
 * quảng cáo bài — đi qua chanCuaRa ngay trước lời gọi nhà cung cấp, và GỬI BẰNG KÊNH LẤY TỪ KẾT QUẢ (`duoc`), không dùng
 * biến kênh ban đầu. Kênh đã rời cửa hàng của việc thì cửa hàng đó không làm gì được qua kênh ấy nữa. Chỗ nào lọt (chọn
 * việc sai, đồng bộ sai, hàng đợi trễ) cũng không thành hành động sai ra ngoài.
 *
 * ĐỢT 1 — CHƯA AN TOÀN HẲN cho tin / bình luận: hội thoại và bình luận chưa có cột cửa hàng chốt, nên "cửa hàng của việc"
 * tạm lấy theo cửa hàng HIỆN TẠI của kênh (trangTamTheoKenh) → chốt luôn cho qua với tin của hội thoại nhiệm kỳ cũ.
 * Đợt 2 thay bằng conversations.trang_id / comments.trang_id + điều kiện nhiệm kỳ đang mở. Bài (posts.trang_id) thì chặn
 * thật ngay từ đợt 1.
 */
import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";

export const LOI_KENH_DA_ROI =
  "Kênh đã rời cửa hàng này — cửa hàng không còn gửi tin, đăng, sửa hay gỡ được gì qua kênh đó.";

export interface KenhXet {
  id: string;
  trang_id: number | null;
  connected: boolean;
}

/** Hàm thuần: kênh nào được dùng nhân danh cửa hàng `trangCuaViec` (đúng cửa hàng VÀ còn nối). */
export function locKenhGuiDuoc(kenh: KenhXet[], trangCuaViec: number | null): { duoc: string[]; daRoi: string[] } {
  if (trangCuaViec == null) return { duoc: [], daRoi: kenh.map((k) => k.id) };
  const duoc: string[] = [];
  const daRoi: string[] = [];
  for (const k of kenh) {
    if (k.trang_id === trangCuaViec && k.connected) duoc.push(k.id);
    else daRoi.push(k.id);
  }
  return { duoc, daRoi };
}

/**
 * Chốt: đọc kênh rồi lọc. Không còn kênh nào dùng được → ném AppError 409 (LOI_KENH_DA_ROI). Kênh lạ / của tài khoản
 * khác không có trong kết quả đọc → coi như không dùng được.
 */
export async function chanCuaRa(
  userId: number,
  kenhIds: (string | null | undefined)[],
  trangCuaViec: number | null,
  docKenh: (userId: number, ids: string[]) => Promise<KenhXet[]> = docKenhThat
): Promise<{ duoc: string[]; daRoi: string[] }> {
  const ids = [...new Set(kenhIds.filter((x): x is string => typeof x === "string" && x !== ""))];
  const ds = await docKenh(userId, ids);
  const kq = locKenhGuiDuoc(ds, trangCuaViec);
  const coMat = new Set(ds.map((k) => k.id));
  kq.daRoi.push(...ids.filter((id) => !coMat.has(id)));
  if (kq.duoc.length === 0) throw new AppError(LOI_KENH_DA_ROI, 409);
  return kq;
}

async function docKenhThat(userId: number, ids: string[]): Promise<KenhXet[]> {
  const r = await query<KenhXet>(
    "SELECT id, trang_id, connected FROM social_accounts WHERE user_id = $1 AND id = ANY($2::text[])",
    [userId, ids]
  );
  return r.rows;
}

/**
 * ĐỢT 1 TẠM (xem đầu tệp): cửa hàng của tin / bình luận = cửa hàng hiện tại của kênh. Đợt 2 bỏ hàm này, thay bằng cột
 * cửa hàng chốt lúc tạo của hội thoại / bình luận.
 */
export async function trangTamTheoKenh(kenhId: string | null | undefined): Promise<number | null> {
  if (!kenhId) return null;
  const r = await queryOne<{ trang_id: number | null }>("SELECT trang_id FROM social_accounts WHERE id = $1", [kenhId]);
  return r?.trang_id ?? null;
}

/**
 * CHỐT CỬA RA — "kênh là nhân viên, ra đi tay trắng, quay về người không" (chủ dự án chốt 19/10/2026; đợt 1 duyệt cùng
 * phiên kiểm duyệt).
 *
 * MỌI lệnh gửi ra ngoài nhân danh một cửa hàng — tin nhắn, trả lời bình luận, tin riêng, đăng bài, sửa / gỡ bài, đẩy
 * quảng cáo bài — đi qua chanCuaRa ngay trước lời gọi nhà cung cấp, và GỬI BẰNG KÊNH LẤY TỪ KẾT QUẢ (`duoc`), không dùng
 * biến kênh ban đầu. Kênh đã rời cửa hàng của việc thì cửa hàng đó không làm gì được qua kênh ấy nữa. Chỗ nào lọt (chọn
 * việc sai, đồng bộ sai, hàng đợi trễ) cũng không thành hành động sai ra ngoài.
 *
 * Cửa hàng của việc: bài = posts.trang_id; tin = conversations.trang_id + nhiem_ky_id; bình luận = comments.trang_id +
 * nhiem_ky_id (đợt 2a / 2b — nhiệm kỳ kênh). Không còn chỗ nào "tạm theo kênh".
 */
import { query } from "../db.js";
import { AppError } from "../http.js";

export const LOI_KENH_DA_ROI =
  "Kênh đã rời cửa hàng này — cửa hàng không còn gửi tin, đăng, sửa hay gỡ được gì qua kênh đó.";
/** Kênh vẫn thuộc đúng cửa hàng nhưng mất kết nối — việc cần làm là NỐI LẠI (khác hẳn "đã rời"). */
export const LOI_KENH_MAT_KET_NOI = "Kênh đang mất kết nối. Vui lòng vào Kết nối kênh để nối lại rồi thử lại.";

export interface KenhXet {
  id: string;
  trang_id: number | null;
  connected: boolean;
  /** Nhiệm kỳ đang mở của kênh (null: kênh chưa gắn cửa hàng). */
  nhiem_ky_mo?: number | null;
}

/**
 * Hàm thuần: kênh nào được dùng nhân danh cửa hàng `trangCuaViec` (đúng cửa hàng VÀ còn nối). daRoi = không thuộc cửa
 * hàng của việc; matNoi = thuộc đúng cửa hàng nhưng mất kết nối.
 */
export function locKenhGuiDuoc(
  kenh: KenhXet[],
  trangCuaViec: number | null,
  /** Nhiệm kỳ của việc (hội thoại). Có thì kênh phải đang ở ĐÚNG nhiệm kỳ đó — kênh quay về cửa hàng cũ là nhiệm kỳ
   *  MỚI, hội thoại nhiệm kỳ cũ vẫn chỉ xem (quay về người không). undefined: việc không gắn nhiệm kỳ (bài đăng). */
  nhiemKyCuaViec?: number | null
): { duoc: string[]; daRoi: string[]; matNoi: string[] } {
  if (trangCuaViec == null) return { duoc: [], daRoi: kenh.map((k) => k.id), matNoi: [] };
  const duoc: string[] = [];
  const daRoi: string[] = [];
  const matNoi: string[] = [];
  for (const k of kenh) {
    if (k.trang_id !== trangCuaViec) daRoi.push(k.id);
    else if (nhiemKyCuaViec != null && k.nhiem_ky_mo !== nhiemKyCuaViec) daRoi.push(k.id);
    else if (!k.connected) matNoi.push(k.id);
    else duoc.push(k.id);
  }
  return { duoc, daRoi, matNoi };
}

/**
 * Chốt: đọc kênh rồi lọc. Không còn kênh nào dùng được → ném AppError 409 (LOI_KENH_DA_ROI, hoặc LOI_KENH_MAT_KET_NOI
 * khi mọi kênh đúng cửa hàng chỉ mất kết nối). Kênh lạ / của tài khoản khác không có trong kết quả đọc → tính là đã rời.
 */
export async function chanCuaRa(
  userId: number,
  kenhIds: (string | null | undefined)[],
  trangCuaViec: number | null,
  docKenh: (userId: number, ids: string[]) => Promise<KenhXet[]> = docKenhThat,
  nhiemKyCuaViec?: number | null
): Promise<{ duoc: string[]; daRoi: string[]; matNoi: string[] }> {
  const ids = [...new Set(kenhIds.filter((x): x is string => typeof x === "string" && x !== ""))];
  const ds = await docKenh(userId, ids);
  const kq = locKenhGuiDuoc(ds, trangCuaViec, nhiemKyCuaViec);
  const coMat = new Set(ds.map((k) => k.id));
  kq.daRoi.push(...ids.filter((id) => !coMat.has(id)));
  // Không còn kênh dùng được: báo đúng lý do — có kênh đã rời cửa hàng thì ưu tiên câu đó; chỉ mất kết nối thì bảo nối lại.
  if (kq.duoc.length === 0) throw new AppError(kq.daRoi.length > 0 ? LOI_KENH_DA_ROI : LOI_KENH_MAT_KET_NOI, 409);
  return kq;
}

async function docKenhThat(userId: number, ids: string[]): Promise<KenhXet[]> {
  const r = await query<KenhXet>(
    `SELECT s.id, s.trang_id, s.connected,
            (SELECT k.id FROM kenh_nhiem_ky k WHERE k.account_id = s.id AND k.den_luc IS NULL) AS nhiem_ky_mo
       FROM social_accounts s WHERE s.user_id = $1 AND s.id = ANY($2::text[])`,
    [userId, ids]
  );
  return r.rows;
}

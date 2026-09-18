import { query, queryOne } from "../db.js";

/**
 * Suy ra Trang từ một kênh.
 *
 * Đây là đường DUY NHẤT để biết "đang làm việc với Trang nào" trong các luồng
 * xử lý tự động. Hội thoại, bình luận và bài đăng đều đã mang social_account_id
 * nên không cần thêm khái niệm nào cho người dùng phải học.
 *
 * Trả null khi kênh chưa gắn Trang — chỗ gọi phải tự quyết định làm gì, không
 * được đoán bừa sang Trang khác. Đoán sai Trang nghĩa là AI dùng bảng giá của
 * shop khác để nói chuyện với khách.
 */
export async function layTrangTuKenh(accountId: string): Promise<number | null> {
  const r = await queryOne<{ trang_id: number | null }>(
    "SELECT trang_id FROM social_accounts WHERE id = $1",
    [accountId]
  );
  return r?.trang_id ?? null;
}

/**
 * Trang đầu tiên của một tài khoản.
 *
 * Dùng cho các đường CHƯA biết kênh: trang cài đặt khi chủ shop chưa chọn
 * Trang nào, hoặc tài khoản mới chỉ có đúng một Trang.
 */
export async function layTrangMacDinh(userId: number): Promise<number | null> {
  const r = await queryOne<{ id: number }>(
    "SELECT id FROM trang WHERE user_id = $1 ORDER BY id LIMIT 1",
    [userId]
  );
  return r?.id ?? null;
}

/**
 * Trang đang được chọn trên giao diện, suy từ kênh mà giao diện gửi lên.
 *
 * Giao diện đã có sẵn bộ chọn kênh (ActivePage), nên chỉ cần gửi kèm
 * accountId. Không gửi thì dùng Trang đầu tiên — đúng cho tài khoản một Trang,
 * là phần lớn trường hợp.
 *
 * KHÔNG nhận trangId thẳng từ giao diện: làm vậy là để người ngoài tự khai
 * mình thuộc Trang nào. Suy từ kênh thì còn kiểm được kênh có thuộc tài khoản
 * đang đăng nhập hay không.
 */
export async function layTrangDangChon(
  userId: number,
  accountId?: string | null
): Promise<number | null> {
  if (accountId) {
    const r = await queryOne<{ trang_id: number | null }>(
      "SELECT trang_id FROM social_accounts WHERE id = $1 AND user_id = $2",
      [accountId, userId]
    );
    if (r?.trang_id) return r.trang_id;
  }
  return layTrangMacDinh(userId);
}

/** Mọi Trang của một tài khoản, cũ nhất trước. */
export async function layDanhSachTrang(
  userId: number
): Promise<Array<{ id: number; ten: string; profile_ref: string; page_id: string | null }>> {
  const r = await query<{ id: number; ten: string; profile_ref: string; page_id: string | null }>(
    "SELECT id, ten, profile_ref, page_id FROM trang WHERE user_id = $1 ORDER BY id",
    [userId]
  );
  return r.rows;
}

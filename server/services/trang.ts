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
  /*
   * Ưu tiên Trang CÒN KÊNH ĐANG NỐI, rồi mới tới Trang cũ nhất.
   *
   * Đổi Fanpage thì Trang của Fanpage cũ ở lại, không còn kênh nào — cố ý giữ
   * để đổi về là bộ não còn nguyên. Nhưng Trang mồ côi ấy vẫn nằm trong bảng,
   * và nếu nó tình cờ có id nhỏ hơn thì cách chọn "cũ nhất" sẽ trả về đúng nó:
   * chủ shop mở màn hình huấn luyện khi chưa chọn kênh nào sẽ ngồi dạy một
   * Trang đã chết, còn Trang đang bán hàng thì không ai dạy. Không một dòng
   * báo lỗi nào.
   *
   * Đã thấy Trang mồ côi thật trong dữ liệu sau các lần thử đổi Fanpage.
   */
  const r = await queryOne<{ id: number }>(
    `SELECT t.id
       FROM trang t
       LEFT JOIN social_accounts s ON s.trang_id = t.id AND s.connected
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY (count(s.id) = 0), t.id
      LIMIT 1`,
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

/**
 * Tìm Trang theo hồ sơ Zernio, chưa có thì tạo.
 *
 * Một hồ sơ Zernio gom toàn bộ kênh của cùng một shop: Fanpage, Instagram,
 * TikTok đứng chung một hồ sơ và dùng chung một bộ não — đó là cùng một cửa
 * hàng bán cùng một mặt hàng.
 *
 * NHƯNG hồ sơ KHÔNG phải là Fanpage. Đo thật trên API Zernio: một kênh
 * facebook gắn Fanpage nào nằm ở metadata.selectedPageId, và đổi Fanpage bằng
 * PUT /accounts/{id}/facebook-page thì profileId KHÔNG đổi theo. Khoá Trang
 * theo hồ sơ như bản trước nghĩa là đổi sang Fanpage khác vẫn giữ nguyên
 * trang_id — Fanpage mới thừa kế cả vai trò, kịch bản và bảng giá của Fanpage
 * cũ. Vì vậy Trang phải khoá theo cặp (hồ sơ, Fanpage đang gắn).
 *
 * Vì sao phải có hàm này: trước đây chỉ lúc mở tài khoản mới sinh Trang. Kênh
 * nối về sau có trang_id rỗng, và chỗ đọc bộ não sẽ rơi về Trang đầu tiên —
 * shop thêm Fanpage thứ hai là AI đem bảng giá của Fanpage thứ nhất đi bán,
 * không một dòng báo lỗi nào.
 *
 * Trả null nếu hồ sơ đó đã thuộc tài khoản khác. Không bao giờ nối kênh vào
 * Trang của người khác, kể cả khi dữ liệu bên Zernio có gì đó bất thường.
 */
export async function baoDamTrangChoHoSo(
  userId: number,
  profileRef: string,
  tenGoiY: string,
  pageId: string | null
): Promise<number | null> {
  if (!profileRef) return null;

  /*
   * Kênh không có khái niệm Fanpage (Instagram, TikTok) thì nhập vào Trang
   * sẵn có đầu tiên của hồ sơ, không đẻ Trang riêng.
   *
   * Cùng một shop bán cùng một mặt hàng trên nhiều nền tảng thì dùng chung
   * một bộ não là đúng — đã thấy trên tài khoản thật: hồ sơ "hoangtuan" gồm
   * Fanpage, Instagram và TikTok của đúng một cửa hàng.
   */
  if (!pageId) {
    const sanCo = await queryOne<{ id: number }>(
      "SELECT id FROM trang WHERE user_id = $1 AND profile_ref = $2 ORDER BY id LIMIT 1",
      [userId, profileRef]
    );
    if (sanCo) return sanCo.id;
  }

  const r = await queryOne<{ id: number; user_id: number }>(
    `INSERT INTO trang (user_id, profile_ref, ten, page_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (profile_ref, COALESCE(page_id, '')) DO UPDATE SET
       -- Tên chủ shop tự đặt thì giữ nguyên; chỉ điền đè lên tên tạm.
       ten = CASE
               WHEN trang.ten IN ('Trang đầu tiên', 'Trang chưa đặt tên')
                 THEN EXCLUDED.ten
               ELSE trang.ten
             END,
       updated_at = now()
     RETURNING id, user_id`,
    [userId, profileRef, tenGoiY || "Trang chưa đặt tên", pageId]
  );
  if (!r) return null;
  return r.user_id === userId ? r.id : null;
}

/** Nối một kênh vào Trang của nó. Không đụng tới kênh của tài khoản khác. */
export async function ganKenhVaoTrang(
  accountId: string,
  userId: number,
  trangId: number
): Promise<void> {
  await query(
    "UPDATE social_accounts SET trang_id = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
    [trangId, accountId, userId]
  );
}

/*
 * Một tài khoản có thể dùng NHIỀU hồ sơ Zernio: hồ sơ mặc định (users.profile_ref) và hồ sơ riêng của từng Trang.
 *
 * Vì sao: Zernio quy ước mỗi thương hiệu một hồ sơ và tính tiền theo từng kênh trong đó; chủ dự án 04/10/2026 chốt
 * "1 trang = 1 hồ sơ" để số tiền từng trang khớp tuyệt đối với Zernio. Trước đó mọi chỗ chỉ hỏi hồ sơ mặc định —
 * chuyển một Fanpage sang hồ sơ riêng là lượt đồng bộ sau tưởng Fanpage bị gỡ, đánh dấu mất kết nối, AI ngừng trả
 * lời khách. Đồng bộ, webhook và chặn nhận hồ sơ của người khác đều phải đi qua hai hàm này.
 */

/** Mọi hồ sơ Zernio thật của một tài khoản (bỏ mã tạm "cho-cap-…"). */
export async function hoSoCuaTaiKhoan(userId: number): Promise<string[]> {
  const r = await query<{ ma: string }>(
    `SELECT profile_ref AS ma FROM users WHERE id = $1 AND profile_ref IS NOT NULL
     UNION
     SELECT profile_ref FROM trang WHERE user_id = $1 AND profile_ref NOT LIKE 'cho-cap-%'`,
    [userId]
  );
  return r.rows.map((x) => x.ma);
}

/** Tài khoản đang giữ một hồ sơ (qua hồ sơ mặc định hoặc qua một Trang). null = chưa ai giữ. */
export async function chuCuaHoSo(profileRef: string): Promise<number | null> {
  const r = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE profile_ref = $1
     UNION
     SELECT user_id FROM trang WHERE profile_ref = $1
     LIMIT 1`,
    [profileRef]
  );
  return r?.id ?? null;
}

/**
 * Sổ "kênh thuộc trang nào" theo NGÀY UTC (bảng kenh_trang_ngay) — chủ dự án duyệt 05/10/2026.
 *
 * Nhà cung cấp kênh tính tiền theo ngày-kênh (mỗi ngày một kênh đang nối = 1/30 đơn vị). Kênh Facebook đổi Fanpage
 * giữa tháng vẫn là MỘT kênh với họ, nên tiền cả tháng của kênh phải chia theo số ngày kênh ở từng trang. Ghi trạng
 * thái ĐẦU TIÊN thấy được trong ngày (ON CONFLICT DO NOTHING); gọi thêm ngay trước khi đổi Fanpage để ngày đổi vẫn
 * giữ trang cũ, ngày hôm sau mới sang trang mới. Gọi lại nhiều lần trong ngày không sao.
 */
export async function ghiKenhTheoNgay(): Promise<number> {
  const r = await query(
    `INSERT INTO kenh_trang_ngay (ngay, account_id, user_id, trang_id, dang_noi)
     SELECT (now() AT TIME ZONE 'UTC')::date, id, user_id, trang_id, connected FROM social_accounts
     ON CONFLICT (ngay, account_id) DO NOTHING`
  );
  return r.rowCount ?? 0;
}

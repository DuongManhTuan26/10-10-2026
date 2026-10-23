import type pg from "pg";
import { query, queryOne, transaction } from "../db.js";
import { AppError } from "../http.js";
import { donLichKenhDaRoi } from "./don-lich.js";
import { doiNhiemKy, dongNhiemKy } from "./nhiem-ky.js";

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

export const LOI_CHUA_CHON_CUA_HANG =
  "Chưa rõ đang làm việc ở cửa hàng nào. Vui lòng tải lại trang và chọn cửa hàng rồi thử lại.";

/**
 * CỬA HÀNG CỦA MỘT YÊU CẦU — chỗ DUY NHẤT suy cửa hàng từ màn hình (A4a, 22/10/2026; phiên kiểm duyệt duyệt).
 *
 * Màn hình gửi MÃ CỬA HÀNG qua đầu X-Cua-Hang (không còn suy qua kênh — kênh chỉ là bộ lọc). Mã phải thuộc đúng người
 * đăng nhập; mã lạ / của người khác (vd. admin "Mở tài khoản" còn giữ mã cửa hàng của admin) coi như không gửi.
 *  - Có mã hợp lệ → cửa hàng đó.
 *  - Không có: yêu cầu GHI ở tài khoản từ 2 cửa hàng → 409 (không lặng lẽ ghi vào cửa hàng mặc định — tab cũ có thể ghi
 *    nhầm); yêu cầu ĐỌC → cửa hàng mặc định + cảnh báo trong log (để thấy chỗ nào chưa gửi).
 */
export async function cuaHangCuaYeuCau(
  userId: number,
  p: { maCuaHang: string | undefined; ghi: boolean; duong: string }
): Promise<number | null> {
  const ma = Number(p.maCuaHang);
  if (p.maCuaHang && Number.isInteger(ma) && ma > 0) {
    const r = await queryOne<{ id: number }>("SELECT id FROM trang WHERE id = $1 AND user_id = $2", [ma, userId]);
    if (r) return r.id;
  }
  const so = (await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM trang WHERE user_id = $1", [userId]))?.n ?? 0;
  if (p.ghi && so >= 2) throw new AppError(LOI_CHUA_CHON_CUA_HANG, 409);
  // ĐỌC thiếu mã ở tài khoản ≥ 2 cửa hàng là trạng thái HỢP LỆ (đang ở khung chọn cửa hàng, thanh trên vẫn gọi số đếm) —
  // không cảnh báo. Tài khoản 1 cửa hàng mà vẫn thiếu mã mới là chỗ chưa gửi (phiên kiểm duyệt đồng ý 22/10).
  if (so === 1) console.warn(`[cửa hàng] ${p.duong} không gửi mã cửa hàng hợp lệ — dùng cửa hàng mặc định`);
  return layTrangMacDinh(userId);
}

/**
 * KÊNH QUẢNG CÁO (Meta Ads) của MỘT cửa hàng — A4b (22/10/2026; sơ đồ: "Tài khoản quảng cáo + phân tích quảng cáo theo
 * cửa hàng", bản cũ lấy kênh quảng cáo ĐẦU TIÊN của cả tài khoản). Kênh metaads thuộc cửa hàng của hồ sơ nó được nối vào
 * (đồng bộ gắn trang_id như mọi kênh). Cửa hàng chưa nối quảng cáo → null ("chưa nối quảng cáo cho cửa hàng này").
 * MỌI chỗ chọn kênh quảng cáo đi qua hàm này (bộ kiểm tra đếm).
 */
export async function kenhQuangCaoCuaCuaHang(
  userId: number,
  trangId: number | null
): Promise<{ id: string; ad_account_ref: string | null; profile_ref: string | null; trang_id: number } | null> {
  if (trangId == null) return null;
  return queryOne(
    `SELECT id, ad_account_ref, profile_ref, trang_id FROM social_accounts
      WHERE user_id = $1 AND trang_id = $2 AND platform = 'metaads' AND connected = TRUE
      ORDER BY created_at LIMIT 1`,
    [userId, trangId]
  );
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
   * MỘT HỒ SƠ = MỘT CỬA HÀNG (chủ dự án chốt 17/10/2026). Hồ sơ của nhà cung cấp là "một cái hộp": mỗi nền tảng một
   * ngăn (1 Fanpage, 1 TikTok, 1 YouTube…) + một bộ não. Kênh nào nằm trong hồ sơ nào thì thuộc ĐÚNG cửa hàng của hồ sơ
   * đó — kể cả Facebook. Bỏ khoá cũ "(hồ sơ, Fanpage)" (05/10): nó đẻ thêm cửa hàng mỗi lần đổi Fanpage → một hộp bị
   * chia làm hai cửa hàng (chủ dự án bắt được 17/10). Nút "Đổi Fanpage" đã bỏ: muốn dùng Fanpage khác thì ngắt Fanpage
   * cũ rồi nối Fanpage mới, hoặc nối nó vào cửa hàng khác — nên không còn chuyện Fanpage mới thừa kế nhầm bảng giá.
   * Hồ sơ đã có cửa hàng của NGƯỜI KHÁC → null (không bao giờ nối kênh vào cửa hàng người khác).
   */
  const sanCo = await queryOne<{ id: number; user_id: number }>(
    "SELECT id, user_id FROM trang WHERE profile_ref = $1 ORDER BY id LIMIT 1",
    [profileRef]
  );
  if (sanCo) return sanCo.user_id === userId ? sanCo.id : null;

  const r = await queryOne<{ id: number; user_id: number }>(
    `INSERT INTO trang (user_id, profile_ref, ten, page_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (profile_ref, COALESCE(page_id, '')) DO UPDATE SET
       -- Tên chủ shop tự đặt thì giữ nguyên; chỉ điền đè lên tên tạm.
       ten = CASE
               WHEN trang.ten IN ('Trang đầu tiên', 'Trang chưa đặt tên', 'Cửa hàng đầu tiên', 'Cửa hàng chưa đặt tên')
                 THEN EXCLUDED.ten
               ELSE trang.ten
             END,
       updated_at = now()
     RETURNING id, user_id`,
    [userId, profileRef, tenGoiY || "Cửa hàng chưa đặt tên", pageId]
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
  /*
   * Chỗ DUY NHẤT ghi social_accounts.trang_id. Cùng một giao dịch: đổi cửa hàng của kênh + đóng nhiệm kỳ cũ / mở nhiệm
   * kỳ mới + tắt kịch bản của cửa hàng cũ (services/nhiem-ky.ts — "kênh là nhân viên, ra đi tay trắng, quay về người
   * không", chủ dự án chốt 19/10/2026).
   */
  const daRoiTrang = await transaction((k) => ganKenhVaoTrangTrong(k, accountId, userId, trangId));
  // SAU giao dịch (không gọi nhà cung cấp trong giao dịch): kênh vừa rời cửa hàng cũ → gỡ lịch bài hẹn giờ của cửa hàng
  // cũ trên kênh này (services/don-lich.ts). Lỗi không chặn việc chuyển kênh — lượt đồng bộ sau làm lại.
  if (daRoiTrang != null) {
    await donLichKenhDaRoi(userId).catch((e) => console.error("[gỡ lịch] Lỗi, sẽ thử lại ở lượt đồng bộ sau:", e));
  }
}

/**
 * Thân của ganKenhVaoTrang, chạy trên giao dịch có sẵn (phép thử tự hoàn tác gọi thẳng — không COMMIT riêng). Trả về
 * cửa hàng kênh vừa RỜI (null nếu không đổi / kênh chưa từng thuộc cửa hàng nào).
 */
export async function ganKenhVaoTrangTrong(
  k: Pick<pg.PoolClient, "query">,
  accountId: string,
  userId: number,
  trangId: number
): Promise<number | null> {
  const r = await k.query(
    "UPDATE social_accounts SET trang_id = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
    [trangId, accountId, userId]
  );
  if (!r.rowCount) return null;
  const doi = await doiNhiemKy(k, { accountId, userId, trangMoi: trangId });
  // Kênh RỜI cửa hàng cũ → kịch bản bình luận của cửa hàng cũ gắn trên kênh này TẮT (cùng giao dịch); kênh quay về thì
  // chủ shop tự bật lại (chủ dự án chốt 19/10/2026 — "quay về người không").
  if (doi.daDong?.trang_id != null) await tatKichBanKenhRoi(k, accountId, doi.daDong.trang_id, "Kênh đã rời cửa hàng");
  return doi.daDong?.trang_id ?? null;
}

/** Tắt kịch bản bình luận của một cửa hàng trên kênh vừa rời / vừa gỡ — dùng chung cho chuyển kênh và gỡ kênh. */
async function tatKichBanKenhRoi(k: Pick<pg.PoolClient, "query">, accountId: string, trangId: number, viec: string): Promise<void> {
  await k.query(
    `UPDATE auto_scripts SET is_active = FALSE, tat_ly_do = $3, updated_at = now()
      WHERE social_account_id = $1 AND trang_id = $2 AND is_active`,
    [accountId, trangId, `${viec} lúc ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`]
  );
}

/**
 * CHỦ SHOP GỠ KÊNH = NHÂN VIÊN NGHỈ VIỆC (064; phiên kiểm duyệt duyệt 23/10/2026). CHỈ đường chủ shop bấm "Ngắt kết nối"
 * trong app — kênh thiếu trong danh sách nhà cung cấp / webhook account.disconnected là "nghỉ ốm" (giữ nhiệm kỳ): không
 * đáng tin là ý định (đã từng đánh dấu nhầm khi kênh đổi hồ sơ). Cùng một giao dịch: đánh dấu đã gỡ (GIỮ trang_id làm
 * lịch sử) + đóng nhiệm kỳ (hội thoại cũ thành chỉ xem qua LY_DO_CHI_XEM, chốt cửa ra chặn gửi) + tắt kịch bản.
 * Trả về cửa hàng kênh vừa rời (null nếu kênh chưa thuộc cửa hàng nào / không có nhiệm kỳ mở).
 */
export async function goKenhTrong(k: Pick<pg.PoolClient, "query">, accountId: string, userId: number): Promise<number | null> {
  const r = await k.query(
    `UPDATE social_accounts SET connected = FALSE, needs_reconnection = FALSE, go_luc = now(), updated_at = now()
      WHERE id = $1 AND user_id = $2`,
    [accountId, userId]
  );
  if (!r.rowCount) return null;
  const daDong = await dongNhiemKy(k, accountId);
  if (daDong?.trang_id != null) await tatKichBanKenhRoi(k, accountId, daDong.trang_id, "Kênh đã ngắt kết nối");
  return daDong?.trang_id ?? null;
}

/** Gọi SAU khi nhà cung cấp đã gỡ kênh. Gỡ lịch bài hẹn giờ trên kênh SAU giao dịch (không gọi HTTP trong giao dịch). */
export async function goKenh(accountId: string, userId: number): Promise<void> {
  await transaction((k) => goKenhTrong(k, accountId, userId));
  await donLichKenhDaRoi(userId).catch((e) => console.error("[gỡ lịch] Lỗi, sẽ thử lại ở lượt đồng bộ sau:", e));
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
     SELECT profile_ref FROM trang WHERE user_id = $1 AND profile_ref NOT LIKE 'cho-cap-%'
     -- Hồ sơ đang CHỨA kênh của mình (17/10/2026): kênh chuyển trang chỉ đổi trong app, vẫn ở hồ sơ cũ — xoá trang chủ
     -- của hồ sơ đó mà bỏ hồ sơ khỏi danh sách thì lượt đồng bộ sau đánh dấu nhầm các kênh ấy là mất kết nối.
     UNION
     SELECT DISTINCT profile_ref FROM social_accounts WHERE user_id = $1 AND profile_ref IS NOT NULL AND profile_ref NOT LIKE 'cho-cap-%'`,
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
     UNION
     SELECT user_id FROM social_accounts WHERE profile_ref = $1
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

/**
 * Kênh chuyển được sang những cửa hàng nào (chủ dự án chốt 17/10/2026 — mỗi cửa hàng một hộp, mỗi nền tảng một ngăn).
 * Mọi kênh (kể cả Facebook) sang được MỌI cửa hàng khác của chính tài khoản; cửa hàng đã có cùng nền tảng thì đánh dấu
 * da_co — không cho chuyển (nhà cung cấp chỉ một tài khoản mỗi nền tảng mỗi hồ sơ, chuyển vào là thay tài khoản cũ,
 * xoá hội thoại). Tài khoản quảng cáo dùng chung, không chuyển.
 */
export async function trangChuyenDuoc(
  userId: number,
  accountId: string
): Promise<{
  kenh: { id: string; platform: string; profile_ref: string; trang_id: number | null } | null;
  ds: Array<{ id: number; ten: string; profile_ref: string; da_co: boolean }>;
}> {
  const kenh = await queryOne<{ id: string; platform: string; profile_ref: string; trang_id: number | null }>(
    "SELECT id, platform, profile_ref, trang_id FROM social_accounts WHERE id = $1 AND user_id = $2",
    [accountId, userId]
  );
  if (!kenh || kenh.platform === "metaads") return { kenh, ds: [] };
  const r = await query<{ id: number; ten: string; profile_ref: string; da_co: boolean }>(
    `SELECT t.id, t.ten, t.profile_ref,
            EXISTS (SELECT 1 FROM social_accounts s WHERE s.user_id = $1 AND s.profile_ref = t.profile_ref
                       AND s.platform = $3 AND s.connected) AS da_co
       FROM trang t
      WHERE t.user_id = $1 AND t.id IS DISTINCT FROM $2 AND t.profile_ref NOT LIKE 'cho-cap-%'
        -- chỉ cửa hàng có hộp riêng (cửa hàng cũ dùng chung hộp: kênh chuyển vào sẽ rơi sang cửa hàng kia)
        AND t.id = (SELECT min(t2.id) FROM trang t2 WHERE t2.profile_ref = t.profile_ref)
      ORDER BY t.id`,
    [userId, kenh.trang_id, kenh.platform]
  );
  return { kenh, ds: r.rows };
}

/**
 * HẬU QUẢ chuyển kênh sang cửa hàng khác (đợt 3) — để hộp xác nhận nói trước cho chủ shop. Chỉ đọc. Kênh chưa thuộc cửa
 * hàng nào → mọi số = 0 (không có gì của cửa hàng cũ để mất).
 */
export async function hauQuaChuyenKenh(
  userId: number,
  accountId: string,
  db: Pick<pg.PoolClient, "query"> = { query: ((sql: string, ts?: unknown[]) => query(sql, ts)) as never }
): Promise<{ baiHenGio: number; baiChuaDang: number; kichBanSeTat: number; hoiThoaiOLai: number }> {
  const kq = await db.query<{ bai_hen_gio: number; bai_chua_dang: number; kich_ban_se_tat: number; hoi_thoai_o_lai: number }>(
    `SELECT
       (SELECT count(*) FROM posts p WHERE p.user_id = $1 AND p.trang_id = s.trang_id AND s.id = ANY(p.target_account_ids)
           AND p.status = 'scheduled')::int AS bai_hen_gio,
       (SELECT count(*) FROM posts p WHERE p.user_id = $1 AND p.trang_id = s.trang_id AND s.id = ANY(p.target_account_ids)
           AND p.status IN ('draft', 'pending_approval', 'failed'))::int AS bai_chua_dang,
       (SELECT count(*) FROM auto_scripts a WHERE a.social_account_id = s.id AND a.trang_id = s.trang_id
           AND a.is_active)::int AS kich_ban_se_tat,
       (SELECT count(*) FROM conversations c JOIN kenh_nhiem_ky nk ON nk.id = c.nhiem_ky_id
         WHERE nk.account_id = s.id AND nk.den_luc IS NULL)::int AS hoi_thoai_o_lai
       FROM social_accounts s
      WHERE s.id = $2 AND s.user_id = $1 AND s.trang_id IS NOT NULL`,
    [userId, accountId]
  );
  const r = kq.rows[0];
  return {
    baiHenGio: r?.bai_hen_gio ?? 0,
    baiChuaDang: r?.bai_chua_dang ?? 0,
    kichBanSeTat: r?.kich_ban_se_tat ?? 0,
    hoiThoaiOLai: r?.hoi_thoai_o_lai ?? 0,
  };
}

/**
 * Cửa hàng của tài khoản, kèm số kênh và các nền tảng đã có (ngăn đã đầy) — kể cả cửa hàng CHƯA CÓ KÊNH.
 * Bộ chọn bộ não (ActivePage) dựng từ danh sách kênh nên không thấy cửa hàng rỗng; màn Kết nối kênh cần thấy để đặt tên,
 * xoá, nối kênh vào, và tô ô "đã có" đúng theo từng cửa hàng.
 */
export async function trangCuaTaiKhoan(
  userId: number
): Promise<Array<{ id: number; ten: string; so_kenh: number; nen_tang: string[]; hop_rieng: boolean }>> {
  /*
   * hop_rieng: cửa hàng có HỘP (hồ sơ) của riêng nó — là cửa hàng cũ nhất của hồ sơ đó và hồ sơ đã thật. Cửa hàng sinh
   * ra theo cách cũ (đổi Fanpage, trước 17/10/2026) dùng chung hộp với cửa hàng khác: kênh nối vào sẽ rơi sang cửa hàng
   * kia → không cho nhận kênh, nhắc xoá. Nền tảng "đã có" tính theo hộp; cửa hàng dùng chung hộp thì theo kênh thật của nó.
   */
  const r = await query<{ id: number; ten: string; so_kenh: number; nen_tang: string[]; hop_rieng: boolean }>(
    `SELECT x.id, x.ten, x.so_kenh, x.hop_rieng,
            CASE WHEN x.hop_rieng
                 THEN COALESCE((SELECT array_agg(DISTINCT s.platform) FROM social_accounts s
                                 WHERE s.user_id = $1 AND s.profile_ref = x.profile_ref AND s.connected), '{}')
                 ELSE COALESCE((SELECT array_agg(DISTINCT s.platform) FROM social_accounts s
                                 WHERE s.trang_id = x.id AND s.connected), '{}') END AS nen_tang
       FROM (SELECT t.id, t.ten, t.profile_ref,
                    (SELECT count(*)::int FROM social_accounts s
                      WHERE s.trang_id = t.id AND s.platform <> 'metaads' AND s.connected) AS so_kenh,
                    (t.profile_ref NOT LIKE 'cho-cap-%'
                      AND t.id = (SELECT min(t2.id) FROM trang t2 WHERE t2.profile_ref = t.profile_ref)) AS hop_rieng
               FROM trang t WHERE t.user_id = $1) x
      ORDER BY x.id`,
    [userId]
  );
  return r.rows;
}

/**
 * Tạo CỬA HÀNG MỚI theo tên chủ shop gõ = tạo MỘT HỒ SƠ MỚI bên nhà cung cấp (chủ dự án chốt 17/10/2026: mỗi cửa hàng
 * một hồ sơ). Tài liệu nhà cung cấp: "There are no profile limits" — không tốn thêm tiền. Bộ não của cửa hàng mới: cấu
 * hình 4 AI ghi khi chủ shop lưu lần đầu.
 */
export async function taoTrangMoi(
  userId: number,
  ten: string,
  tenTaiKhoan: string,
  taoHoSo: (tenHoSo: string) => Promise<{ _id: string }>
): Promise<number> {
  const hoSo = await taoHoSo(`${tenTaiKhoan} · ${ten}`);
  const r = await queryOne<{ id: number }>(
    "INSERT INTO trang (user_id, profile_ref, ten, page_id) VALUES ($1, $2, $3, NULL) RETURNING id",
    [userId, hoSo._id, ten]
  );
  return r!.id;
}

/**
 * Nối kênh vào cửa hàng: kênh vào ĐÚNG hộp (hồ sơ) của cửa hàng. Ngăn của nền tảng đó đã có tài khoản đang nối thì
 * chặn, nói rõ cách làm (tạo cửa hàng mới) — KHÔNG lén nối sang hộp khác (bản sáng 17/10 làm vậy, chủ dự án bác: một hộp
 * phải đúng một cửa hàng). Nhà cung cấp chỉ một tài khoản mỗi nền tảng mỗi hồ sơ; nối thêm là thay tài khoản cũ.
 */
export async function hoSoCuaCuaHang(
  userId: number,
  trangId: number,
  platform: string,
  tenNenTang: string
): Promise<{ profile_ref: string; ten: string }> {
  const t = await queryOne<{ profile_ref: string; ten: string; da_co: boolean; hop_rieng: boolean }>(
    `SELECT t.profile_ref, t.ten,
            EXISTS (SELECT 1 FROM social_accounts s WHERE s.user_id = $1 AND s.profile_ref = t.profile_ref
                       AND s.platform = $3 AND s.connected) AS da_co,
            t.id = (SELECT min(t2.id) FROM trang t2 WHERE t2.profile_ref = t.profile_ref) AS hop_rieng
       FROM trang t WHERE t.id = $2 AND t.user_id = $1`,
    [userId, trangId, platform]
  );
  if (!t) throw new AppError("Không tìm thấy cửa hàng này", 404);
  if (!t.hop_rieng) {
    throw new AppError(
      `Cửa hàng "${t.ten}" còn sót từ cách làm cũ, dùng chung hộp với cửa hàng khác — kênh nối vào sẽ rơi sang cửa hàng kia. Vui lòng xoá cửa hàng này và tạo cửa hàng mới.`,
      409
    );
  }
  if (t.profile_ref.startsWith("cho-cap-")) {
    throw new AppError("Cửa hàng chưa sẵn sàng — tải lại trang rồi thử lại.", 409);
  }
  if (t.da_co) {
    throw new AppError(
      `Cửa hàng "${t.ten}" đã có ${tenNenTang}. Mỗi cửa hàng chỉ có một ${tenNenTang} — tạo cửa hàng mới để nối ${tenNenTang} thứ hai.`,
      409
    );
  }
  return { profile_ref: t.profile_ref, ten: t.ten };
}

/**
 * Chốt chặn về hình dạng tài khoản. KHÔNG đặt hạn mức thương mại ở đây.
 *
 * Luật của chủ sản phẩm: KHÔNG tự đặt giới hạn của mình, cứ theo nhà cung cấp
 * — khi nào họ báo hết hạn mức thì mình báo hết hạn mức. Đo ngày 19/09/2026:
 * /usage trả limits.profiles = -1, tức là họ không giới hạn số hồ sơ, nên mình
 * cũng không giới hạn số trang.
 *
 * Tôi đã từng tự đặt số trang cho mỗi gói ở đây và tự đổi gói dùng thử từ
 * không giới hạn thành 1 trang. Đó là quyết định thương mại, không phải quyết
 * định kỹ thuật, và không ai cho phép tôi làm. Đã gỡ.
 *
 * Việc còn lại là có thật và chưa làm: nếu sau này nhà cung cấp bắt đầu chặn,
 * phải chuyển nguyên lời từ chối của họ ra cho chủ shop thấy, chứ không nuốt
 * lỗi rồi im lặng.
 */

import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";

/**
 * Chặn nối Fanpage thứ hai vào cùng một CỬA HÀNG (chủ dự án chốt 17/10/2026: mỗi cửa hàng = một hộp, mỗi nền tảng một
 * ngăn — 1 Fanpage, 1 TikTok… Muốn Fanpage thứ hai thì tạo cửa hàng thứ hai). Thay luật cũ "mỗi TÀI KHOẢN một Fanpage".
 * Chặn TRƯỚC khi gọi nhà cung cấp: gọi rồi mới chặn thì kênh đã được tạo bên họ, vẫn bị tính tiền và phải đi dọn.
 * Đếm theo Fanpage khác nhau đang nối: nối lại đúng Fanpage cũ vẫn cho qua.
 */
export async function chanNeuThemFanpage(
  userId: number,
  profileId: string,
  fanpageMoi: string[]
): Promise<void> {
  const rows = await query<{ page_id: string }>(
    `SELECT DISTINCT page_id FROM social_accounts
      WHERE user_id = $1 AND profile_ref = $2 AND platform = 'facebook' AND page_id IS NOT NULL AND connected`,
    [userId, profileId]
  );
  /*
   * Fanpage đang chạy ở cửa hàng KHÁC thì không nối thêm lần nữa — một Fanpage hai kết nối là hai bộ não cùng trả lời
   * một khách. Muốn chuyển Fanpage sang cửa hàng này thì ngắt ở cửa hàng kia trước (hoặc chuyển kênh).
   */
  const oCuaHangKhac = await queryOne<{ ten: string | null }>(
    `SELECT t.ten FROM social_accounts s LEFT JOIN trang t ON t.id = s.trang_id
      WHERE s.user_id = $1 AND s.platform = 'facebook' AND s.connected AND s.page_id = ANY($2::text[])
        AND s.profile_ref <> $3
      LIMIT 1`,
    [userId, fanpageMoi, profileId]
  );
  if (oCuaHangKhac) {
    throw new AppError(
      `Fanpage này đang chạy ở cửa hàng "${oCuaHangKhac.ten ?? "khác"}". Vui lòng ngắt kết nối ở cửa hàng đó trước, hoặc dùng "Chuyển sang cửa hàng khác".`,
      409
    );
  }
  const dangCo = new Set(rows.rows.map((r) => r.page_id));
  for (const ma of fanpageMoi) dangCo.add(ma);
  if (dangCo.size > 1) {
    throw new AppError(
      "Mỗi cửa hàng chỉ có một Fanpage. Muốn chạy thêm Fanpage, vui lòng tạo cửa hàng mới rồi nối Fanpage đó vào cửa hàng mới.",
      409
    );
  }
}

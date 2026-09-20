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
 * Chặn nối Fanpage thứ hai vào cùng một tài khoản.
 *
 * Luật của mô hình: MỘT TÀI KHOẢN MỘT FANPAGE. Trước đây không có chỗ nào
 * đếm — đã tìm khắp mã máy chủ, không một câu lệnh nào kiểm — nên luật này chỉ
 * là lời nói. Hai Fanpage chung một tài khoản là chung luôn bộ não, chung hộp
 * thư, chung đơn hàng: đúng cái mô hình này sinh ra để tránh.
 *
 * Đếm theo Fanpage khác nhau chứ không theo số kênh: nối lại cùng một Fanpage
 * sau khi mất kết nối vẫn phải cho qua.
 */
export async function chanNeuThemFanpage(
  userId: number,
  fanpageMoi: string[]
): Promise<void> {
  const rows = await query<{ page_id: string }>(
    `SELECT DISTINCT page_id FROM social_accounts
      WHERE user_id = $1 AND platform = 'facebook' AND page_id IS NOT NULL`,
    [userId]
  );
  const dangCo = new Set(rows.rows.map((r) => r.page_id));
  for (const ma of fanpageMoi) dangCo.add(ma);

  if (dangCo.size > 1) {
    throw new AppError(
      "Mỗi tài khoản chỉ chạy được một Fanpage. Muốn thêm Fanpage, " +
        "vui lòng lập thêm một trang ở phần Quản lý trang.",
      409
    );
  }
}

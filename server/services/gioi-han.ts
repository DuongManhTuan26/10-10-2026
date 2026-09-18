/**
 * Hạn mức theo gói, thực thi ở MÁY CHỦ.
 *
 * Trước đây con số hạn mức chỉ nằm trong trang bảng giá để đọc cho vui: không
 * một câu lệnh nào kiểm, nên gói Khởi đầu nối bao nhiêu kênh cũng được.
 *
 * Với mô hình mỗi trang một tài khoản thì lỗ này thành nguy hiểm thật: admin
 * con tự đăng ký được, và mỗi tài khoản trang họ lập ra là một hồ sơ Zernio
 * cùng một kênh nối — mà tiền kênh nối là MÌNH trả. Không chặn ở máy chủ thì
 * một người đăng ký miễn phí có thể đúc ra bao nhiêu trang tuỳ thích.
 *
 * Đã đo phía Zernio ngày 19/09/2026: /usage trả limits.profiles = -1, tức là
 * họ KHÔNG chặn giúp mình. Chặn hay không hoàn toàn là việc của mình.
 */

import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";

/**
 * Số TRANG mỗi gói được chạy. Một trang là một tài khoản, một Fanpage.
 *
 * Đây là bản gốc. Trang bảng giá ở giao diện phải khớp từng số với bảng này —
 * có phép kiểm thường trực đối chiếu hai bên, vì số liệu bán hàng mà lệch số
 * liệu thực thi thì hoặc mình hứa thừa, hoặc khách trả tiền rồi bị chặn.
 */
export const SO_TRANG_MOI_GOI: Record<string, number> = {
  trial: 1,
  starter: 1,
  pro: 3,
  enterprise: 10,
};

/** Gói lạ thì cho mức thấp nhất, không cho mức cao nhất. Đoán sai phải đoán về phía an toàn. */
export function soTrangChoPhep(plan: string): number {
  return SO_TRANG_MOI_GOI[plan] ?? 1;
}

/**
 * Chặn lập thêm trang khi đã chạm hạn mức gói.
 *
 * Đếm cả trang đang khoá: khoá rồi vẫn giữ chỗ, vẫn giữ hồ sơ và kênh bên
 * Zernio. Cho lập thêm chỉ vì vừa khoá một trang là mở đường lách hạn mức.
 */
export async function chanNeuHetSuatTrang(chaId: number, plan: string): Promise<void> {
  const toiDa = soTrangChoPhep(plan);
  const dem = await queryOne<{ so: number }>(
    "SELECT count(*)::int AS so FROM users WHERE parent_id = $1",
    [chaId]
  );
  const dangCo = dem?.so ?? 0;
  if (dangCo >= toiDa) {
    throw new AppError(
      `Gói hiện tại chạy được ${toiDa} trang, bạn đã dùng hết ${dangCo}. ` +
        `Vui lòng nâng gói để thêm trang.`,
      409
    );
  }
}

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

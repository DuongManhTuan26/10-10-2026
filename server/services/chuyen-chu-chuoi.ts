/**
 * Chuyển một tài khoản đứng riêng thành CHỦ CHUỖI.
 *
 * Vì sao cần: luật "đăng ký là ra chủ chuỗi" chỉ áp dụng cho tài khoản lập ra
 * SAU khi luật có hiệu lực. Tài khoản lập trước đó — hoặc lập trúng lúc máy
 * chủ đang chạy bản cũ, đã xảy ra thật với một tài khoản của chủ sản phẩm —
 * vẫn là 'shop' đứng riêng: không có mục Quản lý trang, không lập được trang
 * nào, và vĩnh viễn kẹt ở đúng một Fanpage.
 *
 * Sửa tay bằng SQL thì lần sau lại phải nhớ sửa những gì. Ở đây làm một lần,
 * có phép kiểm đứng sau.
 *
 * CHỈ NHẬN tài khoản còn trắng. Tài khoản đã bán hàng thì mọi hộp thư, đơn
 * hàng, khách hàng đều khoá theo user_id của nó; biến nó thành chủ chuỗi là
 * đẩy toàn bộ dữ liệu ấy vào một tài khoản mà giao diện chủ chuỗi không có màn
 * hình nào để xem. Trường hợp đó phải chuyển dữ liệu — việc khác hẳn, không
 * được làm lén ở đây.
 */

import { query, queryOne, transaction } from "../db.js";
import { AppError } from "../http.js";
import * as zernio from "./zernio.js";

/** Những thứ mà có là KHÔNG chuyển được, kèm tên để nói cho người dùng biết. */
const DAU_HIEU_DA_DUNG: Array<{ bang: string; ten: string }> = [
  { bang: "social_accounts", ten: "kênh đã nối" },
  { bang: "conversations", ten: "cuộc trò chuyện" },
  { bang: "orders", ten: "đơn hàng" },
  { bang: "customers", ten: "khách hàng" },
  { bang: "ai_documents", ten: "tài liệu đã tải lên" },
  { bang: "posts", ten: "bài đã đăng" },
  { bang: "auto_scripts", ten: "kịch bản tự động" },
];

export interface KetQuaChuyen {
  id: number;
  email: string;
  /** Hồ sơ nền tảng đã dọn, hoặc null nếu tài khoản chưa từng có. */
  hoSoDaDon: string | null;
  /** Lý do chưa dọn được hồ sơ, để còn dọn tay sau. */
  loiDonHoSo: string | null;
}

export async function chuyenThanhChuChuoi(userId: number): Promise<KetQuaChuyen> {
  const nguoi = await queryOne<{
    id: number;
    email: string;
    role: string;
    profile_ref: string | null;
    parent_id: number | null;
  }>("SELECT id, email, role, profile_ref, parent_id FROM users WHERE id = $1", [userId]);
  if (!nguoi) throw new AppError("Không tìm thấy tài khoản này", 404);

  if (nguoi.role === "admin_con") {
    throw new AppError("Tài khoản này đã là tài khoản quản lý chuỗi rồi", 409);
  }
  if (nguoi.role === "admin") {
    throw new AppError("Không chuyển tài khoản quản trị tổng thành chủ chuỗi", 409);
  }
  /*
   * Tài khoản trang nằm dưới một chủ chuỗi khác thì chuyển lên là tạo ra cây
   * lồng nhau: chủ chuỗi này lại nằm dưới chủ chuỗi kia.
   */
  if (nguoi.parent_id !== null) {
    throw new AppError(
      "Đây là tài khoản trang thuộc một chuỗi khác, không chuyển lên được",
      409
    );
  }

  const daDung: string[] = [];
  for (const { bang, ten } of DAU_HIEU_DA_DUNG) {
    const r = await queryOne<{ c: number }>(
      `SELECT count(*)::int AS c FROM ${bang} WHERE user_id = $1`,
      [userId]
    );
    if ((r?.c ?? 0) > 0) daDung.push(`${r!.c} ${ten}`);
  }
  /*
   * Vai trò AI đã nhập cũng tính là đã dùng: đó là công chủ shop ngồi viết ra.
   * Bốn dòng rỗng do lúc mở tài khoản sinh sẵn thì không tính.
   */
  const coVaiTro = await queryOne<{ c: number }>(
    `SELECT count(*)::int AS c FROM ai_configs
      WHERE user_id = $1 AND coalesce(system_prompt, '') <> ''`,
    [userId]
  );
  if ((coVaiTro?.c ?? 0) > 0) daDung.push(`${coVaiTro!.c} vai trò AI đã nhập`);

  if (daDung.length > 0) {
    throw new AppError(
      `Tài khoản này đã có dữ liệu (${daDung.join(", ")}). ` +
        "Chuyển thành chủ chuỗi sẽ làm mất đường vào những dữ liệu đó. " +
        "Vui lòng lập một tài khoản quản lý mới thay vì chuyển tài khoản này.",
      409
    );
  }

  await transaction(async (client) => {
    // Bộ não gắn theo Trang, nên xoá Trang là xoá kèm vai trò rỗng của nó.
    await client.query("DELETE FROM trang WHERE user_id = $1", [userId]);
    await client.query(
      "UPDATE users SET role = 'admin_con', profile_ref = NULL, updated_at = now() WHERE id = $1",
      [userId]
    );
  });

  /*
   * Dọn hồ sơ nền tảng SAU khi đã đổi trong database.
   *
   * Chủ chuỗi không gắn kênh nên không dùng tới hồ sơ; để lại là rác nằm vĩnh
   * viễn bên nhà cung cấp. Dọn hỏng thì KHÔNG ném lỗi — việc chuyển đã xong
   * rồi — nhưng phải trả mã hồ sơ về để còn dọn tay.
   */
  let loiDonHoSo: string | null = null;
  if (nguoi.profile_ref) {
    try {
      await zernio.xoaHoSo(nguoi.profile_ref);
    } catch (error) {
      loiDonHoSo = error instanceof Error ? error.message : String(error);
      console.error(
        `[chuyển chủ chuỗi] Chưa xoá được hồ sơ ${nguoi.profile_ref}:`,
        loiDonHoSo
      );
    }
  }

  // Vai trò đổi thì mọi phiên đang mở phải chết: phiên cũ vẫn mang vai trò cũ
  // cho tới khi hết hạn, người dùng đăng nhập lại mới thấy đúng màn hình.
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);

  return {
    id: nguoi.id,
    email: nguoi.email,
    hoSoDaDon: loiDonHoSo ? null : nguoi.profile_ref,
    loiDonHoSo,
  };
}

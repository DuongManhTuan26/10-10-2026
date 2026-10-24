/**
 * Tạo một tài khoản shop mới, hoàn toàn độc lập.
 *
 * Dùng chung cho CẢ hai đường: người dùng tự đăng ký, và quản trị tạo hộ. Hai
 * đường phải ra cùng một kết quả — có hai hàm tạo tài khoản là sớm muộn cũng
 * lệch nhau, rồi tài khoản tạo bằng đường này thiếu thứ mà đường kia có.
 *
 * Mỗi tài khoản nhận nguyên một bộ của riêng mình: cấu hình bốn AI, quy tắc
 * nhường quyền, Telegram, và một hồ sơ riêng trên nền tảng. Không dùng chung
 * bất cứ thứ gì với tài khoản khác.
 */


import { queryOne, transaction } from "../db.js";
import { hashPassword } from "../auth.js";
import { AppError } from "../http.js";
import { loiMatKhau } from "../../src/lib/mat-khau.js";
import { ensureProfile } from "./accounts.js";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tên miền của tên đăng nhập nội bộ — tài khoản con do tầng chủ chuỗi cũ sinh ra (đã bỏ 18/10/2026, không sinh thêm).
 * Tài khoản cũ còn lại tới khi quản trị xoá; vẫn chặn người ngoài tự đăng ký lấn vào vùng này để mạo danh.
 */
export const TEN_MIEN_NOI_BO = "noi-bo.local";

/** Tên đăng nhập này là do hệ thống sinh, không phải email người dùng nhập. */
export function laTenDangNhapNoiBo(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${TEN_MIEN_NOI_BO}`);
}

const DEFAULT_AI_CONFIGS: Array<{
  kind: string;
  prompt: string;
}> = [
  /*
   * Tài khoản mới sinh ra với BỘ NÃO TRỐNG.
   *
   * Trước đây mỗi tài khoản mới được nhét sẵn bốn lời dặn mẫu — "Bạn là nhân
   * viên bán hàng của shop...". Nghe thì tiện, nhưng nó là lời dặn của MỘT cái
   * shop tưởng tượng, không phải của shop này. Hậu quả đã thấy tận mắt: tài
   * khoản gắn Trang bán kem dưỡng tay mà vai trò AI vẫn là "chuyên viên tư vấn
   * tài chính" — chữ mặc định nằm đó nhiều tháng, không ai sửa vì nhìn qua
   * tưởng đã cài rồi.
   *
   * Trống thì chủ shop buộc phải tự viết, và họ là người duy nhất biết shop
   * mình bán gì. Giao diện có sẵn ví dụ viết mờ để hướng dẫn, nhưng ví dụ mờ
   * KHÔNG phải nội dung — không lưu vào database, không gửi cho AI.
   *
   * Vẫn tạo đủ bốn dòng để giao diện có chỗ ghi vào, chỉ để rỗng phần chữ.
   */
  { kind: "sales", prompt: "" },
  { kind: "content", prompt: "" },
  { kind: "ads", prompt: "" },
  { kind: "analytics", prompt: "" },
];

export interface TaiKhoanMoi {
  id: number;
  email: string;
  name: string;
}

export async function taoTaiKhoan(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<TaiKhoanMoi> {
  const email = params.email.trim().toLowerCase();
  const name = (params.name ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError("Địa chỉ email không hợp lệ");
  }

  /*
   * Không ai tự đăng ký được vào vùng tên đăng nhập nội bộ.
   *
   * Không chặn thì người ngoài đăng ký "cham-tay-1@noi-bo.local" và tài khoản
   * đó trông y hệt một tài khoản do hệ thống sinh ra trước đây.
   */
  if (laTenDangNhapNoiBo(email)) {
    throw new AppError("Địa chỉ email không hợp lệ");
  }
  const loiMk = loiMatKhau(params.password);
  if (loiMk) throw new AppError(loiMk);

  const dangCo = await queryOne("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (dangCo) {
    throw new AppError("Email này đã được đăng ký", 409);
  }

  const passwordHash = await hashPassword(params.password);

  /*
   * MỌI tài khoản mới là tài khoản dùng thường — bản sao phần dùng thường của quản trị tổng (chủ dự án 18/10/2026):
   * một chìa khoá đăng nhập, tự tạo nhiều cửa hàng, mỗi cửa hàng một hồ sơ nền tảng + một bộ não.
   */
  const id = await transaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'shop') RETURNING id`,
      [email, passwordHash, name]
    );
    const userId = inserted.rows[0].id;

    /*
     * Mỗi tài khoản mới sinh ra kèm TRANG ĐẦU TIÊN.
     *
     * Bộ não gắn theo Trang, nên không có Trang thì không có chỗ ghi vai trò
     * và tài liệu. Hồ sơ Zernio thật được tạo ở bước sau (ensureProfile) và
     * ghi đè vào đây; chỗ này đặt tạm một mã riêng để bảng không trống, vì
     * profile_ref là khoá duy nhất và không được để null.
     */
    {
      const trangMoi = await client.query<{ id: number }>(
        `INSERT INTO trang (user_id, profile_ref, ten)
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, `cho-cap-${userId}`, "Cửa hàng đầu tiên"]
      );
      const trangId = trangMoi.rows[0].id;

      for (const config of DEFAULT_AI_CONFIGS) {
        // AI Nội dung: chưa chọn giọng → tone NULL (cột có mặc định 'friendly' — TD-24, migration 066).
        await client.query(
          `INSERT INTO ai_configs (user_id, trang_id, kind, system_prompt, tone)
           VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'content' THEN NULL ELSE 'friendly' END)`,
          [userId, trangId, config.kind, config.prompt]
        );
      }
    }

    // Luật chuyển người thật: KHÔNG chèn sẵn — cửa hàng chưa có dòng đọc bộ mặc định (services/luat-chuyen-nguoi.ts, A3).

    await client.query(`INSERT INTO telegram_configs (user_id) VALUES ($1)`, [userId]);

    return userId;
  });

  /*
   * Hồ sơ riêng trên nền tảng, để dữ liệu các shop không lẫn nhau.
   * Nền tảng lỗi thì vẫn cho tạo tài khoản — nối lại được sau.
   */
  try {
    await ensureProfile({ id, name, email, profileRef: null });
  } catch (error) {
    console.error(
      "[tài khoản] Chưa tạo được hồ sơ nền tảng cho tài khoản mới:",
      error instanceof Error ? error.message : error
    );
  }

  return { id, email, name };
}

/**
 * Mật khẩu khi quản trị TẠO hoặc CẤP LẠI tài khoản: người quản trị BẮT BUỘC TỰ GÕ (chủ dự án 19/10/2026: để trống
 * thì không cho lưu — bỏ hẳn đường hệ thống tự sinh).
 *
 * Lỗi đã lặp lại (chủ dự án 04/10/2026: "tao là admin tổng, tao thích đổi mật khẩu như nào tao phải biết chứ,
 * lỗi này đã xảy ra trước đây"). Lần trước chỉ sửa đúng một chỗ (cấp lại mật khẩu trang ở Quản lý Trang); tạo
 * tài khoản, cấp lại mật khẩu ở Quản trị hệ thống và lập trang mới vẫn chỉ sinh ngẫu nhiên. MỌI chỗ cấp mật khẩu
 * đều đi qua hàm này để không còn chỗ nào bị sót. Luật mật khẩu: loiMatKhau (src/lib/mat-khau.ts), chung mọi nơi.
 */
export function docMatKhauTuDat(body: unknown): { matKhau: string } {
  const v = body && typeof body === "object" ? (body as Record<string, unknown>).matKhau : undefined;
  const loi = loiMatKhau(v);
  if (loi) throw new AppError(loi);
  return { matKhau: v as string };
}


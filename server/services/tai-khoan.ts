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

import crypto from "node:crypto";

import { queryOne, transaction } from "../db.js";
import { hashPassword } from "../auth.js";
import { AppError } from "../http.js";
import { ensureProfile } from "./accounts.js";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tên miền dành riêng cho tên đăng nhập nội bộ của tài khoản trang.
 *
 * Tài khoản trang do admin con lập ra không có email thật — chủ chuỗi mười
 * trang không thể có mười hòm thư. Nên hệ thống tự sinh tên đăng nhập.
 *
 * Chọn đuôi .local vì RFC 6762 giữ riêng đuôi này cho mạng nội bộ: KHÔNG AI
 * đăng ký được nó làm tên miền thật trên Internet. Nhờ vậy tên đăng nhập nội
 * bộ không bao giờ đụng email thật của ai, và người ngoài không thể tự đăng ký
 * lấn vào vùng này để mạo danh một tài khoản trang.
 *
 * Vẫn dùng chung cột email và chung chỉ mục duy nhất sẵn có, nên đường đăng
 * nhập không phải sửa một dòng nào — càng ít chỗ đụng vào thì càng ít chỗ hỏng.
 */
export const TEN_MIEN_NOI_BO = "noi-bo.local";

/** Tên đăng nhập này là do hệ thống sinh, không phải email người dùng nhập. */
export function laTenDangNhapNoiBo(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${TEN_MIEN_NOI_BO}`);
}

/**
 * Bỏ dấu tiếng Việt rồi rút gọn thành chuỗi đặt được vào tên đăng nhập.
 *
 * "Chạm Tay Vạn Điều Hay" → "cham-tay-van-dieu-hay". Giữ chữ có nghĩa để chủ
 * chuỗi nhìn tên đăng nhập là biết ngay của trang nào, thay vì một dãy mã.
 */
export function rutGonTen(ten: string): string {
  const khongDau = ten
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return khongDau
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
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

/** Các quy tắc chuyển hội thoại cho người thật, bật sẵn theo thực tế bán hàng. */
const DEFAULT_HANDOFF_RULES: Array<{ key: string; enabled: boolean; config?: object }> = [
  { key: "complaint", enabled: true },
  { key: "ask_human", enabled: true },
  { key: "discount", enabled: true },
  { key: "shipping", enabled: true },
  { key: "unsure", enabled: true },
  { key: "media", enabled: false },
  { key: "too_many_turns", enabled: true, config: { maxTurns: 8 } },
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
  /** Tài khoản admin con đứng trên. Bỏ trống là tài khoản đứng riêng. */
  parentId?: number | null;
  role?: "admin_con" | "shop";
  /** Chỉ đường tạo tài khoản trang nội bộ mới được bật cờ này. */
  noiBo?: boolean;
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
   * đó trông y hệt một tài khoản trang do hệ thống sinh ra — chủ chuỗi nhìn
   * vào không phân biệt được.
   */
  if (!params.noiBo && laTenDangNhapNoiBo(email)) {
    throw new AppError("Địa chỉ email không hợp lệ");
  }
  if (params.password.length < 8) {
    throw new AppError("Mật khẩu phải có ít nhất 8 ký tự");
  }

  const dangCo = await queryOne("SELECT id FROM users WHERE lower(email) = $1", [email]);
  if (dangCo) {
    throw new AppError("Email này đã được đăng ký", 409);
  }

  const passwordHash = await hashPassword(params.password);

  const id = await transaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, name, parent_id, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, passwordHash, name, params.parentId ?? null, params.role ?? "shop"]
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
    const trangMoi = await client.query<{ id: number }>(
      `INSERT INTO trang (user_id, profile_ref, ten)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, `cho-cap-${userId}`, "Trang đầu tiên"]
    );
    const trangId = trangMoi.rows[0].id;

    for (const config of DEFAULT_AI_CONFIGS) {
      await client.query(
        `INSERT INTO ai_configs (user_id, trang_id, kind, system_prompt)
         VALUES ($1, $2, $3, $4)`,
        [userId, trangId, config.kind, config.prompt]
      );
    }

    for (const rule of DEFAULT_HANDOFF_RULES) {
      await client.query(
        `INSERT INTO handoff_rules (user_id, rule_key, enabled, config)
         VALUES ($1, $2, $3, $4)`,
        [userId, rule.key, rule.enabled, JSON.stringify(rule.config ?? {})]
      );
    }

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
 * Mật khẩu tạm khi quản trị tạo tài khoản hộ.
 *
 * Dùng crypto chứ KHÔNG dùng Math.random: đây là thứ cấp quyền vào tài khoản
 * của một shop, đoán được nó là vào được toàn bộ dữ liệu khách hàng của họ.
 *
 * Bỏ các ký tự dễ đọc nhầm (0/O, 1/l/I) vì mật khẩu này thường phải đọc qua
 * điện thoại cho chủ shop.
 */
export function sinhMatKhauTam(): string {
  const chu = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const byte = crypto.randomBytes(16);
  let ra = "";
  for (const b of byte) ra += chu[b % chu.length];
  return ra;
}

/**
 * Lập một TÀI KHOẢN TRANG cho admin con.
 *
 * Mỗi tài khoản trang giữ đúng một Fanpage và độc lập hoàn toàn với các trang
 * khác: hộp thư riêng, đơn hàng riêng, bộ não riêng, hồ sơ Zernio riêng. Không
 * có đường nào để dữ liệu hai trang lẫn vào nhau, vì chúng không dùng chung gì.
 *
 * Tên đăng nhập do hệ thống sinh theo tên trang, kèm bốn ký tự ngẫu nhiên để
 * hai trang trùng tên không đụng nhau. Mật khẩu tạm trả về ĐÚNG MỘT LẦN cho
 * người lập — hệ thống chỉ giữ bản băm, không đọc lại được.
 */
export async function taoTaiKhoanTrang(params: {
  parentId: number;
  tenTrang: string;
}): Promise<TaiKhoanMoi & { matKhauTam: string }> {
  const tenTrang = params.tenTrang.trim();
  if (tenTrang.length < 2) {
    throw new AppError("Vui lòng đặt tên cho trang, ít nhất 2 ký tự");
  }

  const goc = rutGonTen(tenTrang) || "trang";

  /*
   * Thử vài lần rồi mới chịu thua.
   *
   * Bốn ký tự ngẫu nhiên gần như không trùng, nhưng "gần như" không phải là
   * "không bao giờ": trùng một lần là lỗi khoá duy nhất ném thẳng vào mặt
   * người đang lập trang, không hiểu vì sao. Thử lại rẻ hơn nhiều.
   */
  for (let lan = 0; lan < 5; lan++) {
    const duoi = crypto.randomBytes(2).toString("hex");
    const tenDangNhap = `${goc}-${duoi}@${TEN_MIEN_NOI_BO}`;
    const trung = await queryOne("SELECT id FROM users WHERE lower(email) = $1", [tenDangNhap]);
    if (trung) continue;

    const matKhauTam = sinhMatKhauTam();
    const taiKhoan = await taoTaiKhoan({
      email: tenDangNhap,
      password: matKhauTam,
      name: tenTrang,
      parentId: params.parentId,
      role: "shop",
      noiBo: true,
    });
    return { ...taiKhoan, matKhauTam };
  }

  throw new AppError("Không sinh được tên đăng nhập, vui lòng thử lại");
}

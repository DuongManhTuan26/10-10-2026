import crypto from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { query, queryOne } from "./db.js";
import { env } from "./env.js";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const SESSION_COOKIE = "zn_session";
const SESSION_TTL_DAYS = 30;

// ---------------------------------------------------------------------------
// Mật khẩu
// ---------------------------------------------------------------------------

/**
 * Băm mật khẩu bằng scrypt — có sẵn trong Node, không cần thêm thư viện.
 * Định dạng lưu: scrypt$<salt hex>$<hash hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  // So sánh theo thời gian hằng số để không rò rỉ thông tin qua thời gian phản hồi.
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

// ---------------------------------------------------------------------------
// Phiên đăng nhập
// ---------------------------------------------------------------------------

/**
 * 'admin' — quản trị tổng: thấy mọi tài khoản trong hệ thống, đồng thời dùng như một tài khoản thường.
 * 'shop'  — tài khoản dùng thường: tự giữ nhiều cửa hàng, không thấy tài khoản nào khác.
 * (Tầng chủ chuỗi 'admin_con' đã bỏ — chủ dự án 18/10/2026.)
 */
export type VaiTro = "admin" | "shop";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  plan: string;
  /** Luôn đọc từ database mỗi request, không bao giờ tin phía trình duyệt. */
  role: VaiTro;
  profileRef: string | null;
  /**
   * Ai đã mở phiên này thay cho chủ tài khoản.
   *
   * null là người dùng tự đăng nhập. Có số là quản trị tổng đang mở tài
   * khoản này — giao diện PHẢI hiện rõ điều đó, vì người đang ngồi trước màn
   * hình rất dễ tưởng mình vẫn ở tài khoản của mình rồi gõ nhầm vai trò AI hay
   * trả lời khách của tài khoản khác.
   */
  moBoi: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

/**
 * Chuỗi vai trò trong database → vai trò dùng được, luôn về phía ít quyền.
 *
 * Vai trò lạ rơi về 'shop'. Đoán sai phải đoán về phía ít quyền, không phải
 * phía cấp thêm quyền.
 */
function chuanHoaVaiTro(role: string): VaiTro {
  return role === "admin" ? "admin" : "shop";
}

/**
 * Hồ sơ người dùng gửi cho giao diện — ĐÚNG MỘT hình dạng cho mọi đường.
 *
 * Lỗi đã xảy ra thật: /auth/login chỉ trả { id, email, name }, không có role.
 * Giao diện lấy thẳng phản hồi đó làm người dùng hiện tại, nên NGAY SAU KHI
 * ĐĂNG NHẬP vai trò là undefined — mục Quản Trị Hệ Thống biến mất, và chủ
 * chuỗi thì nhìn thấy bộ màn hình bán hàng không phải của mình. Tải lại trang
 * là đúng trở lại, vì lúc đó /auth/me mới chạy. Kiểu lỗi chập chờn khó ngờ
 * nhất.
 *
 * TypeScript không bắt được: lớp gọi API khai kiểu trả về là User, nhưng máy
 * chủ gửi ít trường hơn — kiểu khai ở client không ràng buộc được máy chủ.
 *
 * Nay đăng nhập, đăng ký và /auth/me đều đi qua đây, nên không còn chỗ nào
 * lệch được nữa.
 */
export async function hoSoNguoiDung(
  userId: number,
  moBoi: number | null
): Promise<(SessionUser & { nguoiMo: { id: number; name: string } | null }) | null> {
  const row = await queryOne<{
    id: number;
    email: string;
    name: string;
    plan: string;
    role: string;
    profile_ref: string | null;
  }>("SELECT id, email, name, plan, role, profile_ref FROM users WHERE id = $1", [userId]);
  if (!row) return null;

  const nguoiMo =
    moBoi === null
      ? null
      : await queryOne<{ id: number; name: string }>(
          "SELECT id, name FROM users WHERE id = $1",
          [moBoi]
        );

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    role: chuanHoaVaiTro(row.role),
    profileRef: row.profile_ref,
    moBoi,
    nguoiMo,
  };
}

function signSessionId(id: string): string {
  const mac = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(id)
    .digest("base64url");
  return `${id}.${mac}`;
}

/** Trả về id phiên nếu chữ ký hợp lệ, ngược lại null. */
function unsignSessionId(signed: string): string | null {
  const separator = signed.lastIndexOf(".");
  if (separator <= 0) return null;

  const id = signed.slice(0, separator);
  const expected = signSessionId(id);

  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? id : null;
}

export async function createSession(
  res: Response,
  userId: number,
  /** Admin con mở phiên thay cho tài khoản trang của mình. */
  moBoi: number | null = null
): Promise<void> {
  const id = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await query(
    "INSERT INTO sessions (id, user_id, expires_at, mo_boi) VALUES ($1, $2, $3, $4)",
    [id, userId, expiresAt, moBoi]
  );

  res.cookie(SESSION_COOKIE, signSessionId(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  if (req.sessionId) {
    await query("DELETE FROM sessions WHERE id = $1", [req.sessionId]);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

interface SessionRow extends SessionUser {
  session_id: string;
}

async function loadSession(req: Request): Promise<SessionRow | null> {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (typeof raw !== "string") return null;

  const id = unsignSessionId(raw);
  if (!id) return null;

  const row = await queryOne<{
    session_id: string;
    id: number;
    email: string;
    name: string;
    plan: string;
    role: string;
    profile_ref: string | null;
    mo_boi: number | null;
  }>(
    `SELECT s.id AS session_id, s.mo_boi, u.id, u.email, u.name, u.plan, u.role, u.profile_ref
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active = TRUE
        /*
         * Phiên XEM THAY chỉ sống khi người mở nó vẫn còn quyền mở.
         *
         * Đã tái hiện: khoá người mở thì phiên của chính họ bị xoá, nhưng phiên
         * họ đang mở mang user_id của tài khoản kia, nên sống tiếp. Kiểm ở đây,
         * mỗi request, thì khoá hay hạ vai trò đều có hiệu lực ngay lượt bấm kế
         * tiếp, không cần nhớ đi xoá phiên ở đâu.
         *
         * Chỉ quản trị tổng mở được tài khoản khác — mọi tài khoản không phải quản trị.
         */
        AND (s.mo_boi IS NULL OR EXISTS (
              SELECT 1 FROM users c
               WHERE c.id = s.mo_boi AND c.is_active = TRUE
                 AND c.role = 'admin' AND u.role <> 'admin'))`,
    [id]
  );

  if (!row) return null;

  return {
    session_id: row.session_id,
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    /*
     * Vai trò lấy từ DATABASE mỗi request, không lấy từ phía trình duyệt.
     * Ai sửa được vai trò trong cookie là chiếm được quyền quản trị cả hệ thống.
     */
    role: chuanHoaVaiTro(row.role),
    profileRef: row.profile_ref,
    moBoi: row.mo_boi,
  };
}

/**
 * Gắn thông tin người dùng vào request nếu có phiên hợp lệ.
 * Không chặn request — việc chặn là của requireAuth.
 */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await loadSession(req);
    if (session) {
      const { session_id, ...user } = session;
      req.user = user;
      req.sessionId = session_id;
    }
  } catch (error) {
    console.error("[auth] Không đọc được phiên:", error);
  }
  next();
}

/** Chặn request nếu chưa đăng nhập. Dùng cho mọi route dữ liệu. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Bạn cần đăng nhập để tiếp tục" });
    return;
  }
  next();
}

/**
 * Dọn phiên hết hạn và hai bảng đếm chống dò. server.ts gọi mỗi giờ.
 *
 * Bản trước chỉ dọn phiên. login_attempts ghi cả lần gõ sai vào email không
 * tồn tại, chỉ bị xoá khi email đó đăng nhập đúng — tức là không bao giờ; ai
 * gõ sai liên tục là database phình mãi. dang_ky_theo_ip cũng vậy.
 *
 * Giữ một ngày, rộng hơn nhiều so với cửa sổ đếm (15 phút đăng nhập, một giờ
 * đăng ký), nên dọn không bao giờ làm bộ đếm quên sớm.
 */
export async function donDuLieuHetHan(): Promise<number> {
  const phien = await query("DELETE FROM sessions WHERE expires_at <= now()");
  const dangNhap = await query(
    "DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'"
  );
  const dangKy = await query(
    "DELETE FROM dang_ky_theo_ip WHERE created_at < now() - interval '1 day'"
  );
  const ve = await query("DELETE FROM ma_xac_thuc WHERE het_han < now() - interval '1 day'");
  return (phien.rowCount ?? 0) + (dangNhap.rowCount ?? 0) + (dangKy.rowCount ?? 0) + (ve.rowCount ?? 0);
}

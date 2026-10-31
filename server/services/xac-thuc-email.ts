/**
 * Xác thực bằng email: mật khẩu đúng rồi vẫn phải gõ đúng mã 6 số gửi vào email.
 *
 * Chống dò mã:
 *   - mã chỉ lưu bản băm (HMAC với khoá phiên), không lưu mã gốc;
 *   - mỗi vé sống 10 phút, sai 5 lần là vé chết — muốn mã mới phải nhập lại
 *     mật khẩu, và lần đó lại bị chốt chống dò mật khẩu đếm;
 *   - tăng số lần sai TRƯỚC khi so, nên bắn song song cũng không vượt 5 lượt;
 *   - mỗi tài khoản tối đa 5 mã mỗi giờ, chống dùng hệ thống để spam email.
 *
 * Tài khoản con cũ (tên đăng nhập @noi-bo.local, không có hộp thư thật — tầng
 * chủ chuỗi đã bỏ 18/10/2026): không nhận được mã, báo rõ để liên hệ quản trị.
 */

import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { query, queryOne } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { laTenDangNhapNoiBo } from "./tai-khoan.js";

export const SONG_PHUT = 10;
export const SAI_TOI_DA = 5;
export const MA_MOI_GIO_TOI_DA = 5;

export function canXacThucEmail(): boolean {
  return env.email.batXacThuc;
}

/** Che bớt email khi báo "đã gửi tới": hoangtuan3310tn@gmail.com → ho*************n@gmail.com */
export function cheEmail(email: string): string {
  const [ten, mien] = email.split("@");
  if (!ten || !mien) return "email của bạn";
  if (ten.length <= 2) return `${ten[0]}*@${mien}`;
  return `${ten.slice(0, 2)}${"*".repeat(Math.max(1, ten.length - 3))}${ten.slice(-1)}@${mien}`;
}

function bamMa(ve: string, ma: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(`${ve}:${ma}`).digest("hex");
}

let boGui: Transporter | null = null;

async function guiEmail(toi: string, tieuDe: string, noiDung: string): Promise<void> {
  if (!env.email.smtpUser || !env.email.smtpPass) {
    if (env.isProduction) {
      throw new AppError(
        "Hệ thống chưa cấu hình gửi email nên chưa đăng nhập được. Vui lòng liên hệ quản trị.",
        503
      );
    }
    // Chỉ khi thử trên máy: in ra nhật ký để thử được mà chưa cần Gmail.
    console.log(`[email thử — chỉ khi chạy trên máy] tới ${toi}: ${tieuDe}`);
    return;
  }
  boGui ??= nodemailer.createTransport({
    host: env.email.smtpHost,
    port: env.email.smtpPort,
    secure: env.email.smtpPort === 465,
    auth: { user: env.email.smtpUser, pass: env.email.smtpPass },
  });
  try {
    await boGui.sendMail({
      // Chưa đặt tên người gửi (chủ dự án chưa chọn tên) → chỉ địa chỉ, không bịa tên.
      from: env.email.tenNguoiGui ? { name: env.email.tenNguoiGui, address: env.email.smtpUser } : env.email.smtpUser,
      to: toi,
      subject: tieuDe,
      text: noiDung,
    });
  } catch (error) {
    console.error("[email] Gửi hỏng:", error instanceof Error ? error.message : error);
    throw new AppError("Chưa gửi được mã xác thực tới email. Vui lòng thử lại sau ít phút.", 502);
  }
}

/** Email nhận mã: email của chính tài khoản. Tên đăng nhập nội bộ cũ không có hộp thư thật. */
function nguoiNhanMa(user: { id: number; email: string }): { email: string } {
  if (laTenDangNhapNoiBo(user.email)) {
    throw new AppError(
      "Tài khoản này thuộc cách quản lý cũ, không có email để nhận mã xác thực. Vui lòng liên hệ quản trị.",
      409
    );
  }
  return { email: user.email };
}

/**
 * Tạo vé và gửi mã. Trả về mã vé (trình duyệt giữ) và email đã che bớt.
 */
export async function taoVeXacThuc(p: {
  user: { id: number; email: string; name: string };
  mucDich: "dang_nhap" | "dang_ky";
}): Promise<{ ve: string; guiToi: string }> {
  const dem = await queryOne<{ c: number }>(
    `SELECT count(*)::int AS c FROM ma_xac_thuc
      WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [p.user.id]
  );
  if ((dem?.c ?? 0) >= MA_MOI_GIO_TOI_DA) {
    throw new AppError("Đã gửi quá nhiều mã cho tài khoản này. Vui lòng thử lại sau một giờ.", 429);
  }

  const nhan = nguoiNhanMa(p.user);
  const ma = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const ve = crypto.randomBytes(24).toString("base64url");
  await query(
    `INSERT INTO ma_xac_thuc (id, user_id, muc_dich, ma_hash, gui_toi, het_han)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval)`,
    [ve, p.user.id, p.mucDich, bamMa(ve, ma), nhan.email, String(SONG_PHUT)]
  );

  const viec = p.mucDich === "dang_ky" ? "hoàn tất đăng ký" : "đăng nhập";
  const ai = "tài khoản của bạn";
  await guiEmail(
    nhan.email,
    `Mã xác thực: ${ma}`,
    [
      `Mã xác thực để ${viec} vào ${ai}:`,
      "",
      `    ${ma}`,
      "",
      `Mã có hiệu lực ${SONG_PHUT} phút. Không chia sẻ mã này cho bất kỳ ai, kể cả người tự xưng là nhân viên hỗ trợ.`,
      "",
      "Nếu không phải bạn vừa đăng nhập: có người đã biết mật khẩu. Hãy đổi mật khẩu ngay.",
    ].join("\n")
  );
  if (!env.email.smtpUser && !env.isProduction) {
    // Thử trên máy, chưa cấu hình Gmail: in mã ra nhật ký để thử được trọn luồng.
    console.log(`[email thử — chỉ khi chạy trên máy] mã cho vé ${ve.slice(0, 8)}…: ${ma}`);
  }
  return { ve, guiToi: cheEmail(nhan.email) };
}

/**
 * Kiểm mã. Đúng thì xoá vé và trả user_id; sai thì báo còn mấy lượt.
 */
export async function xacNhanMa(ve: string, ma: string): Promise<{ userId: number; mucDich: string }> {
  const sach = ma.replace(/\D/g, "");
  if (!ve || sach.length !== 6) throw new AppError("Mã xác thực gồm 6 chữ số.", 400);

  // Tăng số lần sai TRƯỚC khi so: bắn song song nhiều mã cũng không quá 5 lượt.
  const row = await queryOne<{ user_id: number; muc_dich: string; ma_hash: string; so_lan_sai: number }>(
    `UPDATE ma_xac_thuc SET so_lan_sai = so_lan_sai + 1
      WHERE id = $1 AND het_han > now() AND so_lan_sai < $2 AND dung_at IS NULL
      RETURNING user_id, muc_dich, ma_hash, so_lan_sai`,
    [ve, SAI_TOI_DA]
  );
  if (!row) {
    throw new AppError("Mã đã hết hạn hoặc nhập sai quá nhiều lần. Vui lòng đăng nhập lại để nhận mã mới.", 401);
  }
  const dung = crypto.timingSafeEqual(Buffer.from(bamMa(ve, sach)), Buffer.from(row.ma_hash));
  if (!dung) {
    const con = SAI_TOI_DA - row.so_lan_sai;
    throw new AppError(
      con > 0 ? `Mã không đúng. Còn ${con} lần thử.` : "Mã không đúng. Đã hết lượt thử, vui lòng đăng nhập lại để nhận mã mới.",
      401
    );
  }
  /*
   * Đánh dấu đã dùng, KHÔNG xoá: xoá đi thì chốt "5 mã mỗi giờ" đếm thiếu
   * (đã đo: xin mã lần thứ 6 vẫn được). Điều kiện dung_at IS NULL ở trên chặn
   * dùng lại vé.
   */
  await query("UPDATE ma_xac_thuc SET dung_at = now() WHERE id = $1", [ve]);
  return { userId: row.user_id, mucDich: row.muc_dich };
}

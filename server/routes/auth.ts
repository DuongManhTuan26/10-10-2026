import crypto from "node:crypto";
import { Router } from "express";
import { query, queryOne, transaction } from "../db.js";
import {
  createSession,
  destroySession,
  hashPassword,
  hoSoNguoiDung,
  requireAuth,
  verifyPassword,
} from "../auth.js";
import { AppError, requireString, route } from "../http.js";
import * as zernio from "../services/zernio.js";
import { ensureProfile } from "../services/accounts.js";
import { taoTaiKhoan, laTenDangNhapNoiBo } from "../services/tai-khoan.js";
import { canXacThucEmail, taoVeXacThuc, xacNhanMa } from "../services/xac-thuc-email.js";
import { loiMatKhau } from "../../src/lib/mat-khau.js";

export const authRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Một địa chỉ IP đăng ký tối đa chừng này lần mỗi giờ.
 *
 * Đủ rộng cho một văn phòng nhiều người đăng ký chung mạng, đủ chặt để một
 * đoạn lệnh vòng lặp không đẻ được hàng nghìn tài khoản.
 */
const DANG_KY_TOI_DA_MOI_GIO = 10;

/**
 * Bản băm của một mật khẩu ngẫu nhiên không ai biết, để so khi email không
 * tồn tại — cùng thuật toán, cùng tham số nên tốn đúng bằng thời gian thật.
 */
let banBamGia: Promise<string> | null = null;
function bamGia(): Promise<string> {
  banBamGia ??= hashPassword(crypto.randomBytes(32).toString("hex"));
  return banBamGia;
}

authRouter.post(
  "/register",
  route(async (req, res) => {
    /*
     * Đếm CẢ lần đăng ký hỏng, không chỉ lần thành công: không đếm thì kẻ dò
     * dùng trang đăng ký để hỏi "email này có tài khoản chưa" bao nhiêu lần
     * cũng được. Ghi trước khi tạo, nên lỗi giữa chừng vẫn bị đếm.
     *
     * Chỉ có nghĩa khi req.ip là IP thật — xem trust proxy trong app.ts.
     */
    const ip = req.ip ?? "";
    const dem = await queryOne<{ c: number }>(
      `SELECT count(*)::int AS c FROM dang_ky_theo_ip
        WHERE ip = $1 AND created_at > now() - interval '1 hour'`,
      [ip]
    );
    if ((dem?.c ?? 0) >= DANG_KY_TOI_DA_MOI_GIO) {
      throw new AppError(
        "Đăng ký quá nhiều lần từ cùng một mạng. Vui lòng thử lại sau một giờ.",
        429
      );
    }
    await query("INSERT INTO dang_ky_theo_ip (ip) VALUES ($1)", [ip]);

    /*
     * Đi qua đúng một hàm tạo tài khoản dùng chung với đường quản trị tạo hộ.
     * Hai đường tạo riêng là sớm muộn cũng lệch, rồi tài khoản đường này thiếu
     * thứ mà đường kia có.
     */
    /*
     * Người tự đăng ký ra tài khoản DÙNG THƯỜNG — bản sao phần dùng thường của quản trị tổng (chủ dự án 18/10/2026):
     * một chìa khoá đăng nhập, tự tạo nhiều cửa hàng, mỗi cửa hàng một hồ sơ nền tảng + một bộ não.
     */
    const taiKhoan = await taoTaiKhoan({
      email: requireString(req.body, "email", "email"),
      // Không qua requireString (nó cắt dấu cách): luật mật khẩu chung tự từ chối dấu cách ở mép (src/lib/mat-khau.ts).
      password: typeof req.body?.password === "string" ? req.body.password : "",
      name: typeof req.body?.name === "string" ? req.body.name : "",
    });

    /*
     * Chạy thật thì phải chứng minh email là của mình rồi mới có phiên — không
     * thì ai cũng đăng ký được bằng email của người khác.
     */
    if (canXacThucEmail()) {
      const ve = await taoVeXacThuc({ user: taiKhoan, mucDich: "dang_ky" });
      res.status(201).json({ success: true, canMa: true, ...ve });
      return;
    }

    await createSession(res, taiKhoan.id);
    res.status(201).json({ success: true, user: await hoSoNguoiDung(taiKhoan.id, null) });
  })
);

/*
 * Chặn dò mật khẩu.
 *
 * Trước đây trang đăng nhập đi thẳng một mạch: tra tài khoản, so mật khẩu, tạo
 * phiên. Không bộ đếm, không khoá tạm — bắn bao nhiêu lần cũng được.
 *
 * Đếm theo CẢ HAI chiều:
 *   - theo email: chặn dò mật khẩu của một tài khoản cụ thể
 *   - theo IP: chặn rải một mật khẩu phổ biến lên hàng loạt tài khoản, kiểu
 *     tấn công mà đếm theo email không bao giờ thấy
 *
 * Chỉ ghi lần SAI. Đăng nhập đúng thì xoá sạch lịch sử sai của email đó.
 */
const CUA_SO_PHUT = 15;
/** Cùng một người, dò cùng một tài khoản. Ngưỡng chặt nhất. */
const TOI_DA_CUNG_CAP = 5;
/** Một người rải mật khẩu lên nhiều tài khoản khác nhau. */
const TOI_DA_THEO_IP = 20;
/**
 * Một tài khoản bị dò từ rất nhiều nơi.
 *
 * Để cao có chủ đích. Nếu chặn theo email từ ngưỡng thấp thì BẤT KỲ AI cũng
 * khoá được tài khoản của người khác chỉ bằng cách gõ sai 5 lần — đổi một lỗ
 * hổng lấy một lỗ hổng khác. Ngưỡng này chỉ để cản tấn công rải từ nhiều máy.
 */
const TOI_DA_THEO_EMAIL = 50;

async function kiemTraChanDo(email: string, ip: string): Promise<void> {
  const dem = await queryOne<{ cung_cap: number; theo_ip: number; theo_email: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE lower(email) = $1 AND ip = $2 AND $2 <> '')::int AS cung_cap,
       COUNT(*) FILTER (WHERE ip = $2 AND $2 <> '')::int                      AS theo_ip,
       COUNT(*) FILTER (WHERE lower(email) = $1)::int                         AS theo_email
     FROM login_attempts
    WHERE created_at > now() - ($3 || ' minutes')::interval`,
    [email, ip, String(CUA_SO_PHUT)]
  );

  const qua =
    (dem?.cung_cap ?? 0) >= TOI_DA_CUNG_CAP ||
    (dem?.theo_ip ?? 0) >= TOI_DA_THEO_IP ||
    (dem?.theo_email ?? 0) >= TOI_DA_THEO_EMAIL;
  if (!qua) return;

  throw new AppError(
    `Sai quá nhiều lần. Vui lòng thử lại sau ${CUA_SO_PHUT} phút, ` +
      "hoặc liên hệ quản trị để được cấp lại mật khẩu.",
    429
  );
}

authRouter.post(
  "/login",
  route(async (req, res) => {
    const email = requireString(req.body, "email", "email").toLowerCase();
    const password = requireString(req.body, "password", "mật khẩu");
    const ip = req.ip ?? "";

    await kiemTraChanDo(email, ip);

    const user = await queryOne<{
      id: number;
      email: string;
      name: string;
      password_hash: string;
      is_active: boolean;
    }>(
      `SELECT id, email, name, password_hash, is_active
         FROM users WHERE lower(email) = $1`,
      [email]
    );

    // Cùng một thông báo cho email sai và mật khẩu sai, để không lộ
    // email nào đã tồn tại trong hệ thống.
    const invalid = new AppError("Email hoặc mật khẩu không đúng", 401);

    /*
     * Ghi lần sai TRƯỚC khi ném lỗi, cho cả hai trường hợp.
     *
     * Email không tồn tại cũng phải ghi: không ghi thì kẻ dò cứ đổi email là
     * bộ đếm theo IP không bao giờ tăng.
     */
    /*
     * LUÔN băm mật khẩu, kể cả khi email không tồn tại hay tài khoản bị khoá.
     *
     * Đã đo: bản trước bỏ qua bước băm khi không có email, nên email có thật
     * trả lời chậm hơn ~45ms, không lần nào chồng lấn (191–201ms so với
     * 147–151ms). Thông báo lỗi giống nhau cũng vô ích — đo năm lần là biết
     * email nào có tài khoản.
     */
    const matKhauDung = await verifyPassword(password, user?.password_hash ?? (await bamGia()));
    if (!user || !user.is_active || !matKhauDung) {
      await query("INSERT INTO login_attempts (email, ip) VALUES ($1, $2)", [email, ip]).catch(
        () => {
          /* Ghi hỏng thì vẫn phải từ chối đăng nhập, không được cho qua. */
        }
      );
      throw invalid;
    }

    // Đúng mật khẩu thì xoá sạch lịch sử sai, để lần sau gõ nhầm không bị chặn oan.
    await query("DELETE FROM login_attempts WHERE lower(email) = $1", [email]).catch(() => {});

    /*
     * Mật khẩu đúng CHƯA đủ khi chạy thật: gửi mã vào email, chưa cấp phiên.
     * Kẻ biết mật khẩu mà không mở được hộp thư thì không vào được.
     */
    if (canXacThucEmail()) {
      const ve = await taoVeXacThuc({ user, mucDich: "dang_nhap" });
      res.json({ success: true, canMa: true, ...ve });
      return;
    }

    await createSession(res, user.id);
    // Cùng một hình dạng với /auth/me. Thiếu role ở đây là giao diện vẽ sai
    // menu cho tới khi người dùng tự tải lại trang.
    res.json({ success: true, user: await hoSoNguoiDung(user.id, null) });
  })
);

/** Bước 2 của đăng nhập/đăng ký: gõ mã 6 số đã gửi vào email. Đúng mới có phiên. */
authRouter.post(
  "/xac-thuc",
  route(async (req, res) => {
    const ve = typeof req.body?.ve === "string" ? req.body.ve : "";
    const ma = typeof req.body?.ma === "string" ? req.body.ma : "";
    const { userId } = await xacNhanMa(ve, ma);

    const user = await queryOne<{ id: number; email: string; is_active: boolean }>(
      "SELECT id, email, is_active FROM users WHERE id = $1",
      [userId]
    );
    // Bị khoá trong lúc chờ mã thì vẫn không cho vào.
    if (!user || !user.is_active) throw new AppError("Email hoặc mật khẩu không đúng", 401);
    // Gõ đúng mã = email này đúng là của chủ tài khoản (trang con thì mã về email chủ chuỗi).
    if (!laTenDangNhapNoiBo(user.email)) {
      await query(
        "UPDATE users SET email_xac_thuc_at = now() WHERE id = $1 AND email_xac_thuc_at IS NULL",
        [user.id]
      );
    }
    await createSession(res, user.id);
    res.json({ success: true, user: await hoSoNguoiDung(user.id, null) });
  })
);


/**
 * Đổi mật khẩu khi đang đăng nhập.
 *
 * Trước đây hệ thống KHÔNG có đường nào đổi mật khẩu, và nút "Quên mật khẩu?"
 * chỉ là chữ trang trí. Với sản phẩm bán ra thị trường thì đó là lỗ hổng vận
 * hành: khách đổi máy, lộ mật khẩu, hay đơn giản là muốn đổi — đều bó tay.
 *
 * Bắt nhập lại mật khẩu hiện tại: chỉ cần một lần ai đó ngồi vào máy đang mở
 * sẵn là chiếm được tài khoản nếu bỏ bước này.
 */
authRouter.post(
  "/change-password",
  requireAuth,
  route(async (req, res) => {
    const body = req.body ?? {};
    const hienTai = requireString(body, "currentPassword", "mật khẩu hiện tại");
    // Mật khẩu mới: đúng chuỗi người dùng gõ, cùng một luật với mọi chỗ đặt mật khẩu (src/lib/mat-khau.ts).
    const moi = typeof body.newPassword === "string" ? body.newPassword : "";
    const loiMoi = loiMatKhau(moi);
    if (loiMoi) throw new AppError(loiMoi);
    if (moi === hienTai) {
      throw new AppError("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    const user = await queryOne<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user!.id]
    );
    if (!user) throw new AppError("Không tìm thấy tài khoản", 404);

    if (!(await verifyPassword(hienTai, user.password_hash))) {
      throw new AppError("Mật khẩu hiện tại không đúng", 401);
    }

    await query("UPDATE users SET password_hash = $2 WHERE id = $1", [
      req.user!.id,
      await hashPassword(moi),
    ]);

    /*
     * Huỷ mọi phiên khác, giữ lại phiên đang dùng.
     *
     * Đổi mật khẩu thường vì nghi bị lộ; để các phiên cũ sống tiếp thì việc đổi
     * chẳng có tác dụng gì. Gồm cả phiên xem thay đã mở bằng tài khoản này:
     * kẻ cầm mật khẩu bị lộ cũng mở được chúng.
     */
    const daXoa = await query(
      "DELETE FROM sessions WHERE (user_id = $1 OR mo_boi = $1) AND id <> $2",
      [req.user!.id, req.sessionId ?? ""]
    );

    res.json({
      success: true,
      message: `Đã đổi mật khẩu. Đã đăng xuất ${daXoa.rowCount ?? 0} phiên khác.`,
    });
  })
);

authRouter.post(
  "/logout",
  route(async (req, res) => {
    await destroySession(req, res);
    res.json({ success: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  route(async (req, res) => {
    /*
     * Kèm tên người đang xem thay, để giao diện hiện được dải băng "bạn đang
     * xem thay trang X — quay lại".
     *
     * Không có dải băng đó thì chủ chuỗi mở một trang ra xem rồi quên mất, gõ
     * vai trò AI hay trả lời khách trên tài khoản không phải của mình mà
     * không hề biết. Mà mọi màn hình đều trông y hệt nhau.
     */
    res.json({ success: true, user: await hoSoNguoiDung(req.user!.id, req.user!.moBoi) });
  })
);

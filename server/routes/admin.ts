/**
 * Quản trị hệ thống: quản lý mọi tài khoản shop.
 *
 * Nguyên tắc xuyên suốt tệp này:
 *
 * 1. Vai trò luôn đọc từ database mỗi request. Không bao giờ tin phía trình
 *    duyệt — ai sửa được vai trò trong dữ liệu gửi lên là chiếm được quyền
 *    quản trị của cả hệ thống, tức là toàn bộ dữ liệu khách hàng của mọi shop.
 *
 * 2. Tài khoản quản trị không tự khoá hay tự xoá được mình, cũng không đụng
 *    được vào tài khoản quản trị khác. Khoá nhầm tài khoản quản trị cuối cùng
 *    là không còn ai vào sửa được nữa.
 *
 * 3. Mọi việc đều ghi nhật ký. Sau này còn truy được ai khoá ai, ai xoá ai.
 */

import { Router } from "express";

import { requireAuth } from "../auth.js";
import { query, queryOne } from "../db.js";
import { AppError, route, chiNhanMaSo } from "../http.js";
import { sinhMatKhauTam, taoTaiKhoan, EMAIL_PATTERN } from "../services/tai-khoan.js";
import { ghiNhatKyQuanTri } from "../services/nhat-ky-quan-tri.js";
import { chuyenThanhChuChuoi } from "../services/chuyen-chu-chuoi.js";
import * as zernio from "../services/zernio.js";
import { hashPassword } from "../auth.js";
import { luuNguong, nhatKyLuot, saoKe } from "../services/chi-phi.js";
import { NHOM_VIEC, VIEC } from "../services/so-ai.js";
import { sendTelegramMessage } from "../services/telegram.js";

export const adminRouter = Router();

// Mọi :id ở đây là mã số — chữ lạ thì 404, không để database vỡ ra 500.
adminRouter.param("id", chiNhanMaSo);

adminRouter.use(requireAuth);

/** Chặn mọi người không phải quản trị. */
adminRouter.use((req, _res, next) => {
  if (req.user?.role !== "admin") {
    next(new AppError("Phần này chỉ dành cho tài khoản quản trị", 403));
    return;
  }
  next();
});


/** Lấy tài khoản đích và chặn sẵn các thao tác không được phép. */
async function layTaiKhoanDich(
  id: string,
  adminId: number,
  viec: "sua" | "khoa" | "xoa"
): Promise<{ id: number; email: string; name: string; role: string; is_active: boolean }> {
  const dich = await queryOne<{
    id: number;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  }>("SELECT id, email, name, role, is_active FROM users WHERE id = $1", [id]);

  if (!dich) throw new AppError("Không tìm thấy tài khoản này", 404);

  if (viec !== "sua" && dich.id === adminId) {
    throw new AppError(
      viec === "khoa"
        ? "Không tự khoá tài khoản của chính mình được."
        : "Không tự xoá tài khoản của chính mình được.",
      400
    );
  }

  if (viec !== "sua" && dich.role === "admin") {
    throw new AppError(
      "Không khoá hay xoá được tài khoản quản trị khác. Hạ vai trò xuống shop trước nếu thật sự cần.",
      400
    );
  }

  return dich;
}

/**
 * Danh sách tài khoản kèm số liệu vận hành.
 *
 * Gộp hết vào một truy vấn: mỗi tài khoản một lượt đếm riêng thì mười tài
 * khoản là mười một lượt gọi database cho một lần mở trang.
 */
adminRouter.get(
  "/accounts",
  route(async (req, res) => {
    const rows = await query(
      `SELECT u.id, u.email, u.name, u.plan, u.role, u.is_active, u.created_at,
              -- Dòng của chính người đang xem: giao diện thay nút "cấp lại mật khẩu" bằng "đổi mật khẩu".
              (u.id = $1) AS la_toi,
              (SELECT COUNT(*) FROM social_accounts s
                WHERE s.user_id = u.id AND s.connected)::int          AS kenh,
              (SELECT COUNT(*) FROM conversations c
                WHERE c.user_id = u.id)::int                          AS hoi_thoai,
              (SELECT COUNT(*) FROM conversations c
                WHERE c.user_id = u.id AND c.status = 'waiting_human')::int AS cho_nguoi,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id)::int   AS don,
              (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id)::int    AS bai,
              (SELECT COUNT(*) FROM ai_documents d WHERE d.user_id = u.id)::int AS tai_lieu,
              (SELECT MAX(m.sent_at) FROM messages m WHERE m.user_id = u.id) AS hoat_dong_cuoi,
              /*
               * Một tài khoản có thể có nhiều Trang, mỗi Trang một cấu hình.
               * Bảng quản trị chỉ liệt kê tổng quan nên lấy Trang đầu tiên;
               * không LIMIT thì truy vấn con trả nhiều dòng và lỗi ngay.
               */
              (SELECT a.settings->'tuChu'->>'bat' FROM ai_configs a
                 JOIN trang tr ON tr.id = a.trang_id
                WHERE tr.user_id = u.id AND a.kind = 'sales'
                ORDER BY tr.id LIMIT 1)                                AS tu_chu,
              (SELECT t.enabled FROM telegram_configs t WHERE t.user_id = u.id) AS telegram
         FROM users u
        ORDER BY u.created_at`,
      [req.user!.id]
    );
    res.json({ success: true, data: rows.rows });
  })
);

/** Nhật ký việc quản trị đã làm. */
adminRouter.get(
  "/audit",
  route(async (_req, res) => {
    const rows = await query(
      `SELECT a.id, a.action, a.target_id, a.target_email, a.detail, a.created_at,
              u.email AS admin_email
         FROM admin_audit a
         LEFT JOIN users u ON u.id = a.admin_id
        ORDER BY a.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows.rows });
  })
);

/**
 * Tạo tài khoản mới cho một shop.
 *
 * Đi qua đúng hàm mà người dùng tự đăng ký vẫn đi, nên tài khoản tạo ra giống
 * hệt: bộ cấu hình bốn AI riêng, quy tắc riêng, Telegram riêng, hồ sơ nền tảng
 * riêng, và ở trạng thái mặc định để chủ shop tự cài theo mục đích của họ.
 *
 * Không đặt mật khẩu hộ: sinh một mật khẩu tạm, trả về ĐÚNG MỘT LẦN cho quản
 * trị đưa lại chủ shop, rồi họ tự đổi.
 */
adminRouter.post(
  "/accounts",
  route(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!EMAIL_PATTERN.test(email.toLowerCase())) {
      throw new AppError("Địa chỉ email không hợp lệ");
    }

    /*
     * Quản trị tổng cấp được cả hai loại:
     *   'admin_con' — chủ chuỗi, tự lập các trang của mình về sau
     *   'shop'      — một tài khoản một trang, đứng riêng không thuộc chuỗi nào
     * Giá trị lạ rơi về 'shop', quyền thấp hơn. Đoán sai phải đoán về phía
     * ít quyền, không phải phía nhiều quyền.
     */
    const role = req.body?.role === "admin_con" ? "admin_con" : "shop";

    const matKhauTam = sinhMatKhauTam();
    const taiKhoan = await taoTaiKhoan({ email, password: matKhauTam, name, role });

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: taiKhoan.id,
      targetEmail: taiKhoan.email,
      action: "tao_tai_khoan",
      detail: { role },
    });

    res.status(201).json({
      success: true,
      data: { ...taiKhoan, matKhauTam },
    });
  })
);

/**
 * Chuyển một tài khoản đứng riêng thành tài khoản quản lý chuỗi.
 *
 * Dành cho tài khoản lập trước khi có luật "đăng ký là ra chủ chuỗi", hoặc lập
 * trúng lúc máy chủ đang chạy bản cũ — đã xảy ra thật. Không có đường này thì
 * những tài khoản đó vĩnh viễn kẹt ở đúng một Fanpage và không lập được trang
 * nào.
 */
adminRouter.post(
  "/accounts/:id/thanh-chu-chuoi",
  route(async (req, res) => {
    const dich = await layTaiKhoanDich(req.params.id, req.user!.id, "sua");
    const ketQua = await chuyenThanhChuChuoi(dich.id);

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: dich.id,
      targetEmail: dich.email,
      action: "chuyen_thanh_chu_chuoi",
      detail: { hoSoDaDon: ketQua.hoSoDaDon, loiDonHoSo: ketQua.loiDonHoSo },
    });

    res.json({ success: true, data: ketQua });
  })
);

/** Sửa tên, email, gói của một tài khoản. */
adminRouter.patch(
  "/accounts/:id",
  route(async (req, res) => {
    const dich = await layTaiKhoanDich(req.params.id, req.user!.id, "sua");

    const dat: string[] = [];
    const bien: unknown[] = [dich.id];
    const doi: Record<string, unknown> = {};

    if (typeof req.body?.name === "string") {
      bien.push(req.body.name.trim());
      dat.push(`name = $${bien.length}`);
      doi.name = req.body.name.trim();
    }
    if (typeof req.body?.email === "string") {
      const email = req.body.email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) throw new AppError("Địa chỉ email không hợp lệ");
      const trung = await queryOne("SELECT id FROM users WHERE lower(email) = $1 AND id <> $2", [
        email,
        dich.id,
      ]);
      if (trung) throw new AppError("Email này đã thuộc về tài khoản khác", 409);
      bien.push(email);
      dat.push(`email = $${bien.length}`);
      doi.email = email;
    }
    if (typeof req.body?.plan === "string" && req.body.plan.trim()) {
      bien.push(req.body.plan.trim());
      dat.push(`plan = $${bien.length}`);
      doi.plan = req.body.plan.trim();
    }

    if (dat.length === 0) throw new AppError("Không có gì để sửa");

    const updated = await queryOne(
      `UPDATE users SET ${dat.join(", ")}, updated_at = now()
        WHERE id = $1 RETURNING id, email, name, plan, role, is_active`,
      bien
    );

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: dich.id,
      targetEmail: dich.email,
      action: "sua_tai_khoan",
      detail: doi,
    });

    res.json({ success: true, data: updated });
  })
);

/**
 * Khoá hoặc mở khoá.
 *
 * Khoá dùng cột is_active vốn đã được thực thi ở hai chỗ: lúc đăng nhập, và
 * lúc kiểm phiên của MỌI request — nên người đang đăng nhập sẵn cũng bị đẩy ra
 * ngay lượt bấm tiếp theo, không phải chờ hết phiên.
 */
adminRouter.post(
  "/accounts/:id/lock",
  route(async (req, res) => {
    const khoa = req.body?.locked !== false;
    const dich = await layTaiKhoanDich(req.params.id, req.user!.id, "khoa");

    await query("UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1", [
      dich.id,
      !khoa,
    ]);

    // Khoá thì cắt luôn mọi phiên đang mở, không để họ dùng tiếp tới khi hết hạn.
    // Gồm cả phiên xem thay họ đã mở vào các trang con (mo_boi).
    if (khoa) {
      await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [dich.id]);
    }

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: dich.id,
      targetEmail: dich.email,
      action: khoa ? "khoa_tai_khoan" : "mo_khoa_tai_khoan",
    });

    res.json({ success: true, data: { id: dich.id, is_active: !khoa } });
  })
);

/** Cấp lại mật khẩu tạm khi chủ shop quên mật khẩu. */
adminRouter.post(
  "/accounts/:id/reset-password",
  route(async (req, res) => {
    const dich = await layTaiKhoanDich(req.params.id, req.user!.id, "sua");
    /*
     * Không tự cấp lại mật khẩu cho chính mình. Đã xảy ra 01/10/2026: quản trị
     * tổng bấm "Mật khẩu" trên dòng của mình → mật khẩu đổi, phiên đang dùng bị
     * cắt ngay, giao diện đá ra màn hình đăng nhập trước khi kịp thấy mật khẩu
     * tạm → tự khoá mình ngoài. Đổi mật khẩu của mình phải qua /auth/change-password
     * (nhập mật khẩu hiện tại, giữ phiên đang dùng).
     */
    if (dich.id === req.user!.id) {
      throw new AppError(
        "Không tự cấp lại mật khẩu cho chính mình được — làm vậy là tự khoá mình ngoài. " +
          "Dùng nút \"Đổi mật khẩu\": nhập mật khẩu hiện tại và mật khẩu mới do bạn tự đặt.",
        400
      );
    }
    const matKhauTam = sinhMatKhauTam();

    await query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [
      dich.id,
      await hashPassword(matKhauTam),
    ]);
    // Mật khẩu đã đổi thì mọi phiên cũ phải chết — kể cả phiên xem thay họ đã
    // mở vào các trang con: kẻ cầm mật khẩu bị lộ cũng mở được những phiên đó.
    await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [dich.id]);

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: dich.id,
      targetEmail: dich.email,
      action: "cap_lai_mat_khau",
    });

    res.json({ success: true, data: { matKhauTam } });
  })
);

/**
 * Xoá hẳn một tài khoản.
 *
 * Mọi bảng dữ liệu của shop đều xoá theo (19/19 khoá ngoại đặt ON DELETE
 * CASCADE), nên không để lại rác. Không lấy lại được.
 *
 * Bắt gõ đúng email để xác nhận: xoá nhầm là mất sạch khách hàng, hội thoại và
 * đơn hàng của một shop đang kinh doanh thật.
 */
adminRouter.delete(
  "/accounts/:id",
  route(async (req, res) => {
    const dich = await layTaiKhoanDich(req.params.id, req.user!.id, "xoa");

    const xacNhan = typeof req.body?.confirmEmail === "string" ? req.body.confirmEmail : "";
    if (xacNhan.trim().toLowerCase() !== dich.email.toLowerCase()) {
      throw new AppError(
        "Gõ đúng email của tài khoản để xác nhận xoá. Thao tác này không lấy lại được.",
        400
      );
    }

    /*
     * Lấy mã hồ sơ TRƯỚC khi xoá dòng tài khoản, vì xoá xong là mất đường tìm
     * lại. Xoá hồ sơ SAU khi xoá tài khoản: xoá hồ sơ trước mà lệnh xoá tài
     * khoản hỏng thì còn lại một tài khoản sống với hồ sơ đã chết.
     */
    const hoSo = await queryOne<{ profile_ref: string | null }>(
      "SELECT profile_ref FROM users WHERE id = $1",
      [dich.id]
    );

    await query("DELETE FROM users WHERE id = $1", [dich.id]);

    let loiXoaHoSo: string | null = null;
    if (hoSo?.profile_ref) {
      try {
        await zernio.xoaHoSo(hoSo.profile_ref);
      } catch (error) {
        /*
         * Không ném lỗi: tài khoản đã xoá xong rồi, ném ra đây chỉ làm người
         * dùng tưởng việc xoá thất bại. Nhưng phải GHI LẠI mã hồ sơ, không thì
         * nó nằm lại bên nhà cung cấp mà không ai biết để dọn — đúng cách đống
         * hồ sơ rác cũ đã hình thành.
         */
        loiXoaHoSo = error instanceof Error ? error.message : String(error);
        console.error(
          `[quản trị] Chưa xoá được hồ sơ ${hoSo.profile_ref} bên nhà cung cấp:`,
          loiXoaHoSo
        );
      }
    }

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: null,
      targetEmail: dich.email,
      action: "xoa_tai_khoan",
      detail: {
        name: dich.name,
        hoSo: hoSo?.profile_ref ?? null,
        loiXoaHoSo,
      },
    });

    res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Chi phí hệ thống: sao kê, ngưỡng cảnh báo, gửi thử cảnh báo
// ---------------------------------------------------------------------------

/** Sao kê toàn bộ chi phí trả cho bên thứ ba, đọc sống + sổ của app. */
adminRouter.get(
  "/chi-phi",
  route(async (req, res) => {
    // ngay=0: từ đầu tháng này (cùng kỳ với số "tháng này" nhà cung cấp báo).
    const ngay = Number(req.query.ngay);
    const soNgay = Number.isFinite(ngay) && ngay >= 0 ? ngay : 30;
    res.json({ success: true, data: await saoKe(soNgay) });
  })
);

/**
 * Nhật ký từng lượt AI bị tính tiền: lúc nào, tài khoản nào, việc gì, bao
 * nhiêu tiền, đã khớp với nhà cung cấp chưa. Lọc theo tài khoản / nhóm / việc.
 */
adminRouter.get(
  "/chi-phi/luot",
  route(async (req, res) => {
    const ngay = Number(req.query.ngay);
    const q = (k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string) : "");
    const tk = q("tk");
    const nhom = q("nhom");
    const viec = q("viec");
    res.json({
      success: true,
      data: await nhatKyLuot({
        soNgay: Number.isFinite(ngay) && ngay >= 0 ? ngay : 0,
        // "chung" = việc không thuộc tài khoản nào; bỏ trống = mọi tài khoản.
        taiKhoan: tk === "" ? undefined : tk === "chung" ? null : Number(tk) || undefined,
        kemCon: q("kemCon") === "1",
        // Chỉ nhận đúng tên nhóm/việc đã khai — không nhét chuỗi lạ vào truy vấn.
        nhom: nhom in NHOM_VIEC || nhom === "chua_phan_loai" ? nhom : undefined,
        viec: viec in VIEC || viec === "chua_phan_loai" ? viec : undefined,
        trang: Number(q("trang")) || 1,
      }),
    });
  })
);

/** Đổi ngưỡng cảnh báo (số dư tối thiểu, số ngày còn đủ tiêu, hệ số tiêu quá). */
adminRouter.put(
  "/chi-phi/nguong",
  route(async (req, res) => {
    const nguong = await luuNguong(req.body ?? {});
    await ghiNhatKyQuanTri({ adminId: req.user!.id, targetId: null, targetEmail: "", action: "doi_nguong_chi_phi", detail: { ...nguong } });
    res.json({ success: true, data: nguong });
  })
);

/** Gửi thử một cảnh báo tới Telegram của chính quản trị đang bấm. */
adminRouter.post(
  "/chi-phi/thu-canh-bao",
  route(async (req, res) => {
    const daGui = await sendTelegramMessage(
      req.user!.id,
      "✅ <b>Thử cảnh báo chi phí</b>\n\nTelegram đã liên kết đúng. Khi tiền AI sắp hết, tiêu bất thường hoặc nhà cung cấp kênh tạm dừng, cảnh báo sẽ về đây."
    );
    if (!daGui) {
      throw new AppError("Tài khoản này chưa liên kết Telegram. Vào mục Cảnh báo Telegram để liên kết trước.", 409);
    }
    res.json({ success: true });
  })
);

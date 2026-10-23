/**
 * Quản lý tài khoản: CHỈ quản trị tổng.
 *
 * Chủ dự án 18/10/2026: bỏ hẳn tầng chủ chuỗi (admin con) và tài khoản con. Mọi tài khoản mới là tài khoản dùng
 * thường — bản sao phần dùng thường của quản trị tổng: một chìa khoá đăng nhập, tự tạo nhiều cửa hàng, mỗi cửa hàng
 * một hồ sơ nền tảng + một bộ não. Tệp này còn lại phần quản trị tổng dùng: tổng quan tài sản, sao kê, báo cáo một
 * tài khoản, mở thẳng vào một tài khoản và quay lại.
 *
 * Nguyên tắc:
 * 1. Không tìm thấy thì trả 404, không trả 403 — trả 403 là xác nhận "tài khoản này có thật".
 * 2. Mọi việc đụng tới tài khoản khác đều ghi nhật ký, kể cả việc chỉ mở ra xem.
 */

import { Router } from "express";

import { createSession, requireAuth } from "../auth.js";
import { query, queryOne } from "../db.js";
import { AppError, route } from "../http.js";
import { MOC_THEO_TRANG } from "../moc-thoi-gian.js";
import { ghiNhatKyQuanTri } from "../services/nhat-ky-quan-tri.js";
import { layTongQuan } from "../services/tong-quan.js";
import { nhatKyLuot } from "../services/chi-phi.js";

export const quanLyRouter = Router();

quanLyRouter.use(requireAuth);


/**
 * Người THẬT đang ngồi trước màn hình: người đã mở phiên (mo_boi) nếu có, không thì chính tài khoản đang đăng nhập.
 * Vai trò đọc lại từ database — quyền mở / quay lại dựa trên người thật, không dựa trên tài khoản đang được mở.
 */
async function nguoiThat(req: { user?: { id: number; moBoi: number | null } }) {
  const id = req.user!.moBoi ?? req.user!.id;
  const r = await queryOne<{ id: number; role: string; is_active: boolean }>(
    "SELECT id, role, is_active FROM users WHERE id = $1",
    [id]
  );
  if (!r || !r.is_active) throw new AppError("Không quay lại được, vui lòng đăng nhập lại", 403);
  return r;
}

/**
 * Tài khoản người đang xem được xem báo cáo: chính mình; quản trị tổng (tự đăng nhập, không đang mở tài khoản khác)
 * — mọi tài khoản. Ngoài phạm vi → 404.
 */
async function taiKhoanTrongPhamVi(
  req: { user?: { id: number; role: string; moBoi: number | null } },
  id: unknown
): Promise<TrangCon> {
  const so = Number(id);
  if (Number.isInteger(so) && so > 0 && (so === req.user!.id || (req.user!.role === "admin" && req.user!.moBoi == null))) {
    const r = await queryOne<TrangCon>("SELECT id, email, name, is_active, created_at FROM users WHERE id = $1", [so]);
    if (r) return r;
  }
  throw new AppError("Không tìm thấy tài khoản này", 404);
}


interface TrangCon {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/** TỔNG QUAN tài sản cả hệ thống (services/tong-quan.ts) — chỉ quản trị tổng. */
quanLyRouter.get(
  "/tong-quan",
  route(async (req, res) => {
    if (req.user!.role !== "admin") throw new AppError("Phần này dành cho quản trị", 403);
    const ky = req.query.ky === "thang_truoc" ? "thang_truoc" : "thang_nay";
    res.json({ success: true, data: await layTongQuan({ loai: "tong" }, req.user!.id, ky) });
  })
);

/** Cửa hàng quản trị tổng được xem sao kê: mọi cửa hàng. Không có → 404. */
async function trangTrongPhamVi(user: { id: number; role: string }, giaTri: unknown): Promise<number> {
  if (user.role !== "admin") throw new AppError("Phần này dành cho quản trị", 403);
  const trangId = Number(giaTri);
  const thuoc = Number.isSafeInteger(trangId) ? await queryOne("SELECT id FROM trang WHERE id = $1", [trangId]) : null;
  if (!thuoc) throw new AppError("Không tìm thấy cửa hàng này", 404);
  return trangId;
}


/**
 * Sao kê từng lượt AI của MỘT TRANG — cùng một đường cho cả hai tầng. Quản trị tổng xem mọi trang; admin con chỉ trang
 * thuộc chuỗi mình (không thuộc thì 404, không xác nhận trang có tồn tại).
 */
quanLyRouter.get(
  "/sao-ke-trang",
  route(async (req, res) => {
    const trangId = await trangTrongPhamVi(req.user!, req.query.trangId);
    res.json({
      success: true,
      data: await nhatKyLuot({
        soNgay: 0,
        trangId,
        kyThang: req.query.ky === "thang_truoc" ? "thang_truoc" : "thang_nay",
        // Số theo trang chỉ tính từ mốc (duyệt 05/10/2026) — sao kê cùng kỳ với Tổng quan.
        tuLuc: MOC_THEO_TRANG,
        trang: Number(req.query.trang) || 1,
      }),
    });
  })
);

// Sức khoẻ, chuỗi 4 khâu và AI điều hành thuộc BỘ NÃO của từng trang → routes/dieu-hanh.ts (chủ dự án 10/10/2026).

/**
 * Báo cáo chi tiết của MỘT trang, xem từ tài khoản quản lý.
 *
 * Chủ sản phẩm hỏi thẳng: không truy cập vào trang con vẫn xem được số liệu,
 * thống kê, báo cáo chứ? Trước đó là CHƯA — bảng điều hành mới có số đếm tổng,
 * muốn xem kỹ phải bấm Mở trang, tức là rời khỏi tài khoản quản lý.
 *
 * Nay xem ngay tại chỗ. Trả về đúng những con số mà chính trang đó nhìn thấy
 * ở bảng điều khiển và trang thống kê của nó — CÙNG cách tính, chỉ khác là
 * đọc từ ngoài vào và chỉ đọc, không sửa được gì.
 *
 * Kỳ trước tính để biết tăng hay giảm, không gắn cứng phần trăm nào.
 */
quanLyRouter.get(
  "/trang/:id/bao-cao",
  route(async (req, res) => {
    const trang = await taiKhoanTrongPhamVi(req, req.params.id);
    const ngay = [7, 30, 90].includes(Number(req.query.ngay)) ? Number(req.query.ngay) : 7;

    const so = await queryOne<Record<string, string>>(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM orders
           WHERE user_id = $1 AND status <> 'cancelled'
             AND created_at >= now() - ($2 || ' days')::interval)        AS doanh_thu,
         (SELECT count(*) FROM orders
           WHERE user_id = $1 AND status <> 'cancelled'
             AND created_at >= now() - ($2 || ' days')::interval)        AS don,
         (SELECT count(*) FROM orders
           WHERE user_id = $1 AND closed_by = 'ai' AND status <> 'cancelled'
             AND created_at >= now() - ($2 || ' days')::interval)        AS don_ai_chot,
         (SELECT count(*) FROM conversations
           WHERE user_id = $1
             AND created_at >= now() - ($2 || ' days')::interval)        AS hoi_thoai,
         (SELECT count(*) FROM conversations
           WHERE user_id = $1 AND handoff_at IS NOT NULL
             AND handoff_at >= now() - ($2 || ' days')::interval)        AS nhuong_nguoi,
         (SELECT count(*) FROM messages
           WHERE user_id = $1 AND sender_type = 'ai'
             AND created_at >= now() - ($2 || ' days')::interval)        AS tin_ai,
         (SELECT count(*) FROM customers
           WHERE user_id = $1
             AND first_seen_at >= now() - ($2 || ' days')::interval)     AS khach_moi,
         (SELECT count(*) FROM customers
           WHERE user_id = $1 AND phone IS NOT NULL
             AND first_seen_at >= now() - ($2 || ' days')::interval)     AS khach_co_sdt`,
      [trang.id, String(ngay)]
    );

    const truoc = await queryOne<Record<string, string>>(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM orders
           WHERE user_id = $1 AND status <> 'cancelled'
             AND created_at >= now() - ($2 || ' days')::interval * 2
             AND created_at <  now() - ($2 || ' days')::interval)        AS doanh_thu,
         (SELECT count(*) FROM orders
           WHERE user_id = $1 AND status <> 'cancelled'
             AND created_at >= now() - ($2 || ' days')::interval * 2
             AND created_at <  now() - ($2 || ' days')::interval)        AS don,
         (SELECT count(*) FROM conversations
           WHERE user_id = $1
             AND created_at >= now() - ($2 || ' days')::interval * 2
             AND created_at <  now() - ($2 || ' days')::interval)        AS hoi_thoai`,
      [trang.id, String(ngay)]
    );

    const donGanDay = await query(
      `SELECT o.code, o.customer_name, o.product, o.quantity, o.total,
              o.status, o.closed_by, o.created_at
         FROM orders o WHERE o.user_id = $1
        ORDER BY o.created_at DESC LIMIT 5`,
      [trang.id]
    );

    // Khách đã nhường cho người thật, cũ nhất lên trước vì để lâu là mất khách.
    const canGap = await query(
      `SELECT c.id, c.handoff_reason, c.last_message_at, c.platform,
              cu.name AS customer_name
         FROM conversations c
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE c.user_id = $1 AND c.status = 'waiting_human'
        ORDER BY c.last_message_at ASC LIMIT 5`,
      [trang.id]
    );

    res.json({
      success: true,
      data: {
        trang: { id: trang.id, name: trang.name },
        ngay,
        so: so ?? {},
        truoc: truoc ?? {},
        donGanDay: donGanDay.rows,
        canGap: canGap.rows,
      },
    });
  })
);

/**
 * Mở thẳng vào một tài khoản để làm việc (quản trị tổng hỗ trợ khách).
 *
 * Phiên cũ của chính người mở bị xoá chứ không giữ song song: giữ hai phiên sống cùng lúc là để lại một mã phiên còn
 * hiệu lực mà không ai cầm. Đang ở trong một tài khoản cũng mở thẳng sang tài khoản khác được — mo_boi giữ nguyên là
 * quản trị tổng nên đường quay ra vẫn chỉ đúng một bậc.
 */
quanLyRouter.post(
  "/trang/:id/mo",
  route(async (req, res) => {
    // Chỉ quản trị tổng; mở được MỌI tài khoản không phải quản trị. Quyền xét theo NGƯỜI THẬT (mo_boi).
    const that = await nguoiThat(req);
    const chaId = that.id;
    if (that.role !== "admin") throw new AppError("Không tìm thấy tài khoản này", 404);
    const so = Number(req.params.id);
    const trang = Number.isInteger(so) && so > 0
      ? await queryOne<TrangCon>("SELECT id, email, name, is_active, created_at FROM users WHERE id = $1 AND role <> 'admin'", [so])
      : null;
    if (!trang) throw new AppError("Không tìm thấy tài khoản này", 404);
    if (!trang.is_active) {
      throw new AppError("Tài khoản này đang bị khoá, vui lòng mở khoá trước", 409);
    }
    if (trang.id === req.user!.id) {
      throw new AppError("Bạn đang ở trong tài khoản này rồi", 409);
    }

    const phienCu = req.sessionId;
    await createSession(res, trang.id, chaId);
    if (phienCu) await query("DELETE FROM sessions WHERE id = $1", [phienCu]);

    await ghiNhatKyQuanTri({
      adminId: chaId,
      targetId: trang.id,
      targetEmail: trang.email,
      action: "mo_trang",
    });

    res.json({ success: true, data: { id: trang.id, name: trang.name } });
  })
);

/** Quay lại tài khoản quản trị sau khi mở một tài khoản. */
quanLyRouter.post(
  "/quay-lai",
  route(async (req, res) => {
    const moBoi = req.user!.moBoi;
    if (moBoi === null) {
      throw new AppError("Bạn đang ở tài khoản của chính mình", 400);
    }

    /*
     * Kiểm lại ngay lúc quay ra, không chỉ tin vào mo_boi đã ghi lúc mở: giữa hai thời điểm đó tài khoản quản trị có
     * thể đã bị khoá hoặc bị hạ vai trò. Cùng luật với phiên (auth.ts).
     */
    const cha = await queryOne<{ id: number; email: string; name: string }>(
      `SELECT c.id, c.email, c.name
         FROM users c, users t
        WHERE c.id = $1 AND t.id = $2 AND c.is_active = TRUE
          AND c.role = 'admin' AND t.role <> 'admin'`,
      [moBoi, req.user!.id]
    );
    if (!cha) {
      throw new AppError("Không quay lại được, vui lòng đăng nhập lại", 403);
    }

    const phienCu = req.sessionId;
    await createSession(res, cha.id, null);
    if (phienCu) await query("DELETE FROM sessions WHERE id = $1", [phienCu]);

    await ghiNhatKyQuanTri({
      adminId: cha.id,
      targetId: req.user!.id,
      targetEmail: req.user!.email,
      action: "roi_trang",
    });

    res.json({ success: true, data: { id: cha.id, name: cha.name } });
  })
);

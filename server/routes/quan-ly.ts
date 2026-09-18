/**
 * Quản lý chuỗi trang: dành cho tài khoản 'admin_con'.
 *
 * Mô hình: MỖI TÀI KHOẢN MỘT TRANG, độc lập hoàn toàn — hộp thư riêng, đơn
 * hàng riêng, bộ não riêng, hồ sơ nền tảng riêng. Không dùng chung gì thì
 * không có đường nào để hai trang lẫn dữ liệu vào nhau.
 *
 * Admin con đứng trên nhóm tài khoản trang của mình: lập thêm trang, xem tổng
 * quan, và mở thẳng vào từng trang khi cần làm việc.
 *
 * Nguyên tắc xuyên suốt tệp này:
 *
 * 1. MỌI truy vấn nhắm vào tài khoản khác đều phải kèm parent_id = mình. Không
 *    có ngoại lệ. Thiếu một chỗ là admin con này với tay sang được trang của
 *    admin con khác — tức là toàn bộ khách hàng và doanh thu của họ.
 *
 * 2. Không tìm thấy thì trả 404, không trả 403. Trả 403 là xác nhận "tài khoản
 *    này có thật, chỉ là không phải của anh" — đủ để dò ra ai đang dùng hệ
 *    thống.
 *
 * 3. Mọi việc đụng tới tài khoản khác đều ghi nhật ký, kể cả việc chỉ mở ra xem.
 */

import { Router } from "express";

import { createSession, requireAuth } from "../auth.js";
import { query, queryOne } from "../db.js";
import { AppError, route } from "../http.js";
import { DAU_NGAY_VN, DAU_THANG_VN } from "../moc-thoi-gian.js";
import { ghiNhatKyQuanTri } from "../services/nhat-ky-quan-tri.js";
import { chanNeuHetSuatTrang } from "../services/gioi-han.js";
import { sinhMatKhauTam, taoTaiKhoanTrang } from "../services/tai-khoan.js";
import { hashPassword } from "../auth.js";

export const quanLyRouter = Router();

quanLyRouter.use(requireAuth);

/*
 * Chặn theo ĐƯỜNG DẪN, không chặn cả router.
 *
 * Lúc đang xem thay một trang thì vai trò của phiên là 'shop' — đó là điểm
 * chính của cách ly. Nếu chặn cả router theo vai trò thì chính người đang xem
 * thay lại không gọi được /quay-lai và mắc kẹt trong tài khoản trang, phải xoá
 * cookie tay mới ra được. Đã suýt làm đúng như vậy.
 */
quanLyRouter.use("/trang", (req, _res, next) => {
  if (req.user?.role !== "admin_con" && req.user?.role !== "admin") {
    next(new AppError("Phần này dành cho tài khoản quản lý chuỗi trang", 403));
    return;
  }
  next();
});

interface TrangCon {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Lấy một tài khoản trang CỦA MÌNH.
 *
 * Điều kiện parent_id nằm ngay trong câu lệnh chứ không kiểm sau khi lấy về:
 * kiểm sau thì sớm muộn có đường nào đó quên kiểm, còn điều kiện trong câu
 * lệnh thì không có đường nào đi vòng qua được.
 */
async function trangCuaToi(chaId: number, id: unknown): Promise<TrangCon> {
  const so = Number(id);
  if (!Number.isInteger(so) || so <= 0) {
    throw new AppError("Không tìm thấy trang này", 404);
  }
  const row = await queryOne<TrangCon>(
    `SELECT id, email, name, is_active, created_at
       FROM users WHERE id = $1 AND parent_id = $2`,
    [so, chaId]
  );
  if (!row) throw new AppError("Không tìm thấy trang này", 404);
  return row;
}

/**
 * Bảng tổng quan: mỗi trang một dòng, số liệu thật.
 *
 * Gộp trong một câu lệnh thay vì hỏi vòng từng trang: chuỗi mười trang mà hỏi
 * vòng là mười lượt đi về database cho mỗi lần mở màn hình.
 */
quanLyRouter.get(
  "/trang",
  route(async (req, res) => {
    const rows = await query(
      `SELECT u.id, u.email, u.name, u.is_active, u.plan, u.created_at,
              (SELECT count(*)::int FROM social_accounts s
                WHERE s.user_id = u.id AND s.connected) AS kenh_noi,
              (SELECT count(*)::int FROM social_accounts s
                WHERE s.user_id = u.id AND s.needs_reconnection) AS kenh_can_noi_lai,
              (SELECT count(*)::int FROM orders o
                WHERE o.user_id = u.id AND o.created_at >= ${DAU_NGAY_VN}) AS don_hom_nay,
              (SELECT COALESCE(SUM(o.total), 0)::bigint FROM orders o
                WHERE o.user_id = u.id AND o.created_at >= ${DAU_THANG_VN}
                  AND o.status <> 'cancelled') AS doanh_thu_thang,
              (SELECT count(*)::int FROM conversations c
                WHERE c.user_id = u.id AND c.status = 'waiting_human') AS cho_nguoi,
              (SELECT s.display_name FROM social_accounts s
                WHERE s.user_id = u.id AND s.platform = 'facebook'
                ORDER BY s.created_at LIMIT 1) AS ten_fanpage
         FROM users u
        WHERE u.parent_id = $1
        ORDER BY u.created_at`,
      [req.user!.id]
    );
    res.json({ success: true, data: rows.rows });
  })
);

/** Lập thêm một trang. Mật khẩu tạm trả về ĐÚNG MỘT LẦN, sau đó không đọc lại được. */
quanLyRouter.post(
  "/trang",
  route(async (req, res) => {
    const ten = typeof req.body?.ten === "string" ? req.body.ten : "";
    await chanNeuHetSuatTrang(req.user!.id, req.user!.plan);
    const taiKhoan = await taoTaiKhoanTrang({ parentId: req.user!.id, tenTrang: ten });

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: taiKhoan.id,
      targetEmail: taiKhoan.email,
      action: "lap_trang",
      detail: { ten: taiKhoan.name },
    });

    res.status(201).json({
      success: true,
      data: {
        id: taiKhoan.id,
        tenDangNhap: taiKhoan.email,
        name: taiKhoan.name,
        matKhauTam: taiKhoan.matKhauTam,
      },
    });
  })
);

/** Đổi tên hiển thị của một trang. */
quanLyRouter.patch(
  "/trang/:id",
  route(async (req, res) => {
    const trang = await trangCuaToi(req.user!.id, req.params.id);
    const ten = typeof req.body?.ten === "string" ? req.body.ten.trim() : "";
    if (ten.length < 2) throw new AppError("Tên trang phải có ít nhất 2 ký tự");

    await query("UPDATE users SET name = $1, updated_at = now() WHERE id = $2", [ten, trang.id]);
    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: trang.id,
      targetEmail: trang.email,
      action: "doi_ten_trang",
      detail: { truoc: trang.name, sau: ten },
    });
    res.json({ success: true, data: { id: trang.id, name: ten } });
  })
);

/** Khoá hoặc mở khoá một trang. Khoá thì phiên đang mở cũng phải chết ngay. */
quanLyRouter.post(
  "/trang/:id/khoa",
  route(async (req, res) => {
    const trang = await trangCuaToi(req.user!.id, req.params.id);
    const khoa = req.body?.khoa === true;

    await query("UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2", [
      !khoa,
      trang.id,
    ]);
    /*
     * Khoá mà không xoá phiên thì người đang đăng nhập vẫn dùng tiếp như
     * thường cho tới khi phiên hết hạn — khoá như không khoá.
     */
    if (khoa) await query("DELETE FROM sessions WHERE user_id = $1", [trang.id]);

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: trang.id,
      targetEmail: trang.email,
      action: khoa ? "khoa_trang" : "mo_khoa_trang",
    });
    res.json({ success: true, data: { id: trang.id, is_active: !khoa } });
  })
);

/** Cấp lại mật khẩu cho một trang. */
quanLyRouter.post(
  "/trang/:id/mat-khau",
  route(async (req, res) => {
    const trang = await trangCuaToi(req.user!.id, req.params.id);
    const matKhauTam = sinhMatKhauTam();

    await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
      await hashPassword(matKhauTam),
      trang.id,
    ]);
    // Đổi mật khẩu thì mọi phiên cũ phải chết, kể cả phiên của người vừa mất quyền.
    await query("DELETE FROM sessions WHERE user_id = $1", [trang.id]);

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: trang.id,
      targetEmail: trang.email,
      action: "cap_lai_mat_khau_trang",
    });
    res.json({ success: true, data: { id: trang.id, matKhauTam } });
  })
);

/**
 * Mở thẳng vào một trang để làm việc.
 *
 * Vì sao cần: mô hình mỗi trang một tài khoản cho cách ly tuyệt đối, nhưng
 * chủ chuỗi mười trang mà phải nhớ mười tên đăng nhập và đăng xuất đăng nhập
 * mười lần mỗi sáng thì không ai dùng nổi. Mở từ đây là MỘT lần đăng nhập mà
 * dữ liệu vẫn tách hẳn — không có gì dùng chung, chỉ có quyền bước vào.
 *
 * Phiên cũ của chính người mở bị xoá chứ không giữ song song: giữ hai phiên
 * sống cùng lúc là để lại một mã phiên còn hiệu lực mà không ai cầm.
 */
quanLyRouter.post(
  "/trang/:id/mo",
  route(async (req, res) => {
    const trang = await trangCuaToi(req.user!.id, req.params.id);
    if (!trang.is_active) {
      throw new AppError("Trang này đang bị khoá, vui lòng mở khoá trước", 409);
    }

    /*
     * Không cho mở lồng nhau: đang xem thay một trang rồi mở tiếp sang trang
     * khác thì đường quay lại đứt, người dùng mắc kẹt trong một tài khoản
     * không phải của mình.
     *
     * Đã đo qua HTTP thật: hiện chốt này KHÔNG bao giờ chạy tới, vì lúc đang
     * xem thay thì vai trò của phiên là 'shop' nên chặn theo vai trò ở trên đã
     * trả 403 trước. Giữ lại làm lớp thứ hai, phòng khi sau này có vai trò nào
     * vừa mở được trang vừa giữ nguyên quyền quản lý. Ai đọc tới đây đừng
     * tưởng đây là chốt duy nhất — chốt thật là chặn theo vai trò.
     */
    if (req.user!.moBoi !== null) {
      throw new AppError("Vui lòng quay lại tài khoản quản lý trước khi mở trang khác", 409);
    }

    const phienCu = req.sessionId;
    await createSession(res, trang.id, req.user!.id);
    if (phienCu) await query("DELETE FROM sessions WHERE id = $1", [phienCu]);

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: trang.id,
      targetEmail: trang.email,
      action: "mo_trang",
    });

    res.json({ success: true, data: { id: trang.id, name: trang.name } });
  })
);

/** Quay lại tài khoản quản lý sau khi xem thay một trang. */
quanLyRouter.post(
  "/quay-lai",
  route(async (req, res) => {
    const moBoi = req.user!.moBoi;
    if (moBoi === null) {
      throw new AppError("Bạn đang ở tài khoản của chính mình", 400);
    }

    /*
     * Kiểm lại quan hệ cha con ngay lúc quay ra, không chỉ tin vào mo_boi đã
     * ghi lúc mở. Giữa hai thời điểm đó tài khoản quản lý có thể đã bị khoá,
     * bị hạ vai trò, hoặc trang này đã được chuyển sang người khác.
     */
    const cha = await queryOne<{ id: number; email: string; name: string }>(
      `SELECT c.id, c.email, c.name
         FROM users c
         JOIN users t ON t.parent_id = c.id
        WHERE c.id = $1 AND t.id = $2
          AND c.is_active = TRUE AND c.role IN ('admin', 'admin_con')`,
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

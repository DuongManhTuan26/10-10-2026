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
import { sinhMatKhauTam, taoTaiKhoanTrang } from "../services/tai-khoan.js";
import * as zernio from "../services/zernio.js";
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
  if (nguoiQuanLy(req) === null) {
    next(new AppError("Phần này dành cho tài khoản quản lý chuỗi trang", 403));
    return;
  }
  next();
});

/**
 * Ai là người quản lý đứng sau yêu cầu này.
 *
 * Đang XEM THAY một trang thì vai trò của phiên là 'shop', nhưng người thật
 * ngồi trước màn hình vẫn là chủ chuỗi đã mở trang đó — mã của họ nằm ở
 * mo_boi. Không nhìn tới mo_boi thì vào trong một trang là mất hẳn đường sang
 * trang khác: phải quay ra rồi mới mở được trang kế, hai bước qua một màn hình
 * trung gian cho mỗi lần đổi trang.
 *
 * Chỉ phiên do chủ chuỗi MỞ mới mang mo_boi. Tài khoản trang tự đăng nhập bằng
 * mật khẩu của nó có mo_boi rỗng, nên không nhìn thấy trang anh em nào — cách
 * ly giữa các trang vẫn nguyên vẹn.
 */
function nguoiQuanLy(req: { user?: { id: number; role: string; moBoi: number | null } }):
  | number
  | null {
  if (req.user?.moBoi != null) return req.user.moBoi;
  if (req.user?.role === "admin_con" || req.user?.role === "admin") return req.user.id;
  return null;
}

/**
 * Chặn các việc CHỈ chủ chuỗi thật mới được làm.
 *
 * Xem danh sách và nhảy sang trang khác thì phiên xem thay làm được — đó là
 * đi lại trong chính chuỗi của mình. Nhưng lập trang, đổi tên, khoá, cấp lại
 * mật khẩu thì phải đang đứng ở tài khoản quản lý: đó là quyền trên tài khoản
 * khác, không phải quyền đi lại.
 */
function chanNeuDangXemThay(req: { user?: { moBoi: number | null } }): void {
  if (req.user?.moBoi != null) {
    throw new AppError(
      "Vui lòng quay lại tài khoản quản lý để làm việc này",
      409
    );
  }
}

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
      [nguoiQuanLy(req)]
    );
    res.json({ success: true, data: rows.rows });
  })
);

/**
 * Bảng điều hành cả chuỗi: mọi trang, mọi số liệu, trên MỘT màn hình.
 *
 * Đây mới là việc chính của tài khoản quản lý. Bản đầu tôi làm nó thành một
 * danh sách tài khoản kèm ba con số — chủ sản phẩm chỉ ra ngay là thiếu: chủ
 * chuỗi cần nhìn một màn hình biết cả năm trang đang chạy ra sao, chỗ nào
 * đang hỏng, chỗ nào có khách chờ, chứ không phải bấm vào từng trang mới biết.
 *
 * Ba tầng, đúng thứ tự người điều hành cần:
 *   1. Tổng cả chuỗi  — hôm nay bán được bao nhiêu, bao nhiêu khách đang chờ
 *   2. Việc phải xử lý — trang nào mất kết nối, chưa dạy AI, đang im lặng
 *   3. Từng trang     — tình trạng vận hành chi tiết để so sánh giữa các trang
 *
 * Gộp trong MỘT câu lệnh thay vì hỏi vòng từng trang: chuỗi mười trang mà hỏi
 * vòng là mười lượt đi về database cho mỗi lần mở màn hình.
 */
quanLyRouter.get(
  "/tong-quan",
  route(async (req, res) => {
    const chaId = nguoiQuanLy(req);

    const rows = await query(
      `SELECT u.id, u.email, u.name, u.is_active, u.plan, u.created_at,

              /* --- Kênh: trang có đang nối được với Facebook không --- */
              (SELECT count(*)::int FROM social_accounts s
                WHERE s.user_id = u.id AND s.connected) AS kenh_noi,
              (SELECT count(*)::int FROM social_accounts s
                WHERE s.user_id = u.id AND s.needs_reconnection) AS kenh_can_noi_lai,
              (SELECT s.display_name FROM social_accounts s
                WHERE s.user_id = u.id AND s.platform = 'facebook'
                ORDER BY s.created_at LIMIT 1) AS ten_fanpage,

              /* --- Bộ não: AI đã được dạy chưa, hay vẫn trống --- */
              (SELECT count(*)::int FROM ai_configs c
                WHERE c.user_id = u.id AND c.kind = 'sales'
                  AND coalesce(c.system_prompt, '') <> '') AS da_day_vai_tro,
              (SELECT count(*)::int FROM ai_documents d
                WHERE d.user_id = u.id AND d.kind = 'sales') AS so_tai_lieu,
              (SELECT coalesce((c.settings -> 'tuChu' ->> 'bat')::boolean, FALSE)
                 FROM ai_configs c
                WHERE c.user_id = u.id AND c.kind = 'sales' LIMIT 1) AS ai_tu_chu,
              (SELECT count(*)::int FROM auto_scripts a
                WHERE a.user_id = u.id AND a.is_active) AS kich_ban_bat,

              /* --- Vận hành 7 ngày: trang này còn sống hay đã im --- */
              (SELECT count(*)::int FROM messages m
                WHERE m.user_id = u.id AND m.created_at >= now() - interval '7 days') AS tin_7_ngay,
              (SELECT count(*)::int FROM messages m
                WHERE m.user_id = u.id AND m.sender_type = 'ai'
                  AND m.created_at >= now() - interval '7 days') AS ai_tra_loi_7_ngay,
              (SELECT max(m.created_at) FROM messages m WHERE m.user_id = u.id) AS hoat_dong_cuoi,

              /* --- Cần người: khách đang đợi chủ shop trả lời --- */
              (SELECT count(*)::int FROM conversations c
                WHERE c.user_id = u.id AND c.status = 'waiting_human') AS cho_nguoi,

              /* --- Kết quả --- */
              (SELECT count(*)::int FROM orders o
                WHERE o.user_id = u.id AND o.created_at >= ${DAU_NGAY_VN}) AS don_hom_nay,
              (SELECT count(*)::int FROM orders o
                WHERE o.user_id = u.id AND o.created_at >= ${DAU_THANG_VN}
                  AND o.status <> 'cancelled') AS don_thang,
              (SELECT COALESCE(SUM(o.total), 0)::bigint FROM orders o
                WHERE o.user_id = u.id AND o.created_at >= ${DAU_THANG_VN}
                  AND o.status <> 'cancelled') AS doanh_thu_thang
         FROM users u
        WHERE u.parent_id = $1
        ORDER BY u.created_at`,
      [chaId]
    );

    res.json({ success: true, data: rows.rows });
  })
);

/** Lập thêm một trang. Mật khẩu tạm trả về ĐÚNG MỘT LẦN, sau đó không đọc lại được. */
quanLyRouter.post(
  "/trang",
  route(async (req, res) => {
    chanNeuDangXemThay(req);
    const ten = typeof req.body?.ten === "string" ? req.body.ten : "";
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
    chanNeuDangXemThay(req);
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
    chanNeuDangXemThay(req);
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
    chanNeuDangXemThay(req);
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
 * Xoá hẳn một trang.
 *
 * Chủ chuỗi lập nhầm một trang thì phải tự dọn được, không thì phải đi nhờ
 * quản trị tổng — mà trang bỏ đó vẫn giữ một hồ sơ bên nhà cung cấp.
 *
 * Bắt gõ đúng TÊN TRANG để xác nhận. Nút xoá nằm cạnh nút khoá trong cùng một
 * menu, bấm nhầm là mất sạch hộp thư, đơn hàng, khách hàng và bộ não của trang
 * đó — không lấy lại được.
 */
quanLyRouter.delete(
  "/trang/:id",
  route(async (req, res) => {
    chanNeuDangXemThay(req);
    const trang = await trangCuaToi(req.user!.id, req.params.id);

    const xacNhan = typeof req.body?.xacNhanTen === "string" ? req.body.xacNhanTen : "";
    if (xacNhan.trim() !== trang.name.trim()) {
      throw new AppError(
        "Gõ đúng tên trang để xác nhận xoá. Thao tác này không lấy lại được.",
        400
      );
    }

    /*
     * Lấy mã hồ sơ TRƯỚC khi xoá dòng tài khoản, vì xoá xong là mất đường tìm
     * lại. Xoá hồ sơ SAU: xoá hồ sơ trước mà lệnh xoá tài khoản hỏng thì còn
     * lại một tài khoản sống với hồ sơ đã chết.
     */
    const hoSo = await queryOne<{ profile_ref: string | null }>(
      "SELECT profile_ref FROM users WHERE id = $1",
      [trang.id]
    );

    await query("DELETE FROM users WHERE id = $1", [trang.id]);

    let loiXoaHoSo: string | null = null;
    if (hoSo?.profile_ref) {
      try {
        await zernio.xoaHoSo(hoSo.profile_ref);
      } catch (error) {
        // Trang đã xoá xong rồi, ném lỗi ra đây chỉ làm người dùng tưởng thất
        // bại. Nhưng phải GHI LẠI mã hồ sơ, không thì nó nằm lại mà không ai
        // biết để dọn — đúng cách đống hồ sơ rác cũ đã hình thành.
        loiXoaHoSo = error instanceof Error ? error.message : String(error);
        console.error(`[chuỗi] Chưa xoá được hồ sơ ${hoSo.profile_ref}:`, loiXoaHoSo);
      }
    }

    await ghiNhatKyQuanTri({
      adminId: req.user!.id,
      targetId: null,
      targetEmail: trang.email,
      action: "xoa_trang",
      detail: { ten: trang.name, hoSo: hoSo?.profile_ref ?? null, loiXoaHoSo },
    });

    res.json({ success: true, data: { loiXoaHoSo } });
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
 *
 * ĐANG Ở TRONG MỘT TRANG cũng mở thẳng sang trang khác được.
 *
 * Trước đây chặn: đang xem thay thì phải quay ra tài khoản quản lý rồi mới mở
 * được trang kế. Chủ chuỗi mười trang đi một vòng kiểm hàng phải qua màn hình
 * trung gian chín lần — hai phần rời hẳn nhau. Nay nhảy thẳng, và mo_boi giữ
 * nguyên là chủ chuỗi nên không có chuyện lồng nhau: đường quay ra vẫn chỉ
 * đúng một bậc.
 */
quanLyRouter.post(
  "/trang/:id/mo",
  route(async (req, res) => {
    const chaId = nguoiQuanLy(req)!;
    const trang = await trangCuaToi(chaId, req.params.id);
    if (!trang.is_active) {
      throw new AppError("Trang này đang bị khoá, vui lòng mở khoá trước", 409);
    }
    if (trang.id === req.user!.id) {
      throw new AppError("Bạn đang ở trong trang này rồi", 409);
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

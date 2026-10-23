/**
 * AI ĐIỀU HÀNH — thành viên thứ 4 của BỘ NÃO (chủ dự án 10/10/2026): 4 AI (viết bài, quảng cáo, bán hàng, điều hành)
 * là MỘT bộ não liền mạch gắn với từng trang; chọn trang N → bộ não N. Mọi đường ở đây làm việc với TRANG ĐANG CHỌN
 * của chính người đăng nhập (ngữ cảnh trang suy từ kênh đang chọn — app.ts, máy chủ tự kiểm kênh thuộc ai), giống hệt
 * 3 AI kia. Không còn nằm ở màn hình quản trị.
 *
 * Báo cáo dùng ĐÚNG các hàm đã có (không viết bản thứ hai): tiền theo trang = layTongQuan (phạm vi một tài khoản),
 * chuỗi 4 khâu = baoCaoChuoi, sức khoẻ = sucKhoeTrang. Chế độ ĐỀ XUẤT: chạy thử không thực thi gì.
 */
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { query, queryOne } from "../db.js";
import { AppError, route } from "../http.js";
import { chanLamDungAI } from "../services/chong-lam-dung.js";
import { trangHienTai } from "../services/ngu-canh-trang.js";
import { layTongQuan, kyTinh, type KyTongQuan } from "../services/tong-quan.js";
import { baoCaoChuoi } from "../services/bao-cao-chuoi.js";
import { sucKhoeTrang } from "../services/suc-khoe.js";
import { soBangChungTrang } from "../services/so-bang-chung.js";
import { hangBangChung } from "../services/kiem-cung.js";
import { dieuHanhMotLan, goiAiThat, khoBangChung } from "../services/dieu-hanh.js";
import { chuShopQuyet, deXuatGanDay, luuDeXuat, soDoDieuHanh, trangCuaDeXuat } from "../services/so-loi.js";
import { dangChayDieuHanh, luotHomNay, vanDeTuDong } from "../services/dieu-hanh-ngay.js";

export const dieuHanhRouter = Router();
dieuHanhRouter.use(requireAuth);

/** Trang của bộ não đang làm việc — luôn thuộc người đăng nhập (ngữ cảnh đã kiểm kênh thuộc ai). */
async function trangCuaToi(userId: number): Promise<number> {
  const trangId = await trangHienTai();
  const r = trangId ? await queryOne("SELECT 1 FROM trang WHERE id = $1 AND user_id = $2", [trangId, userId]) : null;
  if (!r) throw new AppError("Chưa có cửa hàng nào — nối kênh bán hàng trước", 400);
  return trangId!;
}

const docKy = (v: unknown): KyTongQuan => (v === "thang_truoc" ? "thang_truoc" : "thang_nay");

// Vấn đề do CODE chọn từ bảng sức khoẻ: vanDeTuDong (services/dieu-hanh-ngay.ts — dùng chung với lượt chấm hằng ngày).

/** Báo cáo năng suất / hiệu suất của 3 AI nhân viên cho trang đang chọn: tiền, chuỗi 4 khâu, theo ngày, sức khoẻ. */
dieuHanhRouter.get(
  "/bao-cao",
  route(async (req, res) => {
    const userId = req.user!.id;
    const trangId = await trangCuaToi(userId);
    const ky = docKy(req.query.ky);
    const kt = kyTinh(ky);
    const [tq, chuoi, sk, theoNgay] = await Promise.all([
      layTongQuan({ loai: "tai_khoan", userId }, userId, ky),
      baoCaoChuoi(trangId, ky),
      sucKhoeTrang(trangId),
      // Doanh thu / đơn / hội thoại mới theo NGÀY (giờ VN) của RIÊNG trang này — đơn chỉ có trang từ mốc ghi theo trang.
      query<{ ngay: string; doanh_thu: string; don: number; hoi_thoai: number }>(
        `SELECT to_char(d.ngay, 'DD/MM') AS ngay,
                coalesce((SELECT sum(o.total) FROM orders o WHERE o.trang_id = $1 AND o.status <> 'cancelled'
                   AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.ngay), 0)::text AS doanh_thu,
                (SELECT count(*) FROM orders o WHERE o.trang_id = $1 AND o.status <> 'cancelled'
                   AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.ngay)::int AS don,
                (SELECT count(*) FROM conversations c
                  WHERE c.trang_id = $1 AND (c.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.ngay)::int AS hoi_thoai
           FROM generate_series(($2::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
                                (($3::timestamptz - interval '1 second') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day') AS d(ngay)
          ORDER BY d.ngay`,
        [trangId, kt.tu, kt.den]
      ),
    ]);
    const trang = tq.taiKhoan.flatMap((t) => t.trang).find((t) => t.id === trangId) ?? null;
    res.json({ success: true, data: {
      trangId, trang, kyTinh: tq.kyTinh, chot: tq.chot, chuoi, sucKhoe: sk,
      theoNgay: theoNgay.rows.map((r) => ({ ngay: r.ngay, doanhThu: Number(r.doanh_thu), don: r.don, hoiThoai: r.hoi_thoai })),
    } });
  })
);

/** Sổ bằng chứng của trang — chỉ đọc, KHÔNG gọi AI, không tốn tiền. */
dieuHanhRouter.get(
  "/so",
  route(async (req, res) => {
    const userId = req.user!.id;
    const trangId = await trangCuaToi(userId);
    const [so, sk, soDo] = await Promise.all([soBangChungTrang(userId, trangId), sucKhoeTrang(trangId),
      soDoDieuHanh(trangId, new Date(Date.now() - 30 * 86_400_000))]);
    const kho = khoBangChung(so);
    res.json({ success: true, data: {
      bangChung: kho.map((b) => ({ ma: b.ma, nguon: b.nguon, noiDung: b.noiDung, hang: hangBangChung(b, so.luc).hang, lyDoHang: hangBangChung(b, so.luc).lyDo, gioiHan: b.gioiHan ?? [] })),
      khoangTrong: so.khoangTrong,
      vanDeTuDong: vanDeTuDong(sk),
      soDo,
    } });
  })
);

/** Đang chạy theo trang — dùng chung với lượt chấm hằng ngày (services/dieu-hanh-ngay.ts): không chạy chồng, không trả tiền hai lần. */

/** Chạy thử MỘT lần quy trình AI điều hành (tốn tiền AI — có chốt chống đốt tiền). Kết quả lưu, chờ chủ shop duyệt. */
dieuHanhRouter.post(
  "/chay",
  chanLamDungAI,
  route(async (req, res) => {
    const userId = req.user!.id;
    const trangId = await trangCuaToi(userId);
    const goTay = typeof req.body?.vanDe === "string" ? req.body.vanDe.trim().slice(0, 500) : "";
    // Kiểm + giữ khoá LIỀN NHAU, không await xen giữa — lượt chấm hằng ngày dùng cùng khoá (không gọi AI hai lần).
    if (dangChayDieuHanh.has(trangId)) throw new AppError("Cửa hàng này đang chạy thử, chờ lượt trước xong", 409);
    dangChayDieuHanh.add(trangId);
    try {
      const [so, sk] = await Promise.all([soBangChungTrang(userId, trangId), sucKhoeTrang(trangId)]);
      const vanDe = goTay ? `Chủ shop hỏi: ${goTay}` : vanDeTuDong(sk);
      if (!vanDe) throw new AppError("Bảng sức khoẻ không có vấn đề nào cần xử lý — gõ câu hỏi nếu muốn AI điều hành xem", 400);
      // Ngữ cảnh trang đã đúng (kênh đang chọn) → tiền AI tính vào đúng trang này.
      const k = await dieuHanhMotLan({ vanDe, so, cheDo: "de_xuat", goi: goiAiThat(userId) });
      const id = await luuDeXuat({ userId, trangId, vanDe, k, so });
      res.json({ success: true, data: { id, ketQua: k.ketQua, soLuotAi: k.soLuotAi, tienUsd: k.tienUsd, giay: k.thoiGianMs / 1000 } });
    } finally {
      dangChayDieuHanh.delete(trangId);
    }
  })
);

/** Lượt chấm TỰ ĐỘNG hôm nay của cửa hàng đang chọn (④ › Đang làm) — chỉ đọc. */
dieuHanhRouter.get(
  "/hang-ngay",
  route(async (req, res) => {
    const trangId = await trangCuaToi(req.user!.id);
    res.json({ success: true, data: await luotHomNay(trangId) });
  })
);

/** Đề xuất gần đây của trang đang chọn. */
dieuHanhRouter.get(
  "/de-xuat",
  route(async (req, res) => {
    const trangId = await trangCuaToi(req.user!.id);
    res.json({ success: true, data: await deXuatGanDay(trangId) });
  })
);

/** Duyệt / bác một đề xuất (chế độ đề xuất: duyệt = ghi nhận, CHƯA thực thi gì). Chỉ đề xuất của chính mình. */
dieuHanhRouter.post(
  "/de-xuat/:id/quyet",
  route(async (req, res) => {
    const dx = await trangCuaDeXuat(Number(req.params.id));
    if (!dx || dx.user_id !== req.user!.id) throw new AppError("Không tìm thấy đề xuất", 404);
    const ok = await chuShopQuyet({ id: Number(req.params.id), userId: req.user!.id, duyet: req.body?.duyet === true,
      lyDo: typeof req.body?.lyDo === "string" ? req.body.lyDo.trim().slice(0, 1000) : undefined });
    if (!ok) throw new AppError("Đề xuất này đã được quyết rồi", 409);
    res.json({ success: true });
  })
);

/** Sức khoẻ từng khâu của trang đang chọn — thẻ "Kết quả" của mỗi AI trong khuôn 4 thẻ (chỉ đọc, không tốn tiền). */
dieuHanhRouter.get(
  "/suc-khoe",
  route(async (req, res) => {
    const trangId = await trangCuaToi(req.user!.id);
    res.json({ success: true, data: await sucKhoeTrang(trangId) });
  })
);

const AI_HOP_LE = new Set(["content", "ads", "sales", "analytics"]);

/**
 * Nhật ký của MỘT AI trong bộ não trang đang chọn — thẻ "Nhật ký" của khuôn 4 thẻ (chỉ đọc).
 *
 * Thay đổi đọc từ sổ thay đổi (migration 044). Cài đặt / tài liệu gắn theo trang nên lọc theo trang và `kind` của dòng;
 * luật nhường người, hàng rào, kịch bản bình luận đang lưu theo TÀI KHOẢN (chưa có trang) → thuộc AI bán hàng, lọc theo
 * tài khoản; kênh là việc chung của trang → hiện ở AI điều hành.
 */
dieuHanhRouter.get(
  "/nhat-ky/:ai",
  route(async (req, res) => {
    const ai = String(req.params.ai);
    if (!AI_HOP_LE.has(ai)) throw new AppError("AI không hợp lệ", 400);
    const userId = req.user!.id;
    const trangId = await trangCuaToi(userId);

    const thayDoi = await query(
      `SELECT d.luc, d.bang, d.hanh_dong, d.truoc, d.sau, d.nguon
         FROM so_thay_doi d
        WHERE (d.trang_id = $1 OR (d.trang_id IS NULL AND d.user_id = $3))
          AND CASE
                WHEN d.bang IN ('ai_configs', 'ai_documents') THEN d.trang_id = $1 AND COALESCE(d.sau ->> 'kind', d.truoc ->> 'kind') = $2
                WHEN d.bang IN ('handoff_rules', 'guardrail_configs', 'rao_chan_cua_hang', 'auto_scripts') THEN $2 = 'sales'
                WHEN d.bang = 'social_accounts' THEN d.trang_id = $1 AND $2 = 'analytics'
                -- Việc quảng cáo (đẩy bài, đổi chiến dịch, tệp đối tượng) ghi qua ghiThayDoiNgoai theo cửa hàng — trước đây
                -- rơi vào ELSE nên Nhật ký ② không bao giờ thấy (23/10/2026).
                WHEN d.bang IN ('quang_cao_day_bai', 'quang_cao_chien_dich', 'quang_cao_doi_tuong') THEN d.trang_id = $1 AND $2 = 'ads'
                ELSE FALSE
              END
        ORDER BY d.luc DESC LIMIT 100`,
      [trangId, ai, userId]
    );

    // Việc AI đã tự làm: lịch tự đăng · các lần AI điều hành chẩn đoán — đều THEO CỬA HÀNG đang chọn (auto_pilot_runs có
    // trang_id từ A1 / 057; trước đây đọc theo tài khoản nên thấy cả việc của cửa hàng khác).
    const viec =
      ai === "content"
        ? (await query(
            `SELECT created_at AS luc, COALESCE(topic, '') || CASE WHEN note IS NOT NULL THEN ' — ' || note ELSE '' END AS noi_dung,
                    status AS trang_thai
               FROM auto_pilot_runs WHERE user_id = $1 AND trang_id = $2 ORDER BY id DESC LIMIT 50`,
            [userId, trangId]
          )).rows
        : ai === "analytics"
          ? (await query(
              `SELECT luc, van_de AS noi_dung, trang_thai FROM de_xuat_dieu_hanh WHERE trang_id = $1 ORDER BY id DESC LIMIT 50`,
              [trangId]
            )).rows
          : [];

    res.json({ success: true, data: { thayDoi: thayDoi.rows, viec } });
  })
);

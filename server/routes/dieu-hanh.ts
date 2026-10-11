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

export const dieuHanhRouter = Router();
dieuHanhRouter.use(requireAuth);

/** Trang của bộ não đang làm việc — luôn thuộc người đăng nhập (ngữ cảnh đã kiểm kênh thuộc ai). */
async function trangCuaToi(userId: number): Promise<number> {
  const trangId = await trangHienTai();
  const r = trangId ? await queryOne("SELECT 1 FROM trang WHERE id = $1 AND user_id = $2", [trangId, userId]) : null;
  if (!r) throw new AppError("Chưa có trang nào — nối kênh bán hàng trước", 400);
  return trangId!;
}

const docKy = (v: unknown): KyTongQuan => (v === "thang_truoc" ? "thang_truoc" : "thang_nay");

/** Vấn đề do CODE chọn từ bảng sức khoẻ: sự cố trước, rồi chỉ số tụt ảnh hưởng tiền nhiều nhất. Không có → null. */
function vanDeTuDong(sk: Awaited<ReturnType<typeof sucKhoeTrang>>): string | null {
  if (sk.suCo.length) return `Sự cố: ${sk.suCo.map((s) => `${s.ten} (${s.chiTiet})`).join("; ")}`;
  const tut = sk.uuTien.map((ma) => sk.chiSo.find((c) => c.ma === ma)).find((c) => c?.muc === "tut");
  return tut ? `Chỉ số TỤT: ${tut.ten}` : null;
}

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
                (SELECT count(*) FROM orders o WHERE o.trang_id = $1
                   AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.ngay)::int AS don,
                (SELECT count(*) FROM conversations c JOIN social_accounts s ON s.id = c.social_account_id
                  WHERE s.trang_id = $1 AND (c.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d.ngay)::int AS hoi_thoai
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

/** Đang chạy theo trang — bấm hai lần không trả tiền hai lần. */
const dangChayDieuHanh = new Set<number>();

/** Chạy thử MỘT lần quy trình AI điều hành (tốn tiền AI — có chốt chống đốt tiền). Kết quả lưu, chờ chủ shop duyệt. */
dieuHanhRouter.post(
  "/chay",
  chanLamDungAI,
  route(async (req, res) => {
    const userId = req.user!.id;
    const trangId = await trangCuaToi(userId);
    const goTay = typeof req.body?.vanDe === "string" ? req.body.vanDe.trim().slice(0, 500) : "";
    if (dangChayDieuHanh.has(trangId)) throw new AppError("Trang này đang chạy thử, chờ lượt trước xong", 409);
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

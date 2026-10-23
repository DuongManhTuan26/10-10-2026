/**
 * ④ AI ĐIỀU HÀNH CHẤM MỖI NGÀY (H7, 24/10/2026 — sơ đồ: "chấm mỗi ngày là đích"; chủ dự án đồng ý: chỉ cửa hàng có hoạt
 * động; phiên kiểm duyệt duyệt thiết kế + 6 điểm bắt buộc).
 *
 * Mỗi ngày (giờ VN ≥ 07:00) mỗi cửa hàng ĐÚNG MỘT lượt:
 *   1. giành chỗ dòng (trang_id, ngày VN) TRƯỚC — khởi động lại giữa lượt thì ngày đó không chạy lại (không trả tiền hai lần);
 *   2. không có hoạt động trong 24 giờ → 'khong_hoat_dong' (0 đồng);
 *   3. bảng sức khoẻ không có sự cố / chỉ số tụt → 'khong_van_de' (0 đồng, KHÔNG gọi AI);
 *   4. chạm trần tiền cả hệ thống trong ngày → 'cham_tran' (không gọi AI);
 *   5. còn lại gọi AI một lượt (chế độ đề xuất, trần mỗi lượt) → đề xuất chờ duyệt + Telegram.
 * Thứ tự cửa hàng: chưa được chấm lâu nhất trước (ngày nào cũng chạm trần thì không phải luôn cùng mấy cửa hàng cuối).
 */
import { query, queryOne } from "../db.js";
import { gioVN, NGAY_VN } from "../moc-thoi-gian.js";
import { chayChoTrang } from "./ngu-canh-trang.js";
import { sucKhoeTrang } from "./suc-khoe.js";
import { soBangChungTrang } from "./so-bang-chung.js";
import { dieuHanhMotLan, goiAiThat } from "./dieu-hanh.js";
import { luuDeXuat } from "./so-loi.js";
import { DK_TAI_KHOAN_MO } from "./tai-khoan-mo.js";
import { escapeHtml, sendTelegramMessage } from "./telegram.js";

/** Vấn đề giao cho AI điều hành, chọn từ bảng sức khoẻ: sự cố trước, rồi chỉ số TỤT theo thứ tự ưu tiên. Không có → null. */
export function vanDeTuDong(sk: Awaited<ReturnType<typeof sucKhoeTrang>>): string | null {
  if (sk.suCo.length) return `Sự cố: ${sk.suCo.map((s) => `${s.ten} (${s.chiTiet})`).join("; ")}`;
  const tut = sk.uuTien.map((ma) => sk.chiSo.find((c) => c.ma === ma)).find((c) => c?.muc === "tut");
  return tut ? `Chỉ số TỤT: ${tut.ten}` : null;
}

/** Đang chạy theo cửa hàng — dùng chung cho nút bấm tay và lượt hằng ngày (không chạy chồng, không trả tiền hai lần). */
export const dangChayDieuHanh = new Set<number>();

/** Bắt đầu chấm từ giờ này (giờ VN). Máy chủ tắt lúc đó thì lượt đầu tiên sau đó trong ngày chạy bù. */
export const GIO_BAT_DAU = 7;
/** Trần tiền MỖI lượt (tham số tranTien của dieuHanhMotLan). */
export const TRAN_LUOT_USD = 0.3;
/** Trần tiền CẢ HỆ THỐNG mỗi ngày cho lượt chấm tự động. */
export const TRAN_NGAY_USD = 1.0;
/** Dòng 'dang_chay' quá lâu = máy chủ khởi động lại giữa lượt. */
const QUA_LAU_PHUT = 60;

/**
 * Cửa hàng CÓ HOẠT ĐỘNG trong 24 giờ qua (tin khách / nhân viên / AI, bình luận, bài tạo hoặc đăng — kể cả bài lịch tự
 * đăng —, đơn), thuộc tài khoản đang mở, CHƯA có dòng hôm nay. Thứ tự: hôm qua chạm trần trước, rồi chưa được chấm lâu nhất.
 */
export const CHON_CUA_HANG_HOM_NAY = `
  SELECT t.id AS trang_id, t.user_id
    FROM trang t
   WHERE ${DK_TAI_KHOAN_MO("t.user_id")}
     AND NOT EXISTS (SELECT 1 FROM dieu_hanh_hang_ngay d WHERE d.trang_id = t.id AND d.ngay = ${NGAY_VN})
     AND (EXISTS (SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
                   WHERE c.trang_id = t.id AND m.sent_at > now() - interval '24 hours')
       OR EXISTS (SELECT 1 FROM comments cm WHERE cm.trang_id = t.id AND cm.created_at > now() - interval '24 hours')
       OR EXISTS (SELECT 1 FROM posts p WHERE p.trang_id = t.id
                   AND (p.created_at > now() - interval '24 hours' OR p.published_at > now() - interval '24 hours'))
       OR EXISTS (SELECT 1 FROM orders o WHERE o.trang_id = t.id AND o.created_at > now() - interval '24 hours'))
   ORDER BY (SELECT d.trang_thai = 'cham_tran' FROM dieu_hanh_hang_ngay d
              WHERE d.trang_id = t.id AND d.ngay = ${NGAY_VN} - 1) DESC NULLS LAST,
            (SELECT max(d.ngay) FROM dieu_hanh_hang_ngay d
              WHERE d.trang_id = t.id AND d.trang_thai IN ('khong_van_de', 'de_xuat')) ASC NULLS FIRST,
            t.id`;

/** Tiền đã dùng hôm nay: lượt xong lấy tiền thật (ai_usage), lượt đang chạy tính tạm bằng trần mỗi lượt. */
export const TIEN_HOM_NAY = `
  SELECT COALESCE(SUM(CASE WHEN trang_thai = 'dang_chay' THEN ${TRAN_LUOT_USD} ELSE tien_usd END), 0)::float AS usd
    FROM dieu_hanh_hang_ngay WHERE ngay = ${NGAY_VN}`;

/** Giành chỗ (cửa hàng, hôm nay). null = đã có dòng (lượt khác / lần trước đã làm). */
export const GIANH_CHO = `
  INSERT INTO dieu_hanh_hang_ngay (user_id, trang_id, ngay, trang_thai)
  VALUES ($1, $2, ${NGAY_VN}, 'dang_chay')
  ON CONFLICT (trang_id, ngay) DO NOTHING
  RETURNING id, created_at`;

/** Tiền AI THẬT của lượt chấm (sổ ai_usage, đúng cửa hàng, việc của AI điều hành, sau lúc giành chỗ). */
export const TIEN_THAT_CUA_LUOT = `
  SELECT COALESCE(SUM(coalesce(cost_ncc, cost_usd)), 0)::float AS usd FROM ai_usage
   WHERE trang_id = $1 AND viec IN ('dieu_hanh_chan_doan', 'dieu_hanh_kiem') AND created_at >= $2`;

async function xong(id: number, p: { trangThai: string; vanDe?: string | null; deXuatId?: number | null; tienUsd?: number; ghiChu?: string }) {
  await query(
    `UPDATE dieu_hanh_hang_ngay SET trang_thai = $2, van_de = $3, de_xuat_id = $4, tien_usd = $5, ghi_chu = $6, xong_luc = now()
      WHERE id = $1`,
    [id, p.trangThai, p.vanDe ?? null, p.deXuatId ?? null, p.tienUsd ?? 0, p.ghiChu ?? null]
  );
}

export async function runDueDieuHanhNgay(bayGio = new Date()): Promise<number> {
  if (gioVN(bayGio) < GIO_BAT_DAU) return 0;
  // Lượt kẹt ở 'dang_chay' (máy chủ khởi động lại giữa chừng) → ghi lỗi cho thấy rõ, KHÔNG chạy lại ngày đó.
  await query(
    `UPDATE dieu_hanh_hang_ngay SET trang_thai = 'loi', ghi_chu = 'Máy chủ khởi động lại giữa lượt — hôm nay không chấm lại.',
            tien_usd = COALESCE((SELECT SUM(coalesce(a.cost_ncc, a.cost_usd)) FROM ai_usage a
                                  WHERE a.trang_id = dieu_hanh_hang_ngay.trang_id AND a.created_at >= dieu_hanh_hang_ngay.created_at
                                    AND a.viec IN ('dieu_hanh_chan_doan', 'dieu_hanh_kiem')), 0),
            xong_luc = now()
      WHERE trang_thai = 'dang_chay' AND created_at < now() - interval '${QUA_LAU_PHUT} minutes'`
  );
  const ds = await query<{ trang_id: number; user_id: number }>(CHON_CUA_HANG_HOM_NAY);
  let daLam = 0;
  for (const { trang_id: trangId, user_id: userId } of ds.rows) {
    // Kiểm + giữ khoá LIỀN NHAU, không có await xen giữa (nút bấm tay /chay dùng cùng khoá) — rồi mới giành chỗ.
    if (dangChayDieuHanh.has(trangId)) continue;
    dangChayDieuHanh.add(trangId);
    let cho: { id: number; created_at: Date } | null = null;
    try {
      cho = await queryOne<{ id: number; created_at: Date }>(GIANH_CHO, [userId, trangId]);
      if (!cho) continue;
      const sk = await sucKhoeTrang(trangId, bayGio);
      const vanDe = vanDeTuDong(sk);
      if (!vanDe) {
        await xong(cho.id, { trangThai: "khong_van_de" });
        continue;
      }
      // Trần cả hệ thống: tính cả lượt này (đang chạy = tạm bằng trần mỗi lượt) — vượt thì không gọi AI.
      const daTieu = (await queryOne<{ usd: number }>(TIEN_HOM_NAY))!.usd;
      if (daTieu > TRAN_NGAY_USD) {
        await xong(cho.id, { trangThai: "cham_tran", vanDe, ghiChu: `Đã dùng ${daTieu.toFixed(2)} / ${TRAN_NGAY_USD} USD hôm nay.` });
        continue;
      }
      const deXuatId = await chayChoTrang(trangId, async () => {
        const so = await soBangChungTrang(userId, trangId, bayGio);
        const k = await dieuHanhMotLan({ vanDe, so, cheDo: "de_xuat", tranTien: TRAN_LUOT_USD, goi: goiAiThat(userId) });
        return luuDeXuat({ userId, trangId, vanDe, k, so });
      });
      const tien = (await queryOne<{ usd: number }>(TIEN_THAT_CUA_LUOT, [trangId, cho.created_at]))!.usd;
      await xong(cho.id, { trangThai: "de_xuat", vanDe, deXuatId, tienUsd: tien });
      daLam++;
      await sendTelegramMessage(
        userId,
        `🧭 <b>④ AI Điều hành có đề xuất mới chờ duyệt</b>\n\n${escapeHtml(vanDe)}\n\nVào ④ AI Điều hành › Đang làm để duyệt hoặc bác.`,
        "dieu_hanh",
        trangId
      ).catch(() => {
        /* Không báo được thì đề xuất vẫn nằm chờ trong app. */
      });
    } catch (error) {
      if (cho) {
        const tien = (await queryOne<{ usd: number }>(TIEN_THAT_CUA_LUOT, [trangId, cho.created_at]).catch(() => null))?.usd ?? 0;
        await xong(cho.id, { trangThai: "loi", tienUsd: tien, ghiChu: error instanceof Error ? error.message.slice(0, 300) : String(error) });
      }
      console.error(`[④ hằng ngày] Cửa hàng ${trangId}:`, error instanceof Error ? error.message : error);
    } finally {
      dangChayDieuHanh.delete(trangId);
    }
  }
  return daLam;
}

/** Lượt chấm hôm nay của một cửa hàng (giao diện ④ › Đang làm). */
export async function luotHomNay(trangId: number) {
  return queryOne<{ trang_thai: string; van_de: string | null; tien_usd: string; ghi_chu: string | null; created_at: Date; xong_luc: Date | null }>(
    `SELECT trang_thai, van_de, tien_usd::text, ghi_chu, created_at, xong_luc FROM dieu_hanh_hang_ngay
      WHERE trang_id = $1 AND ngay = ${NGAY_VN}`,
    [trangId]
  );
}

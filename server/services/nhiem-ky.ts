/**
 * NHIỆM KỲ KÊNH — "kênh là nhân viên, ra đi tay trắng, quay về người không" (chủ dự án chốt 19/10/2026; đợt 2a duyệt
 * cùng phiên kiểm duyệt; migration 058).
 *
 * Mỗi lần một kênh vào một cửa hàng là MỘT nhiệm kỳ. Mọi thứ phát sinh qua kênh (tin, hội thoại) thuộc cửa hàng của
 * nhiệm kỳ LÚC PHÁT SINH, không theo cửa hàng hiện tại của kênh. Cùng một luồng tin của nhà cung cấp sau khi kênh chuyển
 * → một dòng hội thoại MỚI (id = mã luồng + "~" + nhiệm kỳ); dòng cũ ở lại cửa hàng cũ làm lịch sử.
 *
 * Luật điểm nối (điều kiện 2 của phiên kiểm duyệt): nhiệm kỳ phủ [tu_luc, den_luc). Tin có lucTin < tu_luc của nhiệm kỳ
 * mới → nhiệm kỳ CŨ (đã đóng → chỉ lưu). lucTin hỏng → người gọi truyền giờ hệ thống nhận (received_at).
 */
import type pg from "pg";
import { query } from "../db.js";

export interface NhiemKy {
  id: number;
  trang_id: number | null;
  tu_luc: Date;
  den_luc: Date | null;
}

/**
 * Hàm thuần: nhiệm kỳ phủ thời điểm `luc` (tu_luc <= luc < den_luc). luc trước nhiệm kỳ đầu (tin lịch sử có trước lúc
 * nối kênh) → nhiệm kỳ đầu. Không có nhiệm kỳ nào → null.
 */
export function chonNhiemKy(ds: NhiemKy[], luc: Date): NhiemKy | null {
  if (ds.length === 0) return null;
  const sap = [...ds].sort((a, b) => a.tu_luc.getTime() - b.tu_luc.getTime());
  const t = luc.getTime();
  for (const nk of sap) {
    if (t >= nk.tu_luc.getTime() && (nk.den_luc == null || t < nk.den_luc.getTime())) return nk;
  }
  if (t < sap[0].tu_luc.getTime()) return sap[0];
  // Rơi vào khe giữa hai nhiệm kỳ (kênh từng không thuộc cửa hàng nào) → nhiệm kỳ gần nhất TRƯỚC đó.
  const truoc = sap.filter((nk) => nk.tu_luc.getTime() <= t);
  return truoc[truoc.length - 1] ?? sap[0];
}

/**
 * Hàm thuần: mã dòng hội thoại cho (luồng, nhiệm kỳ). Dòng mang đúng mã luồng chưa có, CHƯA THUỘC nhiệm kỳ nào (tin đến
 * lúc kênh vừa nối, chưa kịp gắn cửa hàng — dòng đó được NHẬN vào nhiệm kỳ này, không tách oan), hoặc chính là dòng của
 * nhiệm kỳ này → dùng mã luồng. Chỉ khi mã luồng đã thuộc một nhiệm kỳ KHÁC → mã mới có hậu tố nhiệm kỳ.
 */
export function maHoiThoai(maLuong: string, nhiemKyId: number | null, dongGoc: { nhiem_ky_id: number | null } | null): string {
  if (!dongGoc || nhiemKyId == null || dongGoc.nhiem_ky_id == null || dongGoc.nhiem_ky_id === nhiemKyId) return maLuong;
  return `${maLuong}~${nhiemKyId}`;
}

/** Nơi chạy câu lệnh: mặc định kho chung; phép thử tự hoàn tác truyền MỘT kết nối đang giữ giao dịch. */
type ChayLenh = Pick<pg.PoolClient, "query">;
const KHO_CHUNG: ChayLenh = { query: ((sql: string, ts?: unknown[]) => query(sql, ts)) as never };

export async function cacNhiemKy(accountId: string, db: ChayLenh = KHO_CHUNG): Promise<NhiemKy[]> {
  const r = await db.query<NhiemKy>(
    "SELECT id, trang_id, tu_luc, den_luc FROM kenh_nhiem_ky WHERE account_id = $1 ORDER BY tu_luc",
    [accountId]
  );
  return r.rows;
}

export interface HoiThoaiChoTin {
  /** Mã dòng hội thoại trong app — MỌI câu SQL / lời gọi sau đó dùng mã này, không dùng mã luồng của nhà cung cấp. */
  id: string;
  maLuong: string;
  trangId: number | null;
  nhiemKyId: number | null;
  /** Nhiệm kỳ đã đóng (kênh đã rời cửa hàng đó) → chỉ lưu, không AI / kịch bản / gửi. */
  daDong: boolean;
}

/**
 * MỘT hàm nhập chung cho mọi đường đưa tin vào (webhook, đồng bộ hộp thư, rà soát): luồng của nhà cung cấp + kênh +
 * thời điểm tin → đúng dòng hội thoại của đúng nhiệm kỳ. Kênh chưa có nhiệm kỳ (chưa gắn cửa hàng — hiếm): cảnh báo, vẫn
 * lưu theo mã luồng để không mất tin.
 */
export async function layHoiThoaiChoTin(
  p: { maLuong: string; accountId: string; lucTin: Date },
  db: ChayLenh = KHO_CHUNG
): Promise<HoiThoaiChoTin> {
  const nk = chonNhiemKy(await cacNhiemKy(p.accountId, db), p.lucTin);
  if (!nk) {
    console.warn(`[nhiệm kỳ] Kênh ${p.accountId} chưa gắn cửa hàng — lưu tin theo mã luồng ${p.maLuong}, chưa có cửa hàng`);
    return { id: p.maLuong, maLuong: p.maLuong, trangId: null, nhiemKyId: null, daDong: false };
  }
  const daCo = (
    await db.query<{ id: string }>("SELECT id FROM conversations WHERE ma_luong = $1 AND nhiem_ky_id = $2", [p.maLuong, nk.id])
  ).rows[0];
  const dongGoc = daCo
    ? null
    : ((await db.query<{ nhiem_ky_id: number | null }>("SELECT nhiem_ky_id FROM conversations WHERE id = $1", [p.maLuong])).rows[0] ??
      null);
  // Dòng gốc chưa thuộc nhiệm kỳ nào (tin đến trước lúc kênh được gắn cửa hàng) → NHẬN vào nhiệm kỳ này (phiên kiểm duyệt
  // 19/10: không tách một khách thành 2 hội thoại khi kênh chưa từng chuyển đi đâu).
  // AN TOÀN với cửa hàng đã xoá: xoá cửa hàng chỉ SET NULL trang_id / nhiem_ky_id của NHIỆM KỲ (kenh_nhiem_ky.trang_id) —
  // hội thoại của cửa hàng đó vẫn giữ nhiem_ky_id (FK tới kenh_nhiem_ky, nhiệm kỳ không bị xoá) → không khớp
  // "nhiem_ky_id IS NULL AND trang_id IS NULL" → không bao giờ bị kênh khác nhận.
  if (!daCo && dongGoc && dongGoc.nhiem_ky_id == null) {
    await db.query("UPDATE conversations SET nhiem_ky_id = $2, trang_id = $3 WHERE id = $1 AND nhiem_ky_id IS NULL AND trang_id IS NULL", [
      p.maLuong,
      nk.id,
      nk.trang_id,
    ]);
    // Nhận luôn HỒ SƠ KHÁCH của dòng đó — CHỈ hồ sơ chưa từng thuộc cửa hàng nào (trang_goc NULL; hồ sơ mồ côi của cửa
    // hàng đã xoá có trang_goc → không đụng), và cửa hàng nhận chưa có hồ sơ cùng (nền tảng, mã) — có rồi thì để nguyên,
    // không gộp (hội thoại sẽ trỏ sang hồ sơ của cửa hàng ở lần ghi tin kế tiếp).
    await db.query(
      `UPDATE customers cu SET trang_id = $2, trang_goc = $2, updated_at = now()
        WHERE cu.id = (SELECT customer_id FROM conversations WHERE id = $1)
          AND cu.trang_id IS NULL AND cu.trang_goc IS NULL
          AND NOT EXISTS (SELECT 1 FROM customers x
                           WHERE x.trang_id = $2 AND x.platform = cu.platform AND x.participant_id = cu.participant_id)`,
      [p.maLuong, nk.trang_id]
    );
  }
  return {
    id: daCo?.id ?? maHoiThoai(p.maLuong, nk.id, dongGoc),
    maLuong: p.maLuong,
    trangId: nk.trang_id,
    nhiemKyId: nk.id,
    daDong: nk.den_luc != null,
  };
}

/**
 * Mở / đóng nhiệm kỳ khi kênh vào cửa hàng — gọi TRONG giao dịch của ganKenhVaoTrang (chỗ DUY NHẤT ghi
 * social_accounts.trang_id). Cùng cửa hàng → không làm gì. Khác → đóng nhiệm kỳ đang mở, mở nhiệm kỳ mới (quay về cũng là
 * nhiệm kỳ mới). Trả về nhiệm kỳ vừa đóng (để việc dọn khi kênh rời — đợt 2b / 3 — biết kênh đã rời cửa hàng nào).
 */
export async function doiNhiemKy(
  k: Pick<pg.PoolClient, "query">,
  p: { accountId: string; userId: number; trangMoi: number }
): Promise<{ daDong: { id: number; trang_id: number | null } | null; moMoi: boolean }> {
  const mo = await k.query<{ id: number; trang_id: number | null }>(
    "SELECT id, trang_id FROM kenh_nhiem_ky WHERE account_id = $1 AND den_luc IS NULL FOR UPDATE",
    [p.accountId]
  );
  const dangMo = mo.rows[0] ?? null;
  if (dangMo && dangMo.trang_id === p.trangMoi) return { daDong: null, moMoi: false };
  if (dangMo) await k.query("UPDATE kenh_nhiem_ky SET den_luc = now() WHERE id = $1", [dangMo.id]);
  await k.query(
    "INSERT INTO kenh_nhiem_ky (user_id, account_id, trang_id, tu_luc) VALUES ($1, $2, $3, now())",
    [p.userId, p.accountId, p.trangMoi]
  );
  return { daDong: dangMo, moMoi: true };
}

/** Điều kiện SQL: hội thoại thuộc nhiệm kỳ còn mở (hoặc chưa có nhiệm kỳ — dữ liệu từ kênh chưa gắn cửa hàng). */
export const DK_NHIEM_KY_MO = (cot: string) =>
  `(${cot} IS NULL OR EXISTS (SELECT 1 FROM kenh_nhiem_ky nk_mo WHERE nk_mo.id = ${cot} AND nk_mo.den_luc IS NULL))`;

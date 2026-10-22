/**
 * SỔ THAY ĐỔI — bước 0 của AI điều hành (chủ dự án duyệt 09/10/2026; docs/nghien-cuu-bo-de-ai-dieu-hanh.md mục 14).
 *
 * Thay đổi trong cơ sở dữ liệu (cài đặt AI, tài liệu, lời dặn, lịch đăng, hàng rào, quy tắc nhường, kịch bản, kênh) do
 * TRIGGER ghi tự động (migration 044) — không cần gọi gì ở đây. File này lo hai việc trigger không làm được:
 *   1. Thay đổi đi qua API nhà cung cấp, không chạm cơ sở dữ liệu (quảng cáo: bật/tắt, ngân sách, nhân bản, đẩy bài,
 *      đối tượng) → ghiThayDoiNgoai, gọi SAU khi API báo thành công.
 *   2. Đường ghi biết mình là ai (hệ thống tự ngắt AI, sau này AI điều hành) → coNguon đặt nguồn trong cùng giao dịch.
 * Ghi sổ hỏng KHÔNG BAO GIỜ được làm hỏng việc chính.
 */
import type pg from "pg";
import { query } from "../db.js";
import { trangChoSo } from "./ngu-canh-trang.js";

/** Ai đổi. null = chưa rõ (trigger không biết chắc — không đoán). */
export type NguonThayDoi = "nguoi_dung" | "he_thong" | "ai_dieu_hanh";

/** Đặt nguồn cho mọi lần ghi tiếp theo TRONG giao dịch này (trigger đọc `app.nguon_thay_doi`). */
export async function coNguon(client: pg.PoolClient, nguon: NguonThayDoi): Promise<void> {
  await client.query("SELECT set_config('app.nguon_thay_doi', $1, true)", [nguon]);
}

/** Ghi một thay đổi KHÔNG đi qua cơ sở dữ liệu (API nhà cung cấp). Hỏng thì chỉ cảnh báo. */
export async function ghiThayDoiNgoai(p: {
  userId: number;
  trangId?: number | null;
  bang: string;
  banGhi: string | null;
  hanhDong: "them" | "sua" | "xoa";
  /** Giá trị trước — null nếu hệ thống không biết (vd. ngân sách cũ không được đọc trước). */
  truoc?: Record<string, unknown> | null;
  sau: Record<string, unknown> | null;
  nguon: NguonThayDoi;
}): Promise<void> {
  try {
    const trangId = p.trangId !== undefined ? p.trangId : await trangChoSo();
    await query(
      `INSERT INTO so_thay_doi (user_id, trang_id, bang, ban_ghi, hanh_dong, truoc, sau, nguon)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [p.userId, trangId, p.bang, p.banGhi, p.hanhDong,
        p.truoc ? JSON.stringify(p.truoc) : null, p.sau ? JSON.stringify(p.sau) : null, p.nguon]
    );
  } catch (e) {
    console.warn(`[sổ thay đổi] không ghi được ${p.bang}/${p.banGhi}: ${e instanceof Error ? e.message : e}`);
  }
}

export interface DongThayDoi {
  id: number;
  luc: Date;
  trang_id: number | null;
  bang: string;
  ban_ghi: string | null;
  hanh_dong: "them" | "sua" | "xoa";
  truoc: Record<string, unknown> | null;
  sau: Record<string, unknown> | null;
  nguon: NguonThayDoi | null;
}

/**
 * Các thay đổi ảnh hưởng tới MỘT trang trong khoảng [tu, den): của chính trang đó + thay đổi cấp tài khoản (hàng rào,
 * quy tắc nhường — không gắn trang, dùng chung mọi trang của tài khoản).
 */
export async function docThayDoi(userId: number, trangId: number, tu: Date, den: Date): Promise<DongThayDoi[]> {
  const { rows } = await query<DongThayDoi>(
    `SELECT id, luc, trang_id, bang, ban_ghi, hanh_dong, truoc, sau, nguon
       FROM so_thay_doi
      WHERE user_id = $1 AND (trang_id = $2 OR trang_id IS NULL) AND luc >= $3 AND luc < $4
      ORDER BY luc`,
    [userId, trangId, tu, den]
  );
  return rows;
}

/** Sổ bắt đầu ghi từ lúc nào — trước mốc này "không thấy thay đổi" nghĩa là CHƯA BIẾT, không phải "không đổi". */
export async function sotBatDauLuc(): Promise<Date | null> {
  const { rows } = await query<{ luc: Date | null }>("SELECT min(luc) AS luc FROM so_thay_doi");
  return rows[0]?.luc ?? null;
}

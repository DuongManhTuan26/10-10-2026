/**
 * LUẬT CHUYỂN NGƯỜI THẬT THEO CỬA HÀNG — A3 (22/10/2026; migration 060).
 *
 * Sơ đồ chủ dự án chốt: "Luật chuyển người thật + rào chắn riêng từng cửa hàng (cửa hàng mới chép bộ mặc định)".
 * Cửa hàng mới KHÔNG được chèn sẵn dòng ở các chỗ tạo cửa hàng (tai-khoan.ts, baoDamTrangChoHoSo, taoTrangMoi — dễ sót):
 * MỌI chỗ đọc luật đi qua luatCuaCuaHang — luật nào cửa hàng chưa có dòng thì lấy đúng bộ mặc định dưới đây. Chỗ ghi duy
 * nhất là PATCH /api/ai/handoff-rules/:key (upsert ON CONFLICT (trang_id, rule_key) — khớp chỉ mục của 060).
 */
import type pg from "pg";
import { query } from "../db.js";

export interface LuatChuyenNguoi {
  rule_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

/** Bộ mặc định, bật sẵn theo thực tế bán hàng (chuyển nguyên từ tai-khoan.ts). */
export const LUAT_MAC_DINH: ReadonlyArray<LuatChuyenNguoi> = [
  { rule_key: "complaint", enabled: true, config: {} },
  { rule_key: "ask_human", enabled: true, config: {} },
  { rule_key: "discount", enabled: true, config: {} },
  { rule_key: "shipping", enabled: true, config: {} },
  { rule_key: "unsure", enabled: true, config: {} },
  { rule_key: "media", enabled: false, config: {} },
  { rule_key: "too_many_turns", enabled: true, config: { maxTurns: 8 } },
];

/**
 * Câu GHI duy nhất của handoff_rules (PATCH /api/ai/handoff-rules/:key dùng; phép thử tự hoàn tác chạy đúng câu này).
 * ON CONFLICT phải khớp ĐÚNG chỉ mục handoff_rules_trang_key (trang_id, rule_key) của 060.
 * Tham số: $1 user_id, $2 trang_id, $3 rule_key, $4 enabled, $5 config (JSON).
 */
export const GHI_LUAT = `
  INSERT INTO handoff_rules (user_id, trang_id, rule_key, enabled, config)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (trang_id, rule_key) DO UPDATE SET
    enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_at = now()
  RETURNING rule_key, enabled, config`;

type ChayLenh = Pick<pg.PoolClient, "query">;
const KHO_CHUNG: ChayLenh = { query: ((sql: string, ts?: unknown[]) => query(sql, ts)) as never };

/**
 * Bộ luật của MỘT cửa hàng: luật mặc định nào cửa hàng đã có dòng thì lấy dòng, chưa có thì lấy mặc định; luật riêng
 * ngoài bộ mặc định (nếu có dòng) giữ nguyên. Không có cửa hàng (hội thoại kênh chưa gắn — AI im ở đợt 2a) → mặc định.
 */
export async function luatCuaCuaHang(trangId: number | null, db: ChayLenh = KHO_CHUNG): Promise<LuatChuyenNguoi[]> {
  const dong =
    trangId == null
      ? []
      : (await db.query<LuatChuyenNguoi>(
          "SELECT rule_key, enabled, config FROM handoff_rules WHERE trang_id = $1 ORDER BY rule_key",
          [trangId]
        )).rows;
  const theoMa = new Map(dong.map((d) => [d.rule_key, d]));
  const ket = LUAT_MAC_DINH.map((m) => theoMa.get(m.rule_key) ?? { ...m, config: { ...m.config } });
  for (const d of dong) if (!LUAT_MAC_DINH.some((m) => m.rule_key === d.rule_key)) ket.push(d);
  return ket.sort((a, b) => a.rule_key.localeCompare(b.rule_key));
}

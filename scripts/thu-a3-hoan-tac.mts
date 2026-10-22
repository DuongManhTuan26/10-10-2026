/**
 * THỬ THẬT TỰ HOÀN TÁC — A3 (luật chuyển người thật + rào chắn theo cửa hàng, lượt gửi ghi cửa hàng). Chủ dự án cho phép
 * kiểu thử này 19/10/2026; chỉ chạy sau khi phiên kiểm duyệt duyệt mã A3.
 *
 * MỘT kết nối, MỘT giao dịch: (nếu 060 chưa áp) chạy NỘI DUNG 060 trong giao dịch → đếm trên dữ liệu thật → dựng dữ liệu
 * GIẢ cho tài khoản thử 118 → chạy ĐÚNG câu ghi / hàm đọc thật (GHI_LUAT, luatCuaCuaHang, GHI_RAO_CHAN_CUA_HANG,
 * loadConfig, recordAttempt không dùng — chèn lượt gửi bằng câu tối thiểu) trên chính kết nối đó → ROLLBACK TOÀN BỘ.
 *
 *   npx tsx scripts/thu-a3-hoan-tac.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db.js";
import { GHI_LUAT, LUAT_MAC_DINH, luatCuaCuaHang } from "../server/services/luat-chuyen-nguoi.js";
import { GHI_RAO_CHAN_CUA_HANG, loadConfig } from "../server/services/guardrails.js";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TK = 118;
const ket: { ten: string; dat: boolean; chiTiet?: unknown }[] = [];
const kiem = (ten: string, thuc: unknown, mong: unknown) => {
  const dat = JSON.stringify(thuc) === JSON.stringify(mong);
  ket.push({ ten, dat, chiTiet: dat ? undefined : { thuc, mong } });
};

const cho = (await pool.query("SELECT COUNT(*)::int AS so FROM webhook_events WHERE status IN ('pending', 'processing')")).rows[0].so;
if (cho > 0) {
  console.error(`Hàng đợi còn ${cho} sự kiện — KHÔNG chạy. Thử lại sau.`);
  await pool.end();
  process.exit(2);
}
const coCot = async (bang: string, cot: string) =>
  (await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", [bang, cot])).rows.length > 0;
const co060Truoc = await coCot("handoff_rules", "trang_id");

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  if (!co060Truoc) {
    const truoc = (await c.query(`SELECT (SELECT COUNT(*) FROM handoff_rules)::int AS luat,
      (SELECT COUNT(*) FROM guardrail_configs)::int AS rao, (SELECT COUNT(*) FROM send_attempts)::int AS gui`)).rows[0];
    await c.query(fs.readFileSync(path.join(GOC, "server/migrations/060_luat_va_rao_chan_theo_cua_hang.sql"), "utf8"));
    const sau = (await c.query(`
      SELECT (SELECT COUNT(*) FROM handoff_rules WHERE trang_id IS NULL)::int AS luat_null,
             (SELECT COUNT(*) FROM handoff_rules_truoc_060)::int AS luat_sao_luu,
             (SELECT COUNT(*) FROM handoff_rules)::int AS luat_sau,
             (SELECT COALESCE(SUM(so), 0)::int FROM (SELECT COUNT(*) AS so FROM trang t
                 WHERE EXISTS (SELECT 1 FROM handoff_rules_truoc_060 h WHERE h.user_id = t.user_id)
                 GROUP BY t.user_id) x) AS cua_hang_co_luat_goc,
             (SELECT COUNT(*) FROM (SELECT t.id FROM trang t JOIN handoff_rules_truoc_060 h ON h.user_id = t.user_id
                 WHERE NOT EXISTS (SELECT 1 FROM handoff_rules r WHERE r.trang_id = t.id AND r.rule_key = h.rule_key
                                     AND r.enabled = h.enabled AND r.config = h.config)) x)::int AS cua_hang_thieu_luat,
             (SELECT COUNT(*) FROM rao_chan_cua_hang)::int AS rao_ch,
             (SELECT COUNT(*) FROM trang t WHERE EXISTS (SELECT 1 FROM guardrail_configs g WHERE g.user_id = t.user_id))::int AS rao_ch_mong,
             (SELECT COUNT(*) FROM send_attempts WHERE trang_id IS NULL)::int AS gui_null,
             (SELECT COUNT(*) FROM send_attempts_truoc_060)::int AS gui_sao_luu`)).rows[0];
    console.log("Dữ liệu thật trước / sau nội dung 060 (trong giao dịch, sẽ hoàn tác):", truoc, sau);
    kiem("060: luật 0 NULL; MỌI cửa hàng của tài khoản có luật đều có ĐỦ đúng bộ luật đó; sao lưu đủ; rào chắn chép cho mọi cửa hàng của tài khoản có cấu hình",
      [sau.luat_null, sau.cua_hang_thieu_luat, sau.luat_sao_luu === truoc.luat, sau.rao_ch === sau.rao_ch_mong, sau.gui_sao_luu === truoc.gui],
      [0, 0, true, true, true]);
  }

  const duoi = `${Date.now()}`;
  const taoTrang = async (ten: string) =>
    (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, $3) RETURNING id", [TK, `thua3-${ten}-${duoi}`, ten])).rows[0].id as number;
  const A = await taoTrang("A"), B = await taoTrang("B");

  // LUẬT: cửa hàng mới = đúng bộ mặc định; ghi A hai lần (upsert TRÙNG thật) → 1 dòng; B không bị ảnh hưởng.
  const macDinhA = await luatCuaCuaHang(A, c);
  kiem("cửa hàng mới (chưa có dòng) → đúng bộ mặc định", macDinhA.map((r) => [r.rule_key, r.enabled]),
    [...LUAT_MAC_DINH].sort((x, y) => x.rule_key.localeCompare(y.rule_key)).map((r) => [r.rule_key, r.enabled]));
  await c.query(GHI_LUAT, [TK, A, "media", true, JSON.stringify({})]);
  await c.query(GHI_LUAT, [TK, A, "media", false, JSON.stringify({ lan: 2 })]);
  const dongA = (await c.query("SELECT enabled, config FROM handoff_rules WHERE trang_id = $1 AND rule_key = 'media'", [A])).rows;
  kiem("ghi trùng (A, media) hai lần → MỘT dòng, giá trị lần 2 (ON CONFLICT khớp chỉ mục (trang_id, rule_key))",
    dongA, [{ enabled: false, config: { lan: 2 } }]);
  await c.query(GHI_LUAT, [TK, A, "media", true, JSON.stringify({})]);
  kiem("A bật 'media' → A thấy bật; B vẫn mặc định (tắt) — hai cửa hàng không lẫn",
    [(await luatCuaCuaHang(A, c)).find((r) => r.rule_key === "media")?.enabled, (await luatCuaCuaHang(B, c)).find((r) => r.rule_key === "media")?.enabled],
    [true, false]);

  // RÀO CHẮN: A ghi lời tự giới thiệu + trần AI riêng (upsert trùng) → B vẫn mặc định; trần phút vẫn của tài khoản.
  const ghiRao = (trang: number, text: string, aiGio: number) =>
    c.query(GHI_RAO_CHAN_CUA_HANG, [trang, TK, true, text, aiGio, true, null, null, null]);
  await ghiRao(A, "Chào từ A lần 1", 5);
  await ghiRao(A, "Chào từ A", 7);
  const raoA = await loadConfig(TK, A, c), raoB = await loadConfig(TK, B, c);
  kiem("rào chắn: A có lời chào + trần AI riêng (upsert trùng → giá trị lần 2), B mặc định; trần phút hai bên như nhau (của tài khoản)",
    [raoA.disclosure_text, raoA.max_ai_sends_per_hour, raoB.max_ai_sends_per_hour, raoB.disclosure_text.startsWith("Em là trợ lý tự động"),
      raoA.max_sends_per_minute === raoB.max_sends_per_minute,
      (await c.query("SELECT COUNT(*)::int AS n FROM rao_chan_cua_hang WHERE trang_id = $1", [A])).rows[0].n],
    ["Chào từ A", 7, 0, true, true, 1]);

  // LƯỢT GỬI: đếm trần AI / giờ theo cửa hàng — lượt của A không tính vào B.
  for (let i = 0; i < 3; i++) {
    await c.query("INSERT INTO send_attempts (user_id, trang_id, actor, decision, outcome) VALUES ($1, $2, 'ai', 'allowed', 'sent')", [TK, A]);
  }
  const dem = async (trang: number) => (await c.query(
    `SELECT COUNT(*)::int AS n FROM send_attempts
      WHERE user_id = $1 AND trang_id IS NOT DISTINCT FROM $2 AND actor = 'ai' AND decision = 'allowed'
        AND created_at > now() - interval '1 hour'`, [TK, trang])).rows[0].n;
  kiem("trần AI / giờ đếm theo cửa hàng: A 3 lượt, B 0", [await dem(A), await dem(B)], [3, 0]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

const sach = (await pool.query(
  `SELECT (SELECT COUNT(*) FROM trang WHERE profile_ref LIKE 'thua3-%')::int AS trang_thu,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'handoff_rules' AND column_name = 'trang_id')::int AS cot_luat,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'send_attempts' AND column_name = 'trang_id')::int AS cot_gui,
          to_regclass('public.rao_chan_cua_hang') IS NOT NULL AS co_bang_rao,
          to_regclass('public.handoff_rules_truoc_060') IS NOT NULL AS co_sao_luu`)).rows[0];
kiem("sau ROLLBACK: không còn dữ liệu thử; cột / bảng của 060 trở lại đúng như trước",
  [sach.trang_thu, sach.cot_luat, sach.cot_gui, sach.co_bang_rao, sach.co_sao_luu],
  [0, co060Truoc ? 1 : 0, co060Truoc ? 1 : 0, co060Truoc, co060Truoc]);
await pool.end();

for (const k of ket) console.log(`${k.dat ? "✓" : "✗"} ${k.ten}${k.dat ? "" : `\n   ${JSON.stringify(k.chiTiet)}`}`);
const hong = ket.filter((k) => !k.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

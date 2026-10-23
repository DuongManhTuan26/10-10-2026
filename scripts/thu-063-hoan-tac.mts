/**
 * THỬ THẬT TỰ HOÀN TÁC — 063 (chống gửi lặp: thêm cột). MỘT giao dịch trên Neon: đếm dòng → chạy 063 → cột có, số dòng
 * và dữ liệu cũ không đổi, cột mới rỗng → ROLLBACK → cột trở lại như trước.
 *
 *   npx tsx scripts/thu-063-hoan-tac.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db.js";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const COT = `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public'
  AND ((table_name = 'send_attempts' AND column_name IN ('ma_khoi_dong', 'ma_kich_hoat', 'noi_dung_bam'))
    OR (table_name = 'comments' AND column_name IN ('public_dang_gui_luc', 'public_dang_gui_ma')))`;
const truocCot = (await pool.query(COT)).rows[0].n as number;
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  const DEM = "SELECT (SELECT count(*) FROM send_attempts)::int AS sa, (SELECT count(*) FROM comments)::int AS cm, (SELECT md5(string_agg(id || outcome, ',' ORDER BY id)) FROM send_attempts) AS bam";
  const truoc = (await c.query(DEM)).rows[0];
  if (truocCot === 0) await c.query(fs.readFileSync(path.join(GOC, "server/migrations/063_chong_gui_lap.sql"), "utf8"));
  const sau = (await c.query(DEM)).rows[0];
  const rong = (await c.query(`SELECT (SELECT count(*) FROM send_attempts WHERE ma_khoi_dong IS NOT NULL OR ma_kich_hoat IS NOT NULL OR noi_dung_bam IS NOT NULL)::int AS sa,
    (SELECT count(*) FROM comments WHERE public_dang_gui_luc IS NOT NULL OR public_dang_gui_ma IS NOT NULL)::int AS cm`)).rows[0];
  console.log({ truoc, sau, rong, cot: (await c.query(COT)).rows[0].n });
  kiem("063: đủ 5 cột mới", (await c.query(COT)).rows[0].n, 5);
  kiem("063: số dòng + dữ liệu send_attempts không đổi; cột mới rỗng", [sau, rong], [truoc, { sa: 0, cm: 0 }]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: cột trở lại như trước", (await pool.query(COT)).rows[0].n, truocCot);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

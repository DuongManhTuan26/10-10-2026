/**
 * THỬ THẬT TỰ HOÀN TÁC — giọng điệu của ① AI Nội dung (066, TD-24, H10, 24/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chụp số dòng ai_configs theo (kind, tone) → chạy SQL 066 → kiểm: cột tone
 * cho phép NULL (mặc định giữ), mọi dòng
 * 'content' tone NULL, các AI khác KHÔNG đổi một dòng nào; chạy lại 066 không đổi gì → tạo tài khoản GIẢ bằng ĐÚNG câu
 * INSERT ai_configs của services/tai-khoan.ts (đọc từ tệp) → kiểm content NULL, AI khác 'friendly' → ROLLBACK TOÀN BỘ →
 * kiểm số dòng như lúc đầu. Không gọi AI, không gọi nhà cung cấp.
 *
 *   npx tsx scripts/thu-066-hoan-tac.mts
 */
import fs from "node:fs";
import { pool } from "../server/db.js";

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
const SQL_066 = fs.readFileSync(new URL("../server/migrations/066_giong_noi_dung.sql", import.meta.url), "utf8");
const nguonTk = fs.readFileSync(new URL("../server/services/tai-khoan.ts", import.meta.url), "utf8");
const SQL_TAO = nguonTk.match(/`(INSERT INTO ai_configs \(user_id, trang_id, kind, system_prompt, tone\)[\s\S]*?)`/)?.[1];
if (!SQL_TAO) throw new Error("Không thấy câu INSERT ai_configs trong tai-khoan.ts");

const DEM = "SELECT kind, coalesce(tone, '(null)') AS tone, count(*)::int AS n FROM ai_configs GROUP BY 1, 2 ORDER BY 1, 2";
const khac = (rows: { kind: string }[]) => rows.filter((r) => r.kind !== "content");
const EMAIL = `thu-066-${Date.now()}@example.test`;

const truoc = (await pool.query(DEM)).rows;
console.log("Trước (Neon thật):", JSON.stringify(truoc));
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  const kq = await c.query(SQL_066);
  const doi = (Array.isArray(kq) ? kq.at(-1) : kq).rowCount;
  kiem("066: cột tone cho phép NULL, mặc định vẫn 'friendly'",
    (await c.query("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ai_configs' AND column_name = 'tone'")).rows[0],
    { is_nullable: "YES", column_default: "'friendly'::text" });
  const sau = (await c.query(DEM)).rows;
  kiem("066: mọi dòng AI Nội dung tone NULL", sau.filter((r) => r.kind === "content").map((r) => r.tone), ["(null)"]);
  kiem("066: số dòng đổi = số dòng AI Nội dung", doi, truoc.filter((r) => r.kind === "content").reduce((s, r) => s + r.n, 0));
  kiem("066: AI Bán hàng / Quảng cáo / Điều hành không đổi một dòng nào", khac(sau), khac(truoc));
  await c.query(SQL_066);
  kiem("066 chạy lại: không đổi gì thêm", (await c.query(DEM)).rows, sau);

  const u = (await c.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'x', 'Thử 066', 'shop') RETURNING id", [EMAIL])).rows[0].id as number;
  const t = (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, 'Thử 066') RETURNING id", [u, `cho-cap-thu066-${u}`])).rows[0].id as number;
  for (const kind of ["content", "ads", "sales", "analytics"]) await c.query(SQL_TAO, [u, t, kind, ""]);
  kiem("tài khoản mới (đúng câu của tai-khoan.ts): AI Nội dung không giọng, AI khác 'friendly'",
    (await c.query("SELECT kind, tone FROM ai_configs WHERE trang_id = $1 ORDER BY kind", [t])).rows,
    [{ kind: "ads", tone: "friendly" }, { kind: "analytics", tone: "friendly" }, { kind: "content", tone: null }, { kind: "sales", tone: "friendly" }]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: số dòng (kind, tone) như lúc đầu; cột tone vẫn NOT NULL (chưa gộp); không còn tài khoản thử",
  [(await pool.query(DEM)).rows,
    (await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'ai_configs' AND column_name = 'tone'")).rows[0].is_nullable,
    Number((await pool.query("SELECT count(*) AS n FROM users WHERE email = $1", [EMAIL])).rows[0].n)],
  [truoc, "NO", 0]);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

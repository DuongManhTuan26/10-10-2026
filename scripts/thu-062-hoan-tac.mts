/**
 * THỬ THẬT TỰ HOÀN TÁC — 062 (kịch bản áp dụng cho bài cụ thể). Luật quy trình 22/10/2026: migration có điền / đổi dữ
 * liệu phải chạy nội dung trong một giao dịch trên Neon thật trước khi gộp.
 *
 * MỘT kết nối, MỘT giao dịch: đếm + chụp kịch bản → chạy 062 → kiểm số dòng / giá trị không đổi, hai CHECK chặn đúng
 * (thử trên dòng có sẵn, mỗi phép trong SAVEPOINT) → ROLLBACK TOÀN BỘ → kiểm cột / ràng buộc trở lại như trước.
 *
 *   npx tsx scripts/thu-062-hoan-tac.mts
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
const COT = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auto_scripts' AND column_name = 'bai_ap_dung') AS co";
const coTruoc = (await pool.query(COT)).rows[0].co as boolean;

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  const CHUP = "SELECT id, apply_to, is_active, keywords FROM auto_scripts ORDER BY id";
  const truoc = (await c.query(CHUP)).rows;
  if (!coTruoc) await c.query(fs.readFileSync(path.join(GOC, "server/migrations/062_kich_ban_theo_bai.sql"), "utf8"));
  const sau = (await c.query(CHUP)).rows;
  const baiSau = (await c.query("SELECT DISTINCT cardinality(bai_ap_dung) AS so FROM auto_scripts")).rows.map((r) => r.so);
  console.log({ soKichBan: truoc.length, applyToTruoc: truoc.map((r) => r.apply_to), baiSau });
  kiem("062: số kịch bản + id / apply_to / bật-tắt / từ khoá giữ nguyên; cột mới rỗng ở mọi dòng", [sau, baiSau.length ? baiSau : [0]], [truoc, [0]]);

  const id = truoc[0]?.id as number | undefined;
  const thu = async (sql: string, ts: unknown[]) => {
    await c.query("SAVEPOINT thu");
    try {
      await c.query(sql, ts);
      await c.query("RELEASE SAVEPOINT thu");
      return "qua";
    } catch (e) {
      await c.query("ROLLBACK TO SAVEPOINT thu");
      return (e as { constraint?: string }).constraint ?? (e as Error).message;
    }
  };
  if (id === undefined) {
    kiem("có dòng kịch bản để thử ràng buộc", false, true);
  } else {
    const U = "UPDATE auto_scripts SET apply_to = $2, bai_ap_dung = $3 WHERE id = $1";
    kiem("CHECK: apply_to lạ / 'specific' rỗng / 101 bài bị chặn; 'specific' 1 bài và 'all' qua",
      [await thu(U, [id, "xyz", []]), await thu(U, [id, "specific", []]),
        await thu(U, [id, "specific", Array.from({ length: 101 }, (_, i) => `p${i}`)]),
        await thu(U, [id, "specific", ["686754604528250_122186826398943141"]]), await thu(U, [id, "all", []])],
      ["auto_scripts_apply_to_hop_le", "auto_scripts_bai_cu_the_co_bai", "auto_scripts_bai_cu_the_co_bai", "qua", "qua"]);
  }
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

const sach = (await pool.query(
  `${COT.replace(" AS co", " AS co_cot")},
          (SELECT count(*)::int FROM pg_constraint WHERE conname IN ('auto_scripts_apply_to_hop_le', 'auto_scripts_bai_cu_the_co_bai')) AS so_rang_buoc`
)).rows[0];
kiem("sau ROLLBACK: cột / ràng buộc của 062 trở lại đúng như trước", [sach.co_cot, sach.so_rang_buoc], [coTruoc, coTruoc ? 2 : 0]);
await pool.end();

for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

/**
 * THỬ THẬT TỰ HOÀN TÁC — sự cố "AI bị chặn" (H19, 30/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chạy ĐÚNG câu GHI_SU_CO_AI (su-co-ai.ts) — lần 1 giành quyền báo, lần 2 cùng
 * lúc KHÔNG, lần 3 sau 61 phút giành lại; batDau giữ từ lần đầu; xoá như lúc AI chạy lại → ROLLBACK → kiểm như lúc đầu.
 * Không gửi Telegram, không gọi AI.
 *
 *   npx tsx scripts/thu-h19-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { BAO_LAI_SAU_MS, GHI_SU_CO_AI, KHOA_SU_CO_AI } from "../server/services/su-co-ai.js";

const ket: { ten: string; dat: boolean; chiTiet?: unknown }[] = [];
const kiem = (ten: string, thuc: unknown, mong: unknown) => {
  const dat = JSON.stringify(thuc) === JSON.stringify(mong);
  ket.push({ ten, dat, chiTiet: dat ? undefined : { thuc, mong } });
};
const DOC = `SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = '${KHOA_SU_CO_AI}'`;
const truoc = (await pool.query(DOC)).rows[0]?.gia_tri ?? null;
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  await c.query(`DELETE FROM cai_dat_he_thong WHERE khoa = '${KHOA_SU_CO_AI}'`);
  const t0 = new Date("2026-10-30T01:00:00Z");
  const lan1 = (await c.query(GHI_SU_CO_AI, [t0.toISOString(), "403 budget $22.58 of $22.00", BAO_LAI_SAU_MS])).rows[0]?.ok ?? null;
  const lan2 = (await c.query(GHI_SU_CO_AI, [new Date(t0.getTime() + 5 * 60_000).toISOString(), "403 lần 2", BAO_LAI_SAU_MS])).rows[0]?.ok ?? null;
  const sau2 = (await c.query(DOC)).rows[0]?.gia_tri;
  const lan3 = (await c.query(GHI_SU_CO_AI, [new Date(t0.getTime() + 61 * 60_000).toISOString(), "403 lần 3", BAO_LAI_SAU_MS])).rows[0]?.ok ?? null;
  const sau3 = (await c.query(DOC)).rows[0]?.gia_tri;
  kiem("lần 1 giành quyền báo; lần 2 (5 phút sau) KHÔNG; lần 3 (61 phút sau) giành lại", [lan1, lan2, lan3], [true, null, true]);
  kiem("lần 2 không đổi gì (giữ chi tiết + mốc báo lần 1); lần 3 giữ batDau lần đầu, cập nhật chi tiết + mốc báo",
    [sau2?.chiTiet, sau2?.baoLuc === t0.toISOString(), sau3?.batDau === t0.toISOString(), sau3?.chiTiet, sau3?.baoLuc === new Date(t0.getTime() + 61 * 60_000).toISOString()],
    ["403 budget $22.58 of $22.00", true, true, "403 lần 3", true]);
  const xoa = (await c.query(`DELETE FROM cai_dat_he_thong WHERE khoa = '${KHOA_SU_CO_AI}' RETURNING gia_tri`)).rows[0]?.gia_tri?.batDau;
  kiem("AI chạy lại: xoá trả về batDau (để báo 'bị chặn từ…'); sau xoá không còn sự cố", [xoa === t0.toISOString(), (await c.query(DOC)).rowCount], [true, 0]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: dòng sự cố như lúc đầu", (await pool.query(DOC)).rows[0]?.gia_tri ?? null, truoc);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

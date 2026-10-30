/**
 * THỬ THẬT TỰ HOÀN TÁC — ngắt AI khi Facebook chặn Fanpage gửi tin (TD-36, 30/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật, kênh 6ad369a7… (Fanpage của cửa hàng 370 — kênh bị chặn thật 30/10):
 * chạy ĐÚNG câu DAT_NGAT_KHI_BI_CHAN (guardrails.ts) — chưa ngắt → đặt 24 giờ; gọi lại → KHÔNG đặt (chống lặp, không báo
 * lần hai); đang tự ngắt 30 phút → kéo lên 24 giờ; câu lối ra sớm của AI Bán hàng thấy kênh đang ngắt → ROLLBACK → kiểm
 * như lúc đầu. Không gửi Telegram, không gọi AI, không gọi nhà cung cấp.
 *
 *   npx tsx scripts/thu-td36-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { DAT_NGAT_KHI_BI_CHAN, LY_DO_KENH_BI_CHAN, NGAT_KHI_BI_CHAN_MS } from "../server/services/guardrails.js";
import { coNguon } from "../server/services/so-thay-doi.js";

const KENH = "6ad369a7eab86410459c7c88";
const ket: { ten: string; dat: boolean; chiTiet?: unknown }[] = [];
const kiem = (ten: string, thuc: unknown, mong: unknown) => {
  const dat = JSON.stringify(thuc) === JSON.stringify(mong);
  ket.push({ ten, dat, chiTiet: dat ? undefined : { thuc, mong } });
};
const DOC = "SELECT ai_paused_until, ai_pause_reason, ai_paused_at, updated_at FROM social_accounts WHERE id = $1";
const truoc = (await pool.query(DOC, [KENH])).rows[0] ?? null;
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  await coNguon(c, "he_thong");
  const gio = async () => (await c.query<{ g: number }>(
    "SELECT EXTRACT(EPOCH FROM (ai_paused_until - now()))::float AS g FROM social_accounts WHERE id = $1", [KENH])).rows[0]?.g ?? null;

  await c.query("UPDATE social_accounts SET ai_paused_until = NULL, ai_pause_reason = NULL WHERE id = $1", [KENH]);
  const lan1 = (await c.query(DAT_NGAT_KHI_BI_CHAN, [KENH, NGAT_KHI_BI_CHAN_MS, "thử 1"])).rows;
  const g1 = await gio();
  const lan2 = (await c.query(DAT_NGAT_KHI_BI_CHAN, [KENH, NGAT_KHI_BI_CHAN_MS, "thử 2"])).rows;
  const lyDo2 = (await c.query("SELECT ai_pause_reason FROM social_accounts WHERE id = $1", [KENH])).rows[0]?.ai_pause_reason;
  kiem("chưa ngắt → đặt 24 giờ, trả 1 dòng (có user_id, trang_id); gọi lại ngay → 0 dòng, lý do giữ của lần 1",
    [lan1.length, Math.round(g1 ?? -1), lan1[0]?.user_id, lan1[0]?.trang_id, lan2.length, lyDo2], [1, 86400, 5, 370, 0, "thử 1"]);

  await c.query("UPDATE social_accounts SET ai_paused_until = now() + interval '30 minutes', ai_pause_reason = 'tỷ lệ lỗi' WHERE id = $1", [KENH]);
  const lan3 = (await c.query(DAT_NGAT_KHI_BI_CHAN, [KENH, NGAT_KHI_BI_CHAN_MS, "thử 3"])).rows;
  kiem("đang tự ngắt 30 phút (tỷ lệ lỗi) → kéo lên 24 giờ", [lan3.length, Math.round((await gio()) ?? -1)], [1, 86400]);

  // TD-36b: đúng biểu thức của GET /inbox/conversations/:id — chỉ báo khi lý do bắt đầu bằng tiền tố chặn gửi.
  const BAO = `SELECT CASE WHEN sa.ai_paused_until > now() AND left(sa.ai_pause_reason, length($2)) = $2
                    THEN sa.ai_paused_until END AS den, sa.page_id FROM social_accounts sa WHERE sa.id = $1`;
  await c.query("UPDATE social_accounts SET ai_pause_reason = $2 WHERE id = $1", [KENH, `${LY_DO_KENH_BI_CHAN} ((#2022) thử)`]);
  const baoChan = (await c.query(BAO, [KENH, LY_DO_KENH_BI_CHAN])).rows[0];
  await c.query("UPDATE social_accounts SET ai_pause_reason = 'tỷ lệ gửi thất bại 80%' WHERE id = $1", [KENH]);
  const baoTyLe = (await c.query(BAO, [KENH, LY_DO_KENH_BI_CHAN])).rows[0];
  kiem("hộp thư: ngắt vì chặn gửi → có mốc + page_id; ngắt vì tỷ lệ lỗi → không báo",
    [baoChan?.den !== null, baoChan?.page_id, baoTyLe?.den], [true, "851314991396686", null]);

  const loiRa = (await c.query("SELECT ai_paused_until, ai_pause_reason FROM social_accounts WHERE id = $1 AND ai_paused_until > now()", [KENH])).rowCount;
  await c.query("UPDATE social_accounts SET ai_paused_until = now() - interval '1 second' WHERE id = $1", [KENH]);
  const loiRaHet = (await c.query("SELECT 1 FROM social_accounts WHERE id = $1 AND ai_paused_until > now()", [KENH])).rowCount;
  kiem("câu lối ra sớm của AI Bán hàng: đang ngắt → thấy; hết mốc → không thấy (tự mở)", [loiRa, loiRaHet], [1, 0]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: kênh như lúc đầu", (await pool.query(DOC, [KENH])).rows[0] ?? null, truoc);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

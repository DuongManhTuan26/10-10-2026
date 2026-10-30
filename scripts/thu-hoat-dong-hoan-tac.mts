/**
 * THỬ THẬT TỰ HOÀN TÁC — hoạt động khối não (31/10/2026): câu CAU_HOAT_DONG (server/services/hoat-dong-khoi-nao.ts).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật, cửa hàng 370: chèn đơn mới / đơn huỷ / đơn 11 phút trước / đơn của cửa hàng
 * khác, đổi mốc đăng một bài đã đăng → chạy ĐÚNG câu của máy chủ → kiểm đúng dòng → ROLLBACK → kiểm như lúc đầu. Không
 * gửi Telegram, không gọi AI, không gọi nhà cung cấp. (Số thứ tự đơn — sequence — nhảy vài số: Postgres không lùi sequence.)
 *
 *   npx tsx scripts/thu-hoat-dong-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { CAU_HOAT_DONG } from "../server/services/hoat-dong-khoi-nao.js";

const TRANG = 370;
const TRANG_KHAC = 47;
const ket: { ten: string; dat: boolean; chiTiet?: unknown }[] = [];
const kiem = (ten: string, thuc: unknown, mong: unknown) => {
  const dat = JSON.stringify(thuc) === JSON.stringify(mong);
  ket.push({ ten, dat, chiTiet: dat ? undefined : { thuc, mong } });
};
const DEM = "SELECT (SELECT count(*) FROM orders WHERE code LIKE 'THU-HD-%')::int AS don, (SELECT md5(string_agg(id || ':' || coalesce(published_at::text, ''), ',' ORDER BY id)) FROM posts WHERE trang_id = $1) AS bai";
const truoc = (await pool.query(DEM, [TRANG])).rows[0];
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  const chay = async () => (await c.query(CAU_HOAT_DONG, [TRANG])).rows as { ai: string; loai: string; chu: string; luong_tu: string | null; luong_den: string | null; tuoi: number }[];
  const nen = await chay();
  const chu = (await c.query("SELECT user_id FROM trang WHERE id = $1", [TRANG])).rows[0].user_id;
  const chuKhac = (await c.query("SELECT user_id FROM trang WHERE id = $1", [TRANG_KHAC])).rows[0].user_id;
  const don = (code: string, trang: number, user: number, status: string, luc: string) =>
    c.query(`INSERT INTO orders (user_id, trang_id, code, status, created_at) VALUES ($1, $2, $3, $4, ${luc})`, [user, trang, code, status]);
  await don("THU-HD-1", TRANG, chu, "pending", "now()");
  await don("THU-HD-2", TRANG, chu, "cancelled", "now()");
  await don("THU-HD-3", TRANG, chu, "pending", "now() - interval '11 minutes'");
  await don("THU-HD-4", TRANG_KHAC, chuKhac, "pending", "now()");
  const sau = await chay();
  const moi = sau.filter((x) => x.ai === "ban_hang" && x.loai === "bao_cao");
  kiem("đơn mới → ③ báo cáo lên ④ (1 dòng: không tính đơn huỷ, đơn quá 10 phút, đơn cửa hàng khác)",
    [moi.length - nen.filter((x) => x.ai === "ban_hang" && x.loai === "bao_cao").length, moi[0]?.chu, moi[0]?.luong_tu, moi[0]?.luong_den, moi[0]?.tuoi],
    [1, "Chốt đơn mới", "ban_hang", "dieu_hanh", 0]);

  const bai = (await c.query("UPDATE posts SET published_at = now() WHERE id = (SELECT id FROM posts WHERE trang_id = $1 AND status = 'published' ORDER BY id LIMIT 1) RETURNING id", [TRANG])).rowCount;
  const dang = (await chay()).filter((x) => x.ai === "noi_dung" && x.loai === "ban_giao");
  kiem("bài vừa đăng → ① bàn giao cho ②", [bai, dang.length >= 1, dang[0]?.luong_tu, dang[0]?.luong_den], [1, true, "noi_dung", "quang_cao"]);

  const tat = await chay();
  kiem("mới nhất đứng đầu, không trả nội dung tin / tên khách (chỉ 6 cột)",
    [tat.every((x, i) => i === 0 || tat[i - 1].tuoi <= x.tuoi), Object.keys(tat[0] ?? {}).sort()],
    [true, ["ai", "chu", "loai", "luong_den", "luong_tu", "tuoi"]]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: không còn đơn thử, mốc đăng bài như lúc đầu", (await pool.query(DEM, [TRANG])).rows[0], truoc);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

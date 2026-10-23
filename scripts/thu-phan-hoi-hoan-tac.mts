/**
 * THỬ THẬT TỰ HOÀN TÁC — "khách phản hồi" của từng kịch bản (mục 8, 22/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chèn dữ liệu GIẢ (kịch bản, bình luận đã nhắn riêng, khách, hội thoại, tin)
 * dưới cửa hàng + kênh có sẵn → chạy ĐÚNG câu SQL_PHAN_HOI của GET /auto-scripts → ROLLBACK TOÀN BỘ → kiểm không còn dấu.
 * Không gọi nhà cung cấp, không gửi gì ra ngoài.
 *
 *   npx tsx scripts/thu-phan-hoi-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { SQL_PHAN_HOI } from "../server/services/kich-ban-ap-dung.js";

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
const DAU = "thu-phan-hoi-";
const DEM = `SELECT (SELECT count(*) FROM comments WHERE id LIKE '${DAU}%') + (SELECT count(*) FROM conversations WHERE id LIKE '${DAU}%')
                  + (SELECT count(*) FROM customers WHERE participant_id LIKE '${DAU}%') + (SELECT count(*) FROM auto_scripts WHERE name LIKE '${DAU}%') AS so`;

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  // Hai kênh của hai cửa hàng KHÁC nhau của cùng một tài khoản (dữ liệu có sẵn; chỉ đọc).
  const kenh = (await c.query(
    `SELECT s.id, s.user_id, s.trang_id, s.platform FROM social_accounts s
      WHERE s.trang_id IS NOT NULL AND s.platform = 'facebook' ORDER BY s.created_at`
  )).rows as { id: string; user_id: number; trang_id: number; platform: string }[];
  const k1 = kenh[0];
  if (!k1) throw new Error("Không có kênh facebook nào gắn cửa hàng để thử");
  const kb = (await c.query(
    `INSERT INTO auto_scripts (user_id, trang_id, social_account_id, name, keywords, message, match_type)
     VALUES ($1, $2, $3, $4, ARRAY['gia'], 'xin chào', 'word') RETURNING id`,
    [k1.user_id, k1.trang_id, k1.id, `${DAU}kb`]
  )).rows[0].id as number;
  const MOC = new Date("2026-10-10T10:00:00Z");
  const ngay = (n: number) => new Date(MOC.getTime() + n * 86_400_000);
  // [tác giả, có nhắn riêng?, tin khách sau tin riêng bao nhiêu ngày (null = không nhắn lại), nhắn ở kênh khác?]
  const CA: [string, boolean, number | null, boolean][] = [
    ["a", true, 1, false], // nhắn lại sau 1 ngày → TÍNH
    ["b", true, -1, false], // nhắn TRƯỚC tin riêng → không
    ["c", true, 8, false], // nhắn sau 8 ngày → không
    ["d", false, 1, false], // chưa được nhắn riêng → không
    ["e", true, 2, true], // nhắn ở hội thoại kênh khác → không
    ["f", true, null, false], // không nhắn lại → không
  ];
  for (const [ten, nhanRieng, sau, kenhKhac] of CA) {
    const tg = `${DAU}${ten}`;
    await c.query(
      `INSERT INTO comments (id, user_id, social_account_id, platform, platform_post_id, author_id, content, matched_script_id,
                             private_replied_at, trang_id)
       VALUES ($1, $2, $3, 'facebook', 'bai-thu', $4, 'gia', $5, $6, $7)`,
      [`${DAU}cm-${ten}`, k1.user_id, k1.id, tg, kb, nhanRieng ? MOC : null, k1.trang_id]
    );
    if (sau === null) continue;
    const kh = (await c.query(
      `INSERT INTO customers (user_id, social_account_id, platform, participant_id, name, trang_id)
       VALUES ($1, $2, 'facebook', $3, 'Khách thử', $4) RETURNING id`,
      [k1.user_id, k1.id, tg, k1.trang_id]
    )).rows[0].id as number;
    const ht = `${DAU}ht-${ten}`;
    await c.query(
      `INSERT INTO conversations (id, user_id, social_account_id, customer_id, platform, trang_id, last_message_at, ma_luong)
       VALUES ($1, $2, $3, $4, 'facebook', $5, $6, $1)`,
      [ht, k1.user_id, kenhKhac ? null : k1.id, kh, k1.trang_id, ngay(sau)]
    );
    await c.query(
      `INSERT INTO messages (user_id, conversation_id, sender_type, content, sent_at) VALUES ($1, $2, 'customer', 'ok', $3)`,
      [k1.user_id, ht, ngay(sau)]
    );
  }
  const so = (await c.query(`SELECT ${SQL_PHAN_HOI} AS phan_hoi FROM auto_scripts s WHERE s.id = $1`, [kb])).rows[0].phan_hoi;
  console.log({ kenh: k1.id, cuaHang: k1.trang_id, kichBan: kb, phanHoi: so });
  kiem("phan_hoi: chỉ tính khách nhắn lại TRONG 7 ngày SAU tin riêng, đúng kênh — 6 ca, đúng 1 ca tính", so, 1);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

kiem("sau ROLLBACK: không còn dòng thử nào", Number((await pool.query(DEM)).rows[0].so), 0);
await pool.end();

for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

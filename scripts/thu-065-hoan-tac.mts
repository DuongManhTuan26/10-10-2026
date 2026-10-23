/**
 * THỬ THẬT TỰ HOÀN TÁC — ④ AI Điều hành chấm hằng ngày (065, 24/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chạy SQL 065 → tạo tài khoản GIẢ + 2 cửa hàng (một có tin nhắn 24 giờ qua, một
 * không) → chạy ĐÚNG các câu SQL của services/dieu-hanh-ngay.ts (chọn cửa hàng, giành chỗ, tiền hôm nay) → kiểm → xoá tài
 * khoản bằng ĐÚNG xoaDuLieuTaiKhoan (dòng hằng ngày đi theo) → ROLLBACK TOÀN BỘ → kiểm không còn dấu. Không gọi AI, không
 * gọi nhà cung cấp.
 *
 *   npx tsx scripts/thu-065-hoan-tac.mts
 */
import fs from "node:fs";
import { pool } from "../server/db.js";
import { CHON_CUA_HANG_HOM_NAY, GIANH_CHO, TIEN_HOM_NAY, TRAN_LUOT_USD } from "../server/services/dieu-hanh-ngay.js";
import { xoaDuLieuTaiKhoan } from "../server/services/xoa-tai-khoan-that.js";

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
const DUOI = `${Date.now()}`;
const EMAIL = `thu-065-${DUOI}@example.test`;

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  await c.query(fs.readFileSync(new URL("../server/migrations/065_dieu_hanh_hang_ngay.sql", import.meta.url), "utf8"));

  const u = (await c.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'x', 'Thử 065', 'shop') RETURNING id", [EMAIL])).rows[0].id as number;
  const taoTrang = async (ten: string) =>
    (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, $3) RETURNING id", [u, `cho-cap-thu065-${ten}-${DUOI}`, ten])).rows[0].id as number;
  const coHoatDong = await taoTrang("co"), khongHoatDong = await taoTrang("khong");
  const kh = (await c.query(
    "INSERT INTO customers (user_id, platform, participant_id, trang_id) VALUES ($1, 'facebook', $2, $3) RETURNING id",
    [u, `thu065-${DUOI}`, coHoatDong]
  )).rows[0].id as number;
  const ht = `thu065-ht-${DUOI}`;
  await c.query(
    "INSERT INTO conversations (id, user_id, platform, ma_luong, customer_id, trang_id, last_message_at) VALUES ($1, $2, 'facebook', $1, $3, $4, now())",
    [ht, u, kh, coHoatDong]
  );
  await c.query("INSERT INTO messages (user_id, conversation_id, sender_type, content, sent_at) VALUES ($1, $2, 'customer', 'chào', now() - interval '2 hours')", [u, ht]);

  const cuaToi = async () => (await c.query(CHON_CUA_HANG_HOM_NAY)).rows.filter((r) => r.user_id === u).map((r) => Number(r.trang_id));
  kiem("chọn: chỉ cửa hàng có hoạt động 24 giờ (tin khách 2 giờ trước) — cửa hàng không hoạt động không được chọn",
    await cuaToi(), [coHoatDong]);

  const lan1 = (await c.query(GIANH_CHO, [u, coHoatDong])).rows[0];
  const lan2 = (await c.query(GIANH_CHO, [u, coHoatDong])).rows[0];
  kiem("giành chỗ: lần 1 có dòng, lần 2 (khởi động lại / lượt chồng) KHÔNG", [Boolean(lan1?.id), lan2 ?? null], [true, null]);
  kiem("đã có dòng hôm nay → không chọn lại cửa hàng đó", await cuaToi(), []);

  const tienTruoc = (await c.query(TIEN_HOM_NAY)).rows[0].usd as number;
  await c.query("UPDATE dieu_hanh_hang_ngay SET trang_thai = 'de_xuat', tien_usd = 0.12 WHERE id = $1", [lan1.id]);
  const tienSau = (await c.query(TIEN_HOM_NAY)).rows[0].usd as number;
  kiem("tiền hôm nay: lượt đang chạy tính tạm bằng trần lượt; xong thì lấy tiền thật (chênh = 0,12 − 0,30)",
    Math.round((tienSau - tienTruoc) * 1e6) / 1e6, Math.round((0.12 - TRAN_LUOT_USD) * 1e6) / 1e6);

  await xoaDuLieuTaiKhoan(c as never, u);
  kiem("xoá tài khoản: dòng chấm hằng ngày đi theo (0 dòng)",
    Number((await c.query("SELECT count(*) AS n FROM dieu_hanh_hang_ngay WHERE user_id = $1", [u])).rows[0].n), 0);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: không còn tài khoản thử; bảng 065 chưa tồn tại trên Neon (chưa gộp)",
  [Number((await pool.query("SELECT count(*) AS n FROM users WHERE email = $1", [EMAIL])).rows[0].n),
    (await pool.query("SELECT to_regclass('public.dieu_hanh_hang_ngay') IS NOT NULL AS co")).rows[0].co],
  [0, false]);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

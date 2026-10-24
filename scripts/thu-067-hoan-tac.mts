/**
 * THỬ THẬT TỰ HOÀN TÁC — nối quảng cáo Meta theo cửa hàng (067, H11, 24/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chạy SQL 067 → tạo tài khoản GIẢ → ghi một phiên CŨ còn temp_token (đúng
 * trạng thái đã gặp thật: phiên Facebook cũ của hồ sơ không ai sở hữu) → chạy ĐÚNG câu ghi phiên của /connect-url (đọc từ
 * routes/connections.ts) cho lượt quảng cáo → kiểm: temp_token / hồ sơ / bước cũ đã xoá, loai + trang_id đúng; đường
 * pending-selection (temp_token IS NOT NULL) không còn thấy gì → ROLLBACK TOÀN BỘ → kiểm cột chưa có trên Neon. Không gọi
 * nhà cung cấp.
 *
 *   npx tsx scripts/thu-067-hoan-tac.mts
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
const SQL_067 = fs.readFileSync(new URL("../server/migrations/067_noi_quang_cao.sql", import.meta.url), "utf8");
const nguon = fs.readFileSync(new URL("../server/routes/connections.ts", import.meta.url), "utf8");
const SQL_GHI = nguon.match(/`(INSERT INTO pending_connections \(user_id, connect_state, loai, trang_id, created_at, expires_at\)[\s\S]*?)`/)?.[1];
if (!SQL_GHI) throw new Error("Không thấy câu ghi phiên của /connect-url trong connections.ts");
const COT = "SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'pending_connections' AND column_name IN ('loai', 'trang_id')";
const EMAIL = `thu-067-${Date.now()}@example.test`;

const cotTruoc = (await pool.query(COT)).rows[0].n;
const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  await c.query(SQL_067);
  kiem("067: pending_connections có loai + trang_id", (await c.query(COT)).rows[0].n, 2);
  await c.query(SQL_067);
  kiem("067 chạy lại: không lỗi, vẫn 2 cột", (await c.query(COT)).rows[0].n, 2);

  const u = (await c.query("INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'x', 'Thử 067', 'shop') RETURNING id", [EMAIL])).rows[0].id as number;
  await c.query(
    `INSERT INTO pending_connections (user_id, connect_state, platform, profile_id, temp_token, user_profile, step, created_at, expires_at)
     VALUES ($1, 'ma-cu', 'facebook', 'ho-so-khong-ai-so-huu', 'khoa-tam-cu', '{}', 'select_page', now(), now() + interval '15 minutes')`,
    [u]
  );
  await c.query(SQL_GHI, [u, "ma-moi", "quang_cao", 370]);
  const sau = (await c.query("SELECT connect_state, loai, trang_id::int, platform, profile_id, temp_token, user_profile, connect_token, step FROM pending_connections WHERE user_id = $1", [u])).rows[0];
  kiem("ghi phiên lượt quảng cáo: mã mới + loai + cửa hàng; mọi dữ liệu lượt cũ (temp_token, hồ sơ, bước…) đã xoá",
    sau, { connect_state: "ma-moi", loai: "quang_cao", trang_id: 370, platform: null, profile_id: null, temp_token: null, user_profile: null, connect_token: null, step: null });
  kiem("đường pending-selection (temp_token IS NOT NULL) không còn thấy phiên cũ → hết báo nhầm \"không thuộc về tài khoản này\"",
    (await c.query("SELECT count(*)::int n FROM pending_connections WHERE user_id = $1 AND expires_at > now() AND temp_token IS NOT NULL", [u])).rows[0].n, 0);
  await c.query(SQL_GHI, [u, "ma-tiktok", null, null]);
  kiem("lượt nối kênh thường sau đó: loai / cửa hàng về NULL",
    (await c.query("SELECT loai, trang_id FROM pending_connections WHERE user_id = $1", [u])).rows[0], { loai: null, trang_id: null });
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: cột như lúc đầu (chưa gộp); không còn tài khoản thử",
  [(await pool.query(COT)).rows[0].n, Number((await pool.query("SELECT count(*) AS n FROM users WHERE email = $1", [EMAIL])).rows[0].n)],
  [cotTruoc, 0]);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

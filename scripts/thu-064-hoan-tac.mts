/**
 * THỬ THẬT TỰ HOÀN TÁC — chủ shop gỡ kênh = nhân viên nghỉ việc (064, 23/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: chạy SQL 064 → tạo tài khoản GIẢ + cửa hàng + kênh (mở nhiệm kỳ bằng ĐÚNG
 * ganKenhVaoTrangTrong) + kịch bản + hội thoại + bài hẹn giờ → hauQuaChuyenKenh (hộp hỏi đọc) → ĐÚNG goKenhTrong →
 * kiểm đã gỡ / nhiệm kỳ đóng / kịch bản tắt / hội thoại chỉ xem / bài hẹn giờ bị chọn gỡ lịch (nhà cung cấp mô phỏng)
 * → nối lại (đồng bộ xoá go_luc) → nhiệm kỳ MỚI, tin mới vào hội thoại MỚI → ROLLBACK TOÀN BỘ → kiểm không còn dấu.
 * Không gọi nhà cung cấp.
 *
 *   npx tsx scripts/thu-064-hoan-tac.mts
 */
import fs from "node:fs";
import { pool } from "../server/db.js";
import { CHON_BAI_KENH_DA_ROI, donLichKenhDaRoi } from "../server/services/don-lich.js";
import { LY_DO_CHI_XEM, layHoiThoaiChoTin } from "../server/services/nhiem-ky.js";
import { ganKenhVaoTrangTrong, goKenhTrong, hauQuaChuyenKenh } from "../server/services/trang.js";

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
const EMAIL = `thu-064-${DUOI}@example.test`;
const KENH = `thu-064-kenh-${DUOI}`;
const LUONG = `thu-064-luong-${DUOI}`;

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  await c.query(fs.readFileSync(new URL("../server/migrations/064_go_kenh.sql", import.meta.url), "utf8"));

  const u = (await c.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'x', 'Thử gỡ kênh', 'shop') RETURNING id", [EMAIL]
  )).rows[0].id as number;
  const t = (await c.query(
    "INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, 'Cửa hàng thử gỡ') RETURNING id", [u, `cho-cap-thu-064-${DUOI}`]
  )).rows[0].id as number;
  await c.query(
    "INSERT INTO social_accounts (id, user_id, platform, display_name, connected) VALUES ($1, $2, 'facebook', 'Kênh thử gỡ', TRUE)",
    [KENH, u]
  );
  await ganKenhVaoTrangTrong(c, KENH, u, t);
  const nk1 = (await c.query("SELECT id FROM kenh_nhiem_ky WHERE account_id = $1 AND den_luc IS NULL", [KENH])).rows[0].id as number;
  const kb = (await c.query(
    "INSERT INTO auto_scripts (user_id, trang_id, social_account_id, name, is_active) VALUES ($1, $2, $3, 'thử', TRUE) RETURNING id",
    [u, t, KENH]
  )).rows[0].id as number;
  const ht = await layHoiThoaiChoTin({ maLuong: LUONG, accountId: KENH, lucTin: new Date() }, c);
  await c.query(
    "INSERT INTO conversations (id, user_id, platform, ma_luong, social_account_id, trang_id, nhiem_ky_id) VALUES ($1, $2, 'facebook', $3, $4, $5, $6)",
    [ht.id, u, LUONG, KENH, t, nk1]
  );
  const bai = (await c.query(
    "INSERT INTO posts (user_id, trang_id, target_account_ids, status, platform_post_ref, content) VALUES ($1, $2, $3, 'scheduled', $4, 'thử') RETURNING id",
    [u, t, [KENH], `thu-064-ncc-${DUOI}`]
  )).rows[0].id as number;

  kiem("hộp hỏi đọc đúng hậu quả trước khi gỡ (1 hội thoại, 1 kịch bản, 1 bài hẹn giờ)",
    await hauQuaChuyenKenh(u, KENH, c), { baiHenGio: 1, baiChuaDang: 0, kichBanSeTat: 1, hoiThoaiOLai: 1 });
  kiem("trước khi gỡ: bài hẹn giờ KHÔNG bị chọn gỡ lịch",
    (await c.query(CHON_BAI_KENH_DA_ROI, [u])).rows.map((r) => r.id), []);

  // --- GỠ ---
  kiem("goKenhTrong trả cửa hàng kênh vừa rời", await goKenhTrong(c, KENH, u), t);
  const sa = (await c.query("SELECT connected, needs_reconnection, go_luc IS NOT NULL AS da_go, trang_id FROM social_accounts WHERE id = $1", [KENH])).rows[0];
  kiem("kênh: đã gỡ, không còn nối, không 'cần nối lại', GIỮ trang_id", sa, { connected: false, needs_reconnection: false, da_go: true, trang_id: t });
  kiem("nhiệm kỳ đã đóng, không mở nhiệm kỳ mới",
    (await c.query("SELECT id, den_luc IS NOT NULL AS dong FROM kenh_nhiem_ky WHERE account_id = $1 ORDER BY id", [KENH])).rows,
    [{ id: nk1, dong: true }]);
  const kbSau = (await c.query("SELECT is_active, tat_ly_do FROM auto_scripts WHERE id = $1", [kb])).rows[0];
  kiem("kịch bản tắt, lý do 'Kênh đã ngắt kết nối'", [kbSau.is_active, /^Kênh đã ngắt kết nối lúc /.test(kbSau.tat_ly_do)], [false, true]);
  kiem("hội thoại cũ thành chỉ xem (da_roi)",
    (await c.query(`SELECT ${LY_DO_CHI_XEM("c", "sa")} AS ly_do FROM conversations c LEFT JOIN social_accounts sa ON sa.id = c.social_account_id WHERE c.id = $1`, [ht.id])).rows[0].ly_do,
    "da_roi");
  const chon = (await c.query(CHON_BAI_KENH_DA_ROI, [u])).rows;
  kiem("bài hẹn giờ trên kênh vừa gỡ được chọn gỡ lịch (kenh_go, không kenh_roi)",
    chon.map((r) => [r.id, r.kenh_roi, r.kenh_go]), [[bai, [], ["Kênh thử gỡ"]]]);
  const goi: string[] = [];
  const kqGo = await donLichKenhDaRoi(u, async (ref) => { goi.push(ref); return {}; }, c);
  const baiSau = (await c.query("SELECT status, platform_post_ref, last_error FROM posts WHERE id = $1", [bai])).rows[0];
  kiem("gỡ lịch: gọi xoá đúng bài, bài 'failed', lý do 'đã ngắt kết nối — đã gỡ lịch'",
    [kqGo, goi, baiSau.status, baiSau.platform_post_ref, baiSau.last_error],
    [{ daGo: [bai], loi: [] }, [`thu-064-ncc-${DUOI}`], "failed", null,
      "Kênh Kênh thử gỡ đã ngắt kết nối — đã gỡ lịch bài này. Vui lòng hẹn lại cho các kênh còn lại."]);
  kiem("danh sách kênh (lọc go_luc IS NULL) không còn kênh đã gỡ",
    (await c.query("SELECT id FROM social_accounts WHERE user_id = $1 AND go_luc IS NULL", [u])).rows.length, 0);

  // --- NỐI LẠI: đồng bộ thấy kênh trong danh sách nhà cung cấp → go_luc = NULL (đúng câu upsert) → ganKenhVaoTrang ---
  await c.query("UPDATE social_accounts SET connected = TRUE, go_luc = NULL WHERE id = $1", [KENH]);
  await ganKenhVaoTrangTrong(c, KENH, u, t);
  const nkSau = (await c.query("SELECT id, den_luc IS NOT NULL AS dong FROM kenh_nhiem_ky WHERE account_id = $1 ORDER BY id", [KENH])).rows;
  kiem("nối lại: nhiệm kỳ MỚI mở (cũ vẫn đóng)", [nkSau.length, nkSau[0].dong, nkSau[1]?.dong], [2, true, false]);
  const htMoi = await layHoiThoaiChoTin({ maLuong: LUONG, accountId: KENH, lucTin: new Date(Date.now() + 1000) }, c);
  kiem("tin mới cùng luồng → hội thoại MỚI của nhiệm kỳ mới, không mở lại hội thoại cũ",
    [htMoi.id === ht.id, htMoi.id, htMoi.daDong], [false, `${LUONG}~${nkSau[1]?.id}`, false]);
  kiem("kịch bản KHÔNG tự bật lại (quay về người không)",
    (await c.query("SELECT is_active FROM auto_scripts WHERE id = $1", [kb])).rows[0].is_active, false);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}
kiem("sau ROLLBACK: không còn tài khoản / kênh thử",
  Number((await pool.query(
    "SELECT (SELECT count(*) FROM users WHERE email = $1) + (SELECT count(*) FROM social_accounts WHERE id = $2) AS n", [EMAIL, KENH]
  )).rows[0].n), 0);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

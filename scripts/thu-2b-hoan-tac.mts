/**
 * THỬ THẬT TỰ HOÀN TÁC — đợt 2b (khách / bình luận / kịch bản theo cửa hàng). Chủ dự án cho phép kiểu thử này 19/10/2026;
 * chỉ chạy sau khi phiên kiểm duyệt duyệt mã 2b.
 *
 * MỘT kết nối, MỘT giao dịch: (nếu 059 chưa áp) chạy NỘI DUNG 059 trong giao dịch → dựng dữ liệu GIẢ cho tài khoản thử 118
 * → chạy ĐÚNG mã thật (layHoacTaoKhach, layHoiThoaiChoTin, ganKenhVaoTrangTrong) trên chính kết nối đó → ROLLBACK TOÀN BỘ.
 * Không gọi nhà cung cấp, không dùng migrate.ts, không gọi hàm có transaction() riêng.
 *
 *   npx tsx scripts/thu-2b-hoan-tac.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db.js";
import { layHoacTaoKhach } from "../server/services/khach.js";
import { layHoiThoaiChoTin } from "../server/services/nhiem-ky.js";
import { ganKenhVaoTrangTrong } from "../server/services/trang.js";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TK = 118;
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
const coCot = async (bang: string, cot: string) =>
  (await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", [bang, cot])).rows.length > 0;
const co059Truoc = await coCot("customers", "trang_goc");

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  if (!co059Truoc) {
    await c.query(fs.readFileSync(path.join(GOC, "server/migrations/059_khach_binh_luan_kich_ban_theo_cua_hang.sql"), "utf8"));
    const sau = (await c.query(`
      SELECT (SELECT COUNT(*) FROM customers WHERE trang_id IS NULL OR trang_goc IS NULL)::int AS khach_thieu,
             (SELECT COUNT(*) FROM customers)::int AS khach, (SELECT COUNT(*) FROM customers_truoc_059)::int AS khach_sao_luu,
             (SELECT COUNT(*) FROM comments m JOIN social_accounts s ON s.id = m.social_account_id
               WHERE s.trang_id IS NOT NULL AND m.nhiem_ky_id IS NULL)::int AS binh_luan_thieu,
             (SELECT COUNT(*) FROM comments)::int AS binh_luan, (SELECT COUNT(*) FROM comments_truoc_059)::int AS bl_sao_luu,
             (SELECT COUNT(*) FROM auto_scripts WHERE trang_id IS NULL)::int AS kich_ban_thieu,
             (SELECT COUNT(*) FROM customers cu JOIN conversations cv ON cv.customer_id = cu.id
               WHERE cv.trang_id IS DISTINCT FROM cu.trang_id)::int AS khach_lech_hoi_thoai`)).rows[0];
    console.log("Dữ liệu thật sau nội dung 059 (trong giao dịch, sẽ hoàn tác):", sau);
    kiem("059: 0 khách thiếu cửa hàng / cửa hàng gốc; 0 bình luận thiếu nhiệm kỳ; 0 kịch bản thiếu cửa hàng; khách khớp cửa hàng hội thoại; sao lưu đủ",
      [sau.khach_thieu, sau.binh_luan_thieu, sau.kich_ban_thieu, sau.khach_lech_hoi_thoai, sau.khach_sao_luu === sau.khach, sau.bl_sao_luu === sau.binh_luan],
      [0, 0, 0, 0, true, true]);
  }

  const duoi = `${Date.now()}`;
  const taoTrang = async (ten: string) =>
    (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, $3) RETURNING id", [TK, `thu2b-${ten}-${duoi}`, ten])).rows[0].id as number;
  const A = await taoTrang("A"), B = await taoTrang("B"), C = await taoTrang("C");
  const kenh = `thu2b-kenh-${duoi}`;
  await c.query("INSERT INTO social_accounts (id, user_id, platform) VALUES ($1, $2, 'facebook')", [kenh, TK]);
  await ganKenhVaoTrangTrong(c, kenh, TK, A);

  // Điều kiện 2: chèn TRÙNG thật → ON CONFLICT khớp chỉ mục có điều kiện (cùng một hồ sơ, không lỗi).
  const khach = (trangId: number | null, ma = "psid-1", kenhKh = kenh) =>
    layHoacTaoKhach(c, { userId: TK, trangId, socialAccountId: kenhKh, platform: "facebook", participantId: ma, name: "Thử", avatarUrl: null });
  const kA1 = await khach(A), kA2 = await khach(A);
  kiem("chèn trùng (A, facebook, psid-1) hai lần → cùng MỘT hồ sơ (ON CONFLICT khớp chỉ mục có điều kiện)", kA1 === kA2, true);

  // Kịch bản của A trên kênh → kênh sang B → kịch bản TẮT; kênh quay về A → KHÔNG tự bật.
  const kb = (await c.query(
    "INSERT INTO auto_scripts (user_id, social_account_id, name, message, trang_id, is_active) VALUES ($1, $2, 'Thử', 'chào', $3, TRUE) RETURNING id",
    [TK, kenh, A])).rows[0].id;
  await ganKenhVaoTrangTrong(c, kenh, TK, B);
  const kbSauRoi = (await c.query("SELECT is_active, tat_ly_do IS NOT NULL AS co_ly_do FROM auto_scripts WHERE id = $1", [kb])).rows[0];
  const kB = await khach(B);
  await ganKenhVaoTrangTrong(c, kenh, TK, A);
  const kbSauVe = (await c.query("SELECT is_active FROM auto_scripts WHERE id = $1", [kb])).rows[0];
  const kAVe = await khach(A);
  kiem("kênh rời A → kịch bản của A trên kênh TẮT (có lý do); quay về A → vẫn tắt (chủ shop tự bật)",
    [kbSauRoi.is_active, kbSauRoi.co_ly_do, kbSauVe.is_active], [false, true, false]);
  kiem("cùng một người: ở B là hồ sơ RIÊNG; quay về A dùng lại ĐÚNG hồ sơ cũ của A (C5)", [kB !== kA1, kAVe === kA1], [true, true]);

  // Điều kiện 1: hồ sơ mồ côi của cửa hàng ĐÃ XOÁ không được kênh khác dùng lại / nhận.
  const kenhC = `thu2b-kenhC-${duoi}`;
  await c.query("INSERT INTO social_accounts (id, user_id, platform) VALUES ($1, $2, 'facebook')", [kenhC, TK]);
  const kC = await khach(C, "psid-moco", kenhC);
  await c.query("DELETE FROM trang WHERE id = $1", [C]);
  const moCoi = (await c.query("SELECT trang_id, trang_goc FROM customers WHERE id = $1", [kC])).rows[0];
  const kenhMoi = `thu2b-kenhMoi-${duoi}`;
  await c.query("INSERT INTO social_accounts (id, user_id, platform) VALUES ($1, $2, 'facebook')", [kenhMoi, TK]);
  const kMoiChuaGan = await khach(null, "psid-moco", kenhMoi);
  const kMoiChuaGan2 = await khach(null, "psid-moco", kenhMoi);
  kiem("xoá cửa hàng C → hồ sơ mồ côi (trang NULL, trang_gốc còn); kênh mới chưa gắn, cùng mã → hồ sơ MỚI, không dùng lại mồ côi; lần 2 dùng lại hồ sơ mới",
    [moCoi.trang_id, moCoi.trang_goc === C, kMoiChuaGan !== kC, kMoiChuaGan2 === kMoiChuaGan], [null, true, true, true]);

  // Hội thoại + khách đến lúc kênh chưa gắn → gắn A → tin sau: hội thoại VÀ khách được nhận vào A; hồ sơ mồ côi C vẫn nguyên.
  const maLuong = `thu2b-luong-${duoi}`;
  const h0 = await layHoiThoaiChoTin({ maLuong, accountId: kenhMoi, lucTin: new Date() }, c);
  await c.query(
    "INSERT INTO conversations (id, user_id, social_account_id, platform, ma_luong, trang_id, nhiem_ky_id, customer_id) VALUES ($1, $2, $3, 'facebook', $4, $5, $6, $7)",
    [h0.id, TK, kenhMoi, h0.maLuong, h0.trangId, h0.nhiemKyId, kMoiChuaGan]
  );
  await ganKenhVaoTrangTrong(c, kenhMoi, TK, A);
  await layHoiThoaiChoTin({ maLuong, accountId: kenhMoi, lucTin: new Date() }, c);
  const sauNhan = (await c.query(
    `SELECT cv.trang_id AS ht_trang, cu.trang_id AS kh_trang, cu.trang_goc AS kh_goc,
            (SELECT trang_id FROM customers WHERE id = $2) AS mo_coi_trang
       FROM conversations cv JOIN customers cu ON cu.id = cv.customer_id WHERE cv.id = $1`, [maLuong, kC])).rows[0];
  kiem("kênh chưa gắn → gắn A: hội thoại + khách (trang_gốc NULL) được nhận vào A; hồ sơ mồ côi của C vẫn không cửa hàng",
    [sauNhan.ht_trang === A, sauNhan.kh_trang === A, sauNhan.kh_goc === A, sauNhan.mo_coi_trang], [true, true, true, null]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

const sach = (await pool.query(
  `SELECT (SELECT COUNT(*) FROM trang WHERE profile_ref LIKE 'thu2b-%')::int AS trang_thu,
          (SELECT COUNT(*) FROM social_accounts WHERE id LIKE 'thu2b-%')::int AS kenh_thu,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'customers' AND column_name IN ('trang_id', 'trang_goc'))::int AS cot_khach,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'comments' AND column_name IN ('trang_id', 'nhiem_ky_id'))::int AS cot_bl,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'auto_scripts' AND column_name IN ('trang_id', 'tat_ly_do'))::int AS cot_kb,
          to_regclass('public.customers_truoc_059') IS NOT NULL AS co_sao_luu`)).rows[0];
kiem("sau ROLLBACK: không còn dữ liệu thử; cột / bảng sao lưu của 059 trở lại đúng như trước",
  [sach.trang_thu, sach.kenh_thu, sach.cot_khach, sach.cot_bl, sach.cot_kb, sach.co_sao_luu],
  [0, 0, co059Truoc ? 2 : 0, co059Truoc ? 2 : 0, co059Truoc ? 2 : 0, co059Truoc]);
await pool.end();

for (const k of ket) console.log(`${k.dat ? "✓" : "✗"} ${k.ten}${k.dat ? "" : `\n   ${JSON.stringify(k.chiTiet)}`}`);
const hong = ket.filter((k) => !k.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

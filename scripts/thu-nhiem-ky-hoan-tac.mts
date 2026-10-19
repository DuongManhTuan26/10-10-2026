/**
 * THỬ THẬT TỰ HOÀN TÁC — nhiệm kỳ kênh (đợt 2a). Chủ dự án cho phép 19/10/2026; chỉ chạy sau khi phiên kiểm duyệt duyệt
 * mã 2a.
 *
 * MỘT kết nối, MỘT giao dịch: (nếu 058 chưa áp) chạy NỘI DUNG 058 ngay trong giao dịch → dựng 2 cửa hàng + 1 kênh GIẢ cho
 * tài khoản thử 118 → kênh A → B → quay về A (3 nhiệm kỳ) → đưa tin vào từng khoảng qua layHoiThoaiChoTin → kiểm dòng
 * hội thoại, cửa hàng, nhiệm kỳ, chốt cửa ra → ROLLBACK TOÀN BỘ (kể cả bảng / cột của 058). Không gọi nhà cung cấp.
 * KHÔNG dùng migrate.ts (không ghi sổ migration), KHÔNG gọi hàm có transaction() riêng (sẽ COMMIT thật).
 *
 *   npx tsx scripts/thu-nhiem-ky-hoan-tac.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db.js";
import { doiNhiemKy, layHoiThoaiChoTin } from "../server/services/nhiem-ky.js";
import { chanCuaRa, type KenhXet } from "../server/services/cua-ra.js";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAI_KHOAN_THU = 118;
const ket: { ten: string; dat: boolean; chiTiet?: unknown }[] = [];
const kiem = (ten: string, thuc: unknown, mong: unknown) => {
  const dat = JSON.stringify(thuc) === JSON.stringify(mong);
  ket.push({ ten, dat, chiTiet: dat ? undefined : { thuc, mong } });
};

const c = await pool.connect();
let co058Truoc = false;
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL statement_timeout = '60s'");
  co058Truoc = (await c.query("SELECT to_regclass('public.kenh_nhiem_ky') IS NOT NULL AS co")).rows[0].co;
  if (!co058Truoc) {
    await c.query(fs.readFileSync(path.join(GOC, "server/migrations/058_nhiem_ky_kenh.sql"), "utf8"));
    // Dữ liệu thật sau 058 (vẫn trong giao dịch): mọi kênh có cửa hàng có đúng 1 nhiệm kỳ mở; mọi hội thoại có nhiệm kỳ.
    const sau = (await c.query(`
      SELECT (SELECT COUNT(*) FROM social_accounts WHERE trang_id IS NOT NULL)::int AS kenh_co_cua_hang,
             (SELECT COUNT(*) FROM kenh_nhiem_ky WHERE den_luc IS NULL)::int AS nhiem_ky_mo,
             (SELECT COUNT(*) FROM conversations WHERE nhiem_ky_id IS NULL)::int AS hoi_thoai_chua_nhiem_ky,
             (SELECT COUNT(*) FROM conversations WHERE ma_luong <> id)::int AS hoi_thoai_doi_ma,
             (SELECT COUNT(*) FROM conversations_truoc_058)::int AS sao_luu`)).rows[0];
    console.log("Dữ liệu thật sau nội dung 058 (trong giao dịch, sẽ hoàn tác):", sau);
    kiem("058: mỗi kênh có cửa hàng = 1 nhiệm kỳ mở; 0 hội thoại thiếu nhiệm kỳ; không đổi mã dòng cũ",
      [sau.nhiem_ky_mo === sau.kenh_co_cua_hang, sau.hoi_thoai_chua_nhiem_ky, sau.hoi_thoai_doi_ma], [true, 0, 0]);
  }

  // Dựng dữ liệu GIẢ cho tài khoản thử.
  const duoi = `${Date.now()}`;
  const A = (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, 'Thử A') RETURNING id", [TAI_KHOAN_THU, `thu-a-${duoi}`])).rows[0].id;
  const B = (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, 'Thử B') RETURNING id", [TAI_KHOAN_THU, `thu-b-${duoi}`])).rows[0].id;
  const kenh = `thu-kenh-${duoi}`;
  await c.query("INSERT INTO social_accounts (id, user_id, platform, trang_id) VALUES ($1, $2, 'facebook', $3)", [kenh, TAI_KHOAN_THU, A]);

  // A → B → quay về A. Trong một giao dịch now() đứng yên → đặt mốc giờ bằng tay sau mỗi lần đổi.
  await doiNhiemKy(c, { accountId: kenh, userId: TAI_KHOAN_THU, trangMoi: A });
  await doiNhiemKy(c, { accountId: kenh, userId: TAI_KHOAN_THU, trangMoi: B });
  await doiNhiemKy(c, { accountId: kenh, userId: TAI_KHOAN_THU, trangMoi: A });
  const ds = (await c.query("SELECT id, trang_id, den_luc FROM kenh_nhiem_ky WHERE account_id = $1 ORDER BY id", [kenh])).rows;
  kiem("3 nhiệm kỳ: A (đóng), B (đóng), A (mở) — quay về là nhiệm kỳ MỚI",
    ds.map((r: { trang_id: number; den_luc: Date | null }) => [r.trang_id === A ? "A" : "B", r.den_luc ? "dong" : "mo"]),
    [["A", "dong"], ["B", "dong"], ["A", "mo"]]);
  const [nk1, nk2, nk3] = ds.map((r: { id: number }) => r.id);
  await c.query(
    `UPDATE kenh_nhiem_ky SET tu_luc = CASE id WHEN $1 THEN now() - interval '3 hours' WHEN $2 THEN now() - interval '2 hours' ELSE now() - interval '1 hour' END,
            den_luc = CASE id WHEN $1 THEN now() - interval '2 hours' WHEN $2 THEN now() - interval '1 hour' ELSE NULL END
      WHERE id IN ($1, $2, $3)`,
    [nk1, nk2, nk3]
  );
  const gio = (await c.query("SELECT now() AS t")).rows[0].t as Date;
  const luc = (phutTruoc: number) => new Date(gio.getTime() - phutTruoc * 60_000);

  // Cùng MỘT luồng tin của nhà cung cấp, 3 khoảng thời gian.
  const maLuong = `thu-luong-${duoi}`;
  const ghiDong = async (h: Awaited<ReturnType<typeof layHoiThoaiChoTin>>) =>
    c.query(
      `INSERT INTO conversations (id, user_id, social_account_id, platform, ma_luong, trang_id, nhiem_ky_id)
       VALUES ($1, $2, $3, 'facebook', $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [h.id, TAI_KHOAN_THU, kenh, h.maLuong, h.trangId, h.nhiemKyId]
    );
  const h1 = await layHoiThoaiChoTin({ maLuong, accountId: kenh, lucTin: luc(150) }, c); await ghiDong(h1);
  const h2 = await layHoiThoaiChoTin({ maLuong, accountId: kenh, lucTin: luc(90) }, c); await ghiDong(h2);
  const h3 = await layHoiThoaiChoTin({ maLuong, accountId: kenh, lucTin: luc(30) }, c); await ghiDong(h3);
  const h1b = await layHoiThoaiChoTin({ maLuong, accountId: kenh, lucTin: luc(149) }, c);
  kiem("cùng một luồng → 3 dòng: nhiệm kỳ A cũ (mã luồng), B, A mới (hậu tố); tin muộn của nhiệm kỳ cũ vẫn về đúng dòng cũ",
    [[h1.id, h1.trangId === A, h1.daDong], [h2.id, h2.trangId === B, h2.daDong], [h3.id, h3.trangId === A, h3.daDong], h1b.id],
    [[maLuong, true, true], [`${maLuong}~${nk2}`, true, true], [`${maLuong}~${nk3}`, true, false], maLuong]);

  // Chốt cửa ra theo nhiệm kỳ (đọc kênh qua chính giao dịch này).
  const docQuaGiaoDich = async (uid: number, ids: string[]): Promise<KenhXet[]> =>
    (await c.query(
      `SELECT s.id, s.trang_id, s.connected,
              (SELECT k.id FROM kenh_nhiem_ky k WHERE k.account_id = s.id AND k.den_luc IS NULL) AS nhiem_ky_mo
         FROM social_accounts s WHERE s.user_id = $1 AND s.id = ANY($2::text[])`, [uid, ids])).rows;
  const thuChot = async (trang: number, nk: number) => {
    try { return (await chanCuaRa(TAI_KHOAN_THU, [kenh], trang, docQuaGiaoDich, nk)).duoc; } catch (e) { return `${(e as { status?: number }).status}`; }
  };
  kiem("chốt cửa ra: hội thoại A cũ (kênh đã quay về A) KHÔNG gửi được; B (kênh đã rời) không; A mới gửi được",
    [await thuChot(A, nk1), await thuChot(B, nk2), await thuChot(A, nk3)], ["409", "409", [kenh]]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
}

// Sau hoàn tác: không còn dấu vết.
const sach = (await pool.query(
  `SELECT to_regclass('public.kenh_nhiem_ky') IS NOT NULL AS co_bang,
          (SELECT COUNT(*) FROM trang WHERE profile_ref LIKE 'thu-a-%' OR profile_ref LIKE 'thu-b-%')::int AS trang_thu,
          (SELECT COUNT(*) FROM social_accounts WHERE id LIKE 'thu-kenh-%')::int AS kenh_thu`)).rows[0];
kiem("sau ROLLBACK: không còn cửa hàng / kênh thử; bảng nhiệm kỳ trở lại đúng như trước",
  [sach.trang_thu, sach.kenh_thu, sach.co_bang], [0, 0, co058Truoc]);
await pool.end();

for (const k of ket) console.log(`${k.dat ? "✓" : "✗"} ${k.ten}${k.dat ? "" : `\n   ${JSON.stringify(k.chiTiet)}`}`);
const hong = ket.filter((k) => !k.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

/**
 * THỬ THẬT TỰ HOÀN TÁC — đợt 3 (gỡ lịch khi kênh rời, hội thoại chỉ xem, hậu quả chuyển kênh, bài về nháp sau gỡ).
 * Chủ dự án cho phép kiểu thử này 19/10/2026; chỉ chạy sau khi phiên kiểm duyệt duyệt mã đợt 3.
 *
 * MỘT kết nối, MỘT giao dịch: dựng dữ liệu GIẢ cho tài khoản thử 118 → chạy ĐÚNG mã thật (ganKenhVaoTrangTrong,
 * CHON_BAI_KENH_DA_ROI, donLichKenhDaRoi, LY_DO_CHI_XEM, hauQuaChuyenKenh, BAI_VE_NHAP_SAU_GO) trên chính kết nối đó →
 * ROLLBACK TOÀN BỘ. Nhà cung cấp là MÔ PHỎNG (không gọi DELETE / unpublish thật).
 *
 *   npx tsx scripts/thu-3-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { ZernioError } from "../server/services/zernio.js";
import { BAI_VE_NHAP_SAU_GO, CHON_BAI_KENH_DA_ROI, donLichKenhDaRoi } from "../server/services/don-lich.js";
import { DK_NHIEM_KY_MO, LY_DO_CHI_XEM, layHoiThoaiChoTin } from "../server/services/nhiem-ky.js";
import { ganKenhVaoTrangTrong, hauQuaChuyenKenh } from "../server/services/trang.js";

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

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");

  const duoi = `${Date.now()}`;
  const taoTrang = async (ten: string) =>
    (await c.query("INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, $3) RETURNING id", [TK, `thu3-${ten}-${duoi}`, ten])).rows[0].id as number;
  const A = await taoTrang("A"), B = await taoTrang("B");
  const taoKenh = async (ten: string, platform: string, trang: number) => {
    const id = `thu3-${ten}-${duoi}`;
    await c.query("INSERT INTO social_accounts (id, user_id, platform, display_name) VALUES ($1, $2, $3, $4)", [id, TK, platform, `Kênh ${ten}`]);
    await ganKenhVaoTrangTrong(c, id, TK, trang);
    return id;
  };
  const k1 = await taoKenh("k1", "facebook", A), k2 = await taoKenh("k2", "facebook", A), k3 = await taoKenh("k3", "instagram", B);
  const taoBai = async (trang: number, kenh: string[], status: string, ref: string | null) =>
    (await c.query(
      "INSERT INTO posts (user_id, trang_id, target_account_ids, status, platform_post_ref, content) VALUES ($1, $2, $3, $4, $5, 'thử') RETURNING id",
      [TK, trang, kenh, status, ref])).rows[0].id as number;
  const P1 = await taoBai(A, [k1], "scheduled", `thu3-ncc-1-${duoi}`);
  const P2 = await taoBai(A, [k2], "scheduled", `thu3-ncc-2-${duoi}`);
  const P3 = await taoBai(B, [k3], "scheduled", `thu3-ncc-3-${duoi}`);
  const P4 = await taoBai(A, [k1, k2], "scheduled", `thu3-ncc-4-${duoi}`);
  const P5 = await taoBai(A, [k1], "draft", null);
  const P6 = await taoBai(A, [k1], "scheduled", null);
  const P7 = await taoBai(A, [k1], "scheduled", `thu3-ncc-7-${duoi}`);
  const P8 = await taoBai(A, [k1], "published", `thu3-ncc-8-${duoi}`);
  const BAI_THU = [P1, P2, P3, P4, P5, P6, P7, P8];
  await c.query("INSERT INTO auto_scripts (user_id, social_account_id, name, message, trang_id, is_active) VALUES ($1, $2, 'Thử', 'chào', $3, TRUE)", [TK, k1, A]);

  // Hội thoại: h1 trên k1 (sẽ rời), h2 trên k2 (ở lại), h0 trên kênh chưa gắn cửa hàng.
  const taoHoiThoai = async (kenh: string, ma: string) => {
    const h = await layHoiThoaiChoTin({ maLuong: `thu3-${ma}-${duoi}`, accountId: kenh, lucTin: new Date() }, c);
    await c.query(
      "INSERT INTO conversations (id, user_id, social_account_id, platform, ma_luong, trang_id, nhiem_ky_id) VALUES ($1, $2, $3, 'facebook', $4, $5, $6)",
      [h.id, TK, kenh, h.maLuong, h.trangId, h.nhiemKyId]);
    return h.id;
  };
  const h1 = await taoHoiThoai(k1, "h1"), h2 = await taoHoiThoai(k2, "h2");
  const k0 = `thu3-k0-${duoi}`;
  await c.query("INSERT INTO social_accounts (id, user_id, platform) VALUES ($1, $2, 'facebook')", [k0, TK]);
  const h0 = await taoHoiThoai(k0, "h0");

  // 3.4 hậu quả TRƯỚC khi chuyển k1.
  kiem("hậu quả chuyển k1: hẹn giờ 4 (P1 P4 P6 P7), chưa đăng 1 (P5), kịch bản tắt 1, hội thoại ở lại 1",
    await hauQuaChuyenKenh(TK, k1, c), { baiHenGio: 4, baiChuaDang: 1, kichBanSeTat: 1, hoiThoaiOLai: 1 });
  kiem("hậu quả kênh chưa gắn cửa hàng: mọi số 0", await hauQuaChuyenKenh(TK, k0, c),
    { baiHenGio: 0, baiChuaDang: 0, kichBanSeTat: 0, hoiThoaiOLai: 0 });

  const chon = async () =>
    (await c.query<{ id: number }>(CHON_BAI_KENH_DA_ROI, [TK])).rows.map((r) => r.id).filter((id) => BAI_THU.includes(id)).sort((x, y) => x - y);
  kiem("trước khi chuyển: không chọn bài nào để gỡ lịch", await chon(), []);

  const daRoi = await ganKenhVaoTrangTrong(c, k1, TK, B);
  kiem("chuyển k1 A → B: trả về cửa hàng vừa rời = A", daRoi === A, true);
  // ĐIỀU KIỆN 5: chỉ bài hẹn giờ ĐÃ GIAO nhà cung cấp có kênh đích đã rời cửa hàng của bài.
  kiem("sau khi chuyển: CHỈ chọn P1, P4, P7 (không P2 kênh ở lại, không P3 của B, không P5 nháp, không P6 chưa giao, không P8 đã đăng)",
    await chon(), [P1, P4, P7].sort((x, y) => x - y));

  // 3.3 cờ chỉ xem trên dữ liệu thật của nhiệm kỳ.
  const cx = (await c.query<{ id: string; chi_xem: string | null }>(
    `SELECT c.id, ${LY_DO_CHI_XEM("c", "sa")} AS chi_xem FROM conversations c LEFT JOIN social_accounts sa ON sa.id = c.social_account_id
      WHERE c.id = ANY($1::text[])`, [[h0, h1, h2]])).rows;
  const cxCua = (id: string) => cx.find((r) => r.id === id)?.chi_xem ?? "khong-thay";
  kiem("chỉ xem: h1 (k1 đã rời) = da_roi; h2 (k2 ở lại) = null; h0 (kênh chưa gắn) = chua_gan", [cxCua(h1), cxCua(h2), cxCua(h0)], ["da_roi", null, "chua_gan"]);
  // Khớp chốt cửa ra: nhiệm kỳ của h1 đã đóng (DK_NHIEM_KY_MO sai), h2 còn mở.
  const mo = (await c.query(
    `SELECT c.id, ${DK_NHIEM_KY_MO("c.nhiem_ky_id")} AS mo FROM conversations c WHERE c.id = ANY($1::text[])`, [[h1, h2]])).rows;
  kiem("khớp chốt cửa ra: nhiệm kỳ h1 đóng, h2 mở", [mo.find((r) => r.id === h1)?.mo, mo.find((r) => r.id === h2)?.mo], [false, true]);

  // 3.1 gỡ lịch với nhà cung cấp MÔ PHỎNG: P1 xoá được, P4 đã kịp đăng (400), P7 không còn (404).
  const goi: string[] = [];
  const nccGia = async (ref: string) => {
    goi.push(ref);
    if (ref.startsWith("thu3-ncc-4-")) throw new ZernioError("Cannot delete published posts", 400);
    if (ref.startsWith("thu3-ncc-7-")) throw new ZernioError("Post not found", 404);
    if (!ref.startsWith("thu3-")) throw new ZernioError("không đụng bài thật của tài khoản thử", 500);
    return {};
  };
  const kq = await donLichKenhDaRoi(TK, nccGia, c);
  kiem("gỡ lịch: gọi xoá ĐÚNG 3 mã nhà cung cấp của P1, P4, P7", goi.filter((r) => r.startsWith("thu3-")).sort(),
    [`thu3-ncc-1-${duoi}`, `thu3-ncc-4-${duoi}`, `thu3-ncc-7-${duoi}`]);
  kiem("gỡ lịch: đã gỡ P1 + P7 (404 coi như đã gỡ), lỗi P4 (đã kịp đăng)",
    [kq.daGo.filter((id) => BAI_THU.includes(id)).sort((x, y) => x - y), kq.loi.filter((id) => BAI_THU.includes(id))],
    [[P1, P7].sort((x, y) => x - y), [P4]]);
  const bai = (await c.query<{ id: number; status: string; platform_post_ref: string | null; last_error: string | null }>(
    "SELECT id, status, platform_post_ref, last_error FROM posts WHERE id = ANY($1::bigint[])", [BAI_THU])).rows;
  const b = (id: number) => bai.find((r) => r.id === id)!;
  kiem("P1: failed, bỏ mã nhà cung cấp, lý do có tên kênh + 'đã gỡ lịch'",
    [b(P1).status, b(P1).platform_post_ref, /Kênh k1.*đã gỡ lịch/.test(b(P1).last_error ?? "")], ["failed", null, true]);
  kiem("P4: vẫn scheduled, giữ mã, lý do 'đã kịp đăng'", [b(P4).status, b(P4).platform_post_ref != null, /đã kịp đăng/.test(b(P4).last_error ?? "")],
    ["scheduled", true, true]);
  kiem("P2, P3, P5, P6, P8 không bị đụng", [b(P2).status, b(P3).status, b(P5).status, b(P6).status, b(P8).status, b(P2).last_error, b(P3).last_error],
    ["scheduled", "scheduled", "draft", "scheduled", "published", null, null]);
  const kq2 = await donLichKenhDaRoi(TK, nccGia, c);
  kiem("gọi lại lần 2: chỉ còn P4 (lỗi), không gỡ lại P1 / P7", [kq2.daGo.filter((id) => BAI_THU.includes(id)), kq2.loi.filter((id) => BAI_THU.includes(id))],
    [[], [P4]]);

  // 3.2(a) bài về nháp sau khi gỡ hết — câu cập nhật THẬT (stats / platform_urls NOT NULL).
  const veNhap = (await c.query(BAI_VE_NHAP_SAU_GO, [P8, "Đã gỡ khỏi Kênh k1 lúc thử."])).rows[0];
  kiem("P8 gỡ hết: về nháp, bỏ mã, stats = {}, platform_urls = {}, có ghi chú",
    [veNhap.status, veNhap.platform_post_ref, veNhap.stats, veNhap.platform_urls, veNhap.last_error],
    ["draft", null, {}, {}, "Đã gỡ khỏi Kênh k1 lúc thử."]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

const sach = (await pool.query(
  `SELECT (SELECT COUNT(*) FROM trang WHERE profile_ref LIKE 'thu3-%')::int AS trang_thu,
          (SELECT COUNT(*) FROM social_accounts WHERE id LIKE 'thu3-%')::int AS kenh_thu,
          (SELECT COUNT(*) FROM posts WHERE platform_post_ref LIKE 'thu3-%' OR (content = 'thử' AND user_id = $1))::int AS bai_thu,
          (SELECT COUNT(*) FROM conversations WHERE id LIKE 'thu3-%')::int AS hoi_thoai_thu`, [TK])).rows[0];
kiem("sau ROLLBACK: không còn dữ liệu thử", [sach.trang_thu, sach.kenh_thu, sach.bai_thu, sach.hoi_thoai_thu], [0, 0, 0, 0]);
await pool.end();

for (const k of ket) console.log(`${k.dat ? "✓" : "✗"} ${k.ten}${k.dat ? "" : `\n   ${JSON.stringify(k.chiTiet)}`}`);
const hong = ket.filter((k) => !k.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

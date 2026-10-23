/**
 * THỬ THẬT TỰ HOÀN TÁC — xoá tài khoản xoá sạch dữ liệu (mục 11a, 23/10/2026).
 *
 * MỘT kết nối, MỘT giao dịch trên Neon thật: tạo tài khoản GIẢ + cửa hàng + một dòng ở MỌI bảng có user_id (cột bắt buộc
 * điền theo kiểu, đọc từ lược đồ) → gọi ĐÚNG xoaDuLieuTaiKhoan → đếm: bảng xoá theo khoá ngoại / xoá tay / sao lưu còn 0,
 * bảng GIỮ còn nguyên → ROLLBACK TOÀN BỘ → kiểm không còn dấu. Không gọi nhà cung cấp.
 *
 *   npx tsx scripts/thu-xoa-tai-khoan-hoan-tac.mts
 */
import { pool } from "../server/db.js";
import { BANG_GIU, BANG_SAO_LUU, BANG_XOA_THEM, xoaDuLieuTaiKhoan } from "../server/services/xoa-tai-khoan-that.js";

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
const EMAIL = `thu-xoa-${Date.now()}@example.test`;

/** Giá trị mặc định theo kiểu cho cột bắt buộc không có giá trị mặc định. */
function giaTri(kieu: string, cot: string): string {
  if (/^(character varying|text)$/.test(kieu)) return `'thu-${cot}'`;
  if (/^(integer|bigint|smallint|numeric|double precision|real)$/.test(kieu)) return "0";
  if (/^timestamp/.test(kieu)) return "now()";
  if (kieu === "date") return "current_date";
  if (kieu === "boolean") return "false";
  if (/^jsonb?$/.test(kieu)) return "'{}'";
  if (kieu === "ARRAY") return "'{}'";
  if (kieu === "uuid") return "gen_random_uuid()";
  if (kieu === "bytea") return "'\\x00'::bytea";
  throw new Error(`Chưa biết điền kiểu ${kieu} (${cot})`);
}
// Cột có CHECK / khoá — giá trị hợp lệ cho từng bảng.
const RIENG: Record<string, Record<string, string>> = {
  hoi_thoai_cham: { loai: "'binh_luan'" },
  so_thay_doi: { hanh_dong: "'them'" },
  so_loi_ai: { nguon: "'soat_tay'", muc: "'nghi_van'" },
  de_xuat_dieu_hanh: { trang_thai: "'cho_duyet'" },
  ai_documents: { kind: "'sales'" },
  messages: { sender_type: "'customer'" },
  send_attempts: { actor: "'system'", decision: "'allowed'" },
};

const batDau = Date.now();
const c = await pool.connect();
let soBang = 0;
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '60s'");
  const u = (await c.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ($1, 'x', 'Thử xoá', 'shop') RETURNING id", [EMAIL]
  )).rows[0].id as number;
  const t = (await c.query(
    "INSERT INTO trang (user_id, profile_ref, ten) VALUES ($1, $2, 'Cửa hàng thử xoá') RETURNING id", [u, `cho-cap-thu-xoa-${u}`]
  )).rows[0].id as number;
  // ai_configs có trigger sổ thay đổi — xoá dây chuyền sẽ sinh dòng sổ mới, phải bị xoá theo.
  await c.query("INSERT INTO ai_configs (user_id, trang_id, kind, system_prompt) VALUES ($1, $2, 'sales', 'thử')", [u, t]);

  const bangCoUser = (await c.query(
    `SELECT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables b ON b.table_name = c.table_name AND b.table_schema = 'public' AND b.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id' ORDER BY 1`
  )).rows.map((r) => r.table_name as string);
  const daChen: string[] = [];
  for (const bang of bangCoUser) {
    if (["users", "trang", "ai_configs"].includes(bang)) continue;
    const cot = (await c.query(
      `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [bang]
    )).rows as { column_name: string; data_type: string; column_default: string | null; is_nullable: string }[];
    const ten: string[] = [], gt: string[] = [];
    for (const x of cot) {
      const rieng = RIENG[bang]?.[x.column_name];
      if (x.column_name === "user_id") { ten.push("user_id"); gt.push(String(u)); continue; }
      if (x.column_name === "trang_id") { ten.push("trang_id"); gt.push(String(t)); continue; }
      if (rieng) { ten.push(x.column_name); gt.push(rieng); continue; }
      if (x.is_nullable === "NO" && x.column_default === null) { ten.push(x.column_name); gt.push(giaTri(x.data_type, x.column_name)); }
    }
    await c.query("SAVEPOINT chen");
    try {
      await c.query(`INSERT INTO ${bang} (${ten.join(", ")}) VALUES (${gt.join(", ")})`);
      await c.query("RELEASE SAVEPOINT chen");
      daChen.push(bang);
    } catch (e) {
      await c.query("ROLLBACK TO SAVEPOINT chen");
      console.log(`  (bỏ qua ${bang}: ${(e as Error).message.slice(0, 90)})`);
    }
  }
  soBang = daChen.length;
  // Tuần tự: một kết nối không chạy hai truy vấn cùng lúc.
  const dem = async () => {
    const ra: Record<string, number> = {};
    for (const b of bangCoUser) ra[b] = (await c.query(`SELECT count(*)::int AS n FROM ${b} WHERE user_id = $1`, [u])).rows[0].n as number;
    return ra;
  };
  const truoc = await dem();
  await xoaDuLieuTaiKhoan(c as never, u);
  const sau = await dem();
  const conLai = Object.entries(sau).filter(([b, n]) => n > 0 && !(b in BANG_GIU)).map(([b]) => b);
  const giuDuoc = Object.keys(BANG_GIU).map((b) => [b, (truoc[b] ?? 0) > 0 && sau[b] === truoc[b]]);
  console.log({ taiKhoan: u, cuaHang: t, soBangCoUser: bangCoUser.length, daChen: daChen.length, soThayDoiTruoc: truoc.so_thay_doi });
  kiem("đã chèn dữ liệu thử vào đủ các bảng xoá tay + sao lưu + giữ",
    [...BANG_XOA_THEM, ...BANG_SAO_LUU, ...Object.keys(BANG_GIU)].filter((b) => !daChen.includes(b) && b !== "so_thay_doi"), []);
  kiem("sau khi xoá: mọi bảng có user_id còn 0 dòng của tài khoản (kể cả sổ thay đổi sinh ra lúc xoá dây chuyền), trừ bảng GIỮ", conLai, []);
  kiem("bảng GIỮ (sổ tiền) còn nguyên dòng", giuDuoc, Object.keys(BANG_GIU).map((b) => [b, true]));
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK (${soBang} bảng đã chèn).`);
}
kiem("sau ROLLBACK: không còn tài khoản thử", Number((await pool.query("SELECT count(*) AS n FROM users WHERE email = $1", [EMAIL])).rows[0].n), 0);
await pool.end();
for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

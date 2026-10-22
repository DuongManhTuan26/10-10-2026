/**
 * THỬ THẬT TỰ HOÀN TÁC — 061 (sổ chi ngoài app + bảng mã Telegram). Luật quy trình 22/10/2026: migration có điền dữ liệu
 * phải chạy nội dung trong một giao dịch trên Neon thật trước khi gộp.
 *
 * MỘT kết nối, MỘT giao dịch: chạy nội dung 061 → đọc lại sổ chi ngoài app → tính đối chiếu ĐÚNG công thức doiChieuTong
 * (chiNgoaiSoSauMoc + phanLech) với số THẬT của nhà cung cấp (OpenRouter /api/v1/key — đọc, miễn phí) → kiểm bảng mã
 * Telegram (chỉ chủ mã tìm thấy) → ROLLBACK TOÀN BỘ.
 *
 *   npx tsx scripts/thu-061-hoan-tac.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db.js";
import { env } from "../server/env.js";
import { chiNgoaiSoSauMoc, phanLech, type ChiNgoaiSo } from "../server/services/chi-phi.js";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const coTruoc = (await pool.query("SELECT to_regclass('public.ma_telegram_da_phat') IS NOT NULL AS co")).rows[0].co as boolean;
const k = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } });
const nccDaTieu = Number(((await k.json()) as { data?: { usage?: number } }).data?.usage);
if (!Number.isFinite(nccDaTieu)) throw new Error(`Không đọc được số nhà cung cấp (HTTP ${k.status})`);

const batDau = Date.now();
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout = '3s'");
  await c.query("SET LOCAL statement_timeout = '30s'");
  if (!coTruoc) await c.query(fs.readFileSync(path.join(GOC, "server/migrations/061_chi_ngoai_so_va_ma_telegram.sql"), "utf8"));

  const ds = ((await c.query("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'chi_ngoai_so'")).rows[0]?.gia_tri ?? []) as ChiNgoaiSo[];
  const moc = (await c.query("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'moc_doi_chieu_ai'")).rows[0]?.gia_tri as
    | { luc: string; nccUsd: number } | undefined;
  if (!moc) throw new Error("Chưa có mốc đối chiếu");
  const TIEN = "coalesce(a.cost_ncc, a.cost_usd)";
  const sau = (await c.query(
    `SELECT coalesce(sum(${TIEN}) FILTER (WHERE a.doi_chieu_at IS NOT NULL), 0)::float AS chot,
            coalesce(sum(${TIEN}) FILTER (WHERE a.doi_chieu_at IS NULL), 0)::float AS cho
       FROM ai_usage a WHERE a.created_at >= $1`, [moc.luc])).rows[0];
  const ngoai = chiNgoaiSoSauMoc(ds, moc.luc);
  const nccSau = nccDaTieu - moc.nccUsd;
  const chenhCu = nccSau - sau.chot, chenhMoi = nccSau - ngoai - sau.chot;
  const lechCu = phanLech(chenhCu, sau.cho), lechMoi = phanLech(chenhMoi, sau.cho);
  console.log({ nccDaTieu, mocNcc: moc.nccUsd, nccSau, soChot: sau.chot, soCho: sau.cho, ngoai, lechCu, lechMoi });
  kiem("061: sổ chi ngoài app có đúng 2 khoản, cộng 8,0733096; cả hai nằm sau mốc", [ds.map((x) => [x.ma, x.usd]), ngoai.toFixed(7)],
    [[["bo_de_jsonl", 7.890923], ["bo_de_phan_bien", 0.1823866]], "8.0733096"]);
  kiem("đối chiếu với số THẬT của nhà cung cấp: trước 061 lệch ≈ 8,07; sau 061 lệch về 0 (sai số dưới 0,0001 USD)",
    [Math.abs(lechCu - 8.0733096) < 0.001, Math.abs(lechMoi) < 0.0001], [true, true]);

  // Bảng mã Telegram: chỉ chủ mã tìm thấy.
  const admin = (await c.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")).rows[0].id as number;
  await c.query("INSERT INTO ma_telegram_da_phat (ma, user_id, het) VALUES ('thu061', $1, now() + interval '15 minutes')", [admin]);
  await c.query(
    `INSERT INTO ma_telegram_da_phat (ma, user_id, het) VALUES ('thu061', $1, now() + interval '20 minutes')
     ON CONFLICT (ma) DO UPDATE SET user_id = EXCLUDED.user_id, het = EXCLUDED.het`, [admin]);
  const chu = (await c.query("SELECT het FROM ma_telegram_da_phat WHERE ma = 'thu061' AND user_id = $1", [admin])).rows.length;
  const nguoiKhac = (await c.query("SELECT het FROM ma_telegram_da_phat WHERE ma = 'thu061' AND user_id = $1", [admin + 999999])).rows.length;
  kiem("mã Telegram: phát lại cùng mã → 1 dòng; chủ mã tìm thấy, người khác không", [chu, nguoiKhac], [1, 0]);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  console.log(`Giao dịch thử giữ trong ${Date.now() - batDau} ms rồi ROLLBACK.`);
}

const sach = (await pool.query(
  `SELECT to_regclass('public.ma_telegram_da_phat') IS NOT NULL AS co_bang,
          EXISTS (SELECT 1 FROM cai_dat_he_thong WHERE khoa = 'chi_ngoai_so') AS co_khoa`)).rows[0];
kiem("sau ROLLBACK: bảng / khoá của 061 trở lại đúng như trước", [sach.co_bang, sach.co_khoa], [coTruoc, coTruoc]);
await pool.end();

for (const x of ket) console.log(`${x.dat ? "✓" : "✗"} ${x.ten}${x.dat ? "" : `\n   ${JSON.stringify(x.chiTiet)}`}`);
const hong = ket.filter((x) => !x.dat).length;
console.log(hong ? `\nHỎNG ${hong}/${ket.length}` : `\nĐạt ${ket.length}/${ket.length}`);
process.exit(hong ? 1 : 0);

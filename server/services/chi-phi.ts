/**
 * Sao kê và cảnh báo chi phí trả cho các bên thứ ba.
 *
 * Vì sao có: tài khoản nhà cung cấp kênh từng bị tạm dừng vì chưa thanh toán
 * mà không ai biết trước — đăng bài, trả lời khách, kết nối Fanpage cùng chết.
 * Và sổ chi phí AI của app từng ghi thiếu (ảnh không được ghi): app báo 1,49
 * USD trong khi nhà cung cấp trừ thật 2,62 USD.
 *
 * Nguồn số liệu:
 *   - OpenRouter (tiền AI): đã nạp, đã tiêu, tiêu hôm nay/tuần/tháng — đọc sống.
 *   - Nhà cung cấp kênh: tiêu kỳ này, tín dụng, bị dừng không, hoá đơn cần trả
 *     (kèm link trả thẳng) — đọc sống.
 *   - Sổ ai_usage của app: chi tiết theo loại việc, theo shop, theo ngày.
 * Đối chiếu "app ghi" với "nhà cung cấp trừ thật" để lộ ra khoản ghi thiếu.
 */

import { env } from "../env.js";
import { query, queryOne } from "../db.js";
import { DAU_THANG_VN } from "../moc-thoi-gian.js";
import { banGhi, optionalString } from "./ai.js";
import { VIEC, nhomCua, tenViec, type Viec } from "./so-ai.js";
import { escapeHtml } from "./telegram.js";

/** Trang nạp tiền / thanh toán của từng bên — mở thẳng, không phải tự tìm. */
export const LINK_NAP = {
  openrouter: "https://openrouter.ai/settings/credits",
  kenh: "https://zernio.com/dashboard/billing",
  database: "https://console.neon.tech/app/billing",
} as const;

export interface NguongCanhBao {
  /** Số dư AI dưới mức này (USD) thì cảnh báo nạp thêm. */
  soDuToiThieuUsd: number;
  /** Số ngày còn đủ tiêu (theo mức tiêu 7 ngày qua) dưới mức này thì cảnh báo. */
  soNgayToiThieu: number;
  /** Hôm nay tiêu gấp chừng này lần trung bình 7 ngày qua thì cảnh báo tiêu quá. */
  heSoTieuQua: number;
}

export const NGUONG_MAC_DINH: NguongCanhBao = { soDuToiThieuUsd: 3, soNgayToiThieu: 5, heSoTieuQua: 2 };

export async function docNguong(): Promise<NguongCanhBao> {
  const r = await queryOne<{ gia_tri: unknown }>("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'nguong_chi_phi'");
  return chuanHoaNguong(r?.gia_tri);
}

export function chuanHoaNguong(tho: unknown): NguongCanhBao {
  const o = banGhi(tho);
  const so = (v: unknown, min: number, max: number, mac: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : mac;
  };
  return {
    soDuToiThieuUsd: so(o.soDuToiThieuUsd, 0, 100_000, NGUONG_MAC_DINH.soDuToiThieuUsd),
    soNgayToiThieu: so(o.soNgayToiThieu, 0, 365, NGUONG_MAC_DINH.soNgayToiThieu),
    heSoTieuQua: so(o.heSoTieuQua, 1.1, 100, NGUONG_MAC_DINH.heSoTieuQua),
  };
}

export async function luuNguong(tho: unknown): Promise<NguongCanhBao> {
  const n = chuanHoaNguong(tho);
  await query(
    `INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('nguong_chi_phi', $1::jsonb)
     ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri, updated_at = now()`,
    [JSON.stringify(n)]
  );
  return n;
}

// ---------------------------------------------------------------------------
// Đọc sống từ nhà cung cấp
// ---------------------------------------------------------------------------

export interface TinhHinhAI {
  ok: boolean;
  loi?: string;
  daNapUsd?: number;
  daTieuUsd?: number;
  conLaiUsd?: number;
  homNayUsd?: number;
  tuanNayUsd?: number;
  thangNayUsd?: number;
  /**
   * Tổng KHOÁ AI CỦA APP đã tiêu (khác daTieuUsd là của cả tài khoản nhà cung
   * cấp, gồm cả khoá khác). Đây là số đem đối chiếu với sổ của app.
   */
  khoaDaTieuUsd?: number;
}

export async function docOpenRouter(): Promise<TinhHinhAI> {
  if (!env.openrouter.apiKey) return { ok: false, loi: "Chưa cấu hình khoá AI" };
  try {
    const dau = { Authorization: `Bearer ${env.openrouter.apiKey}` };
    const [c, k] = await Promise.all([
      fetch("https://openrouter.ai/api/v1/credits", { headers: dau, signal: AbortSignal.timeout(15_000) }),
      fetch("https://openrouter.ai/api/v1/key", { headers: dau, signal: AbortSignal.timeout(15_000) }),
    ]);
    if (!c.ok) return { ok: false, loi: `Không đọc được số dư (HTTP ${c.status})` };
    const credits = banGhi(banGhi(await c.json()).data);
    const key = k.ok ? banGhi(banGhi(await k.json()).data) : {};
    const daNap = Number(credits.total_credits) || 0;
    const daTieu = Number(credits.total_usage) || 0;
    return {
      ok: true,
      daNapUsd: daNap,
      daTieuUsd: daTieu,
      conLaiUsd: Math.round((daNap - daTieu) * 1e6) / 1e6,
      homNayUsd: Number(key.usage_daily) || 0,
      tuanNayUsd: Number(key.usage_weekly) || 0,
      thangNayUsd: Number(key.usage_monthly) || 0,
      khoaDaTieuUsd: k.ok && Number.isFinite(Number(key.usage)) ? Number(key.usage) : undefined,
    };
  } catch (error) {
    return { ok: false, loi: `Không gọi được: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export interface TinhHinhKenh {
  ok: boolean;
  loi?: string;
  goi?: string;
  conHoatDong?: boolean;
  tieuKyNayUsd?: number;
  tinDungConUsd?: number;
  tamDungLuc?: string | null;
  lyDoTamDung?: string | null;
  canTraUsd?: number | null;
  linkHoaDon?: string | null;
  lyDoTuChoiThe?: string | null;
  lanThuTienTiepTheo?: string | null;
}

export async function docNhaCungCapKenh(): Promise<TinhHinhKenh> {
  try {
    const r = await fetch(`${env.zernio.baseUrl}/usage-stats`, {
      headers: { Authorization: `Bearer ${env.zernio.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    const j = banGhi(await r.json().catch(() => ({})));
    // Bị dừng vì chưa trả tiền thì mọi lệnh trả 402 — chính là điều phải báo to nhất.
    if (r.status === 402) {
      return {
        ok: true,
        conHoatDong: false,
        lyDoTamDung: optionalString(j.error) ?? "Yêu cầu thanh toán",
        linkHoaDon: optionalString(j.billingUrl) ?? LINK_NAP.kenh,
      };
    }
    if (!r.ok) return { ok: false, loi: `Không đọc được (HTTP ${r.status})` };
    const chi = banGhi(j.spend);
    const xu = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v) / 100);
    return {
      ok: true,
      goi: optionalString(j.planName) ?? undefined,
      conHoatDong: j.hasAccess !== false && !j.suspendedAt,
      tieuKyNayUsd: xu(chi.currentPeriodCents) ?? 0,
      tinDungConUsd: xu(chi.creditsRemainingCents) ?? 0,
      tamDungLuc: optionalString(j.suspendedAt) ?? null,
      lyDoTamDung: optionalString(j.suspensionReason) ?? null,
      canTraUsd: xu(j.amountDueCents),
      linkHoaDon: optionalString(j.hostedInvoiceUrl) ?? null,
      lyDoTuChoiThe: optionalString(j.declineReason) ?? null,
      lanThuTienTiepTheo: optionalString(j.nextAttemptAt) ?? null,
    };
  } catch (error) {
    return { ok: false, loi: `Không gọi được: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ---------------------------------------------------------------------------
// Sổ chi phí của app
// ---------------------------------------------------------------------------

/**
 * Tiền của một lượt: số nhà cung cấp đã chốt khi tra lại, chưa tra thì số họ
 * báo lúc gọi. Hai số này đã đo là bằng nhau; ưu tiên số đã chốt cho chắc.
 */
const TIEN = "coalesce(a.cost_ncc, a.cost_usd)";

/** Kỳ sao kê. soNgay = 0: từ đầu tháng này theo giờ Việt Nam. */
function kySaoKe(soNgay: number): { dk: string; thamSo: string[]; soNgay: number } {
  if (soNgay === 0) return { dk: `a.created_at >= ${DAU_THANG_VN}`, thamSo: [], soNgay: 0 };
  const n = Math.min(90, Math.max(1, Math.round(soNgay)));
  return { dk: "a.created_at > now() - ($1 || ' days')::interval", thamSo: [String(n)], soNgay: n };
}

export interface DongTaiKhoan {
  userId: number | null;
  ten: string;
  email: string | null;
  vaiTro: string | null;
  /** Tài khoản cha (admin con đứng trên tài khoản trang). */
  chaId: number | null;
  /** Tên tài khoản cha — để dựng đúng dòng cha kể cả khi chính nó chưa tiêu gì. */
  chaTen: string | null;
  lan: number;
  /** Tiền của RIÊNG tài khoản này — không cộng tài khoản con. */
  usd: number;
}

/**
 * Sổ chi phí AI của app trong một kỳ: theo nhóm việc (mỗi nhóm có từng việc
 * cụ thể) và theo từng tài khoản (mỗi tài khoản một dòng riêng, độc lập).
 */
export async function soChiPhiApp(soNgay: number) {
  const ky = kySaoKe(soNgay);
  const [theoViec, theoTaiKhoan, tong] = await Promise.all([
    query<{ viec: string | null; lan: number; usd: string }>(
      `SELECT a.viec, count(*)::int AS lan, coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a
        WHERE ${ky.dk} GROUP BY a.viec`,
      ky.thamSo
    ),
    query<{ user_id: number | null; email: string | null; ten: string | null; role: string | null; parent_id: number | null; cha_ten: string | null; lan: number; usd: string }>(
      `SELECT a.user_id, u.email, u.name AS ten, u.role, u.parent_id, coalesce(p.name, p.email) AS cha_ten,
              count(*)::int AS lan, coalesce(sum(${TIEN}), 0)::text AS usd
         FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN users p ON p.id = u.parent_id
        WHERE ${ky.dk}
        GROUP BY a.user_id, u.email, u.name, u.role, u.parent_id, p.name, p.email`,
      ky.thamSo
    ),
    queryOne<{ usd: string }>(`SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a`),
  ]);

  // Gom việc vào nhóm. Dòng cũ chưa có việc thì đứng riêng một nhóm, không đoán.
  const nhom = new Map<string, { nhom: string; ten: string; lan: number; usd: number; viec: { viec: string | null; ten: string; lan: number; usd: number }[] }>();
  for (const r of theoViec.rows) {
    const khoa = r.viec && r.viec in VIEC ? VIEC[r.viec as Viec].nhom : "chua_phan_loai";
    const g = nhom.get(khoa) ?? { nhom: khoa, ten: nhomCua(r.viec), lan: 0, usd: 0, viec: [] };
    g.lan += r.lan;
    g.usd += Number(r.usd);
    g.viec.push({ viec: r.viec, ten: tenViec(r.viec), lan: r.lan, usd: Number(r.usd) });
    nhom.set(khoa, g);
  }
  const theoNhom = [...nhom.values()]
    .map((g) => ({ ...g, viec: g.viec.sort((x, y) => y.usd - x.usd) }))
    .sort((x, y) => y.usd - x.usd);

  const taiKhoan: DongTaiKhoan[] = theoTaiKhoan.rows
    .map((r) => ({
      userId: r.user_id,
      ten: r.ten || r.email || (r.user_id ? `Tài khoản #${r.user_id} (đã xoá)` : "Việc chung của hệ thống"),
      email: r.email,
      vaiTro: r.role,
      chaId: r.parent_id,
      chaTen: r.cha_ten,
      lan: r.lan,
      usd: Number(r.usd),
    }))
    .sort((x, y) => y.usd - x.usd);

  return { soNgay: ky.soNgay, theoNhom, theoTaiKhoan: taiKhoan, tongTuTruocUsd: Number(tong?.usd ?? 0) };
}

// ---------------------------------------------------------------------------
// Nhật ký từng lượt
// ---------------------------------------------------------------------------

export type TrangThaiDoiChieu = "khop" | "lech" | "cho" | "khong_ma";

export interface LuotTrongSo {
  id: number;
  luc: string;
  userId: number | null;
  taiKhoan: string;
  viec: string | null;
  tenViec: string;
  nhom: string;
  model: string;
  tokenVao: number;
  tokenRa: number;
  /** Tiền tính cho lượt này: số đã chốt, chưa chốt thì số lúc gọi. */
  usd: number;
  /** Số nhà cung cấp báo ngay lúc gọi. */
  usdLucGoi: number;
  /** Số nhà cung cấp chốt khi tra lại (null = chưa tra được). */
  usdNhaCungCap: number | null;
  doiChieu: TrangThaiDoiChieu;
  loi: string | null;
}

export const LUOT_MOI_TRANG = 50;

/**
 * Từng lượt bị tính tiền, mới nhất trước. Lọc theo tài khoản (kèm các tài
 * khoản con của nó nếu muốn), theo nhóm, theo việc.
 */
export async function nhatKyLuot(loc: { soNgay: number; taiKhoan?: number | null; kemCon?: boolean; nhom?: string; viec?: string; trang?: number }) {
  const ky = kySaoKe(loc.soNgay);
  const dk = [ky.dk];
  const thamSo: unknown[] = [...ky.thamSo];
  const them = (giaTri: unknown) => {
    thamSo.push(giaTri);
    return `$${thamSo.length}`;
  };
  if (loc.taiKhoan !== undefined) {
    if (loc.taiKhoan === null) dk.push("a.user_id IS NULL");
    else if (loc.kemCon) {
      const tk = them(loc.taiKhoan);
      dk.push(`(a.user_id = ${tk} OR a.user_id IN (SELECT id FROM users WHERE parent_id = ${tk}))`);
    } else dk.push(`a.user_id = ${them(loc.taiKhoan)}`);
  }
  if (loc.viec) dk.push(loc.viec === "chua_phan_loai" ? "a.viec IS NULL" : `a.viec = ${them(loc.viec)}`);
  if (loc.nhom) {
    if (loc.nhom === "chua_phan_loai") dk.push("a.viec IS NULL");
    else {
      const ds = Object.entries(VIEC).filter(([, v]) => v.nhom === loc.nhom).map(([k]) => k);
      dk.push(`a.viec = ANY(${them(ds)}::text[])`);
    }
  }
  const where = dk.join(" AND ");
  const trang = Math.max(1, Math.floor(loc.trang ?? 1));
  const [ds, tong] = await Promise.all([
    query<{
      id: string; luc: string; user_id: number | null; email: string | null; ten: string | null; viec: string | null;
      model: string; prompt_tokens: number; completion_tokens: number; cost_usd: string; cost_ncc: string | null;
      ma_ncc: string | null; doi_chieu_at: string | null; loi: string | null;
    }>(
      `SELECT a.id, a.created_at AS luc, a.user_id, u.email, u.name AS ten, a.viec, a.model, a.prompt_tokens,
              a.completion_tokens, a.cost_usd::text, a.cost_ncc::text, a.ma_ncc, a.doi_chieu_at, a.loi
         FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id
        WHERE ${where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${LUOT_MOI_TRANG} OFFSET ${(trang - 1) * LUOT_MOI_TRANG}`,
      thamSo
    ),
    queryOne<{ lan: number; usd: string }>(
      `SELECT count(*)::int AS lan, coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a WHERE ${where}`,
      thamSo
    ),
  ]);
  const luot: LuotTrongSo[] = ds.rows.map((r) => {
    const usd = Number(r.cost_usd);
    const ncc = r.cost_ncc === null ? null : Number(r.cost_ncc);
    return {
      id: Number(r.id),
      luc: new Date(r.luc).toISOString(),
      userId: r.user_id,
      taiKhoan: r.ten || r.email || (r.user_id ? `Tài khoản #${r.user_id} (đã xoá)` : "Việc chung của hệ thống"),
      viec: r.viec,
      tenViec: tenViec(r.viec),
      nhom: nhomCua(r.viec),
      model: r.model,
      tokenVao: r.prompt_tokens,
      tokenRa: r.completion_tokens,
      usd: ncc ?? usd,
      usdLucGoi: usd,
      usdNhaCungCap: ncc,
      doiChieu: trangThaiLuot(r.ma_ncc, r.doi_chieu_at, usd, ncc),
      loi: r.loi,
    };
  });
  const lan = tong?.lan ?? 0;
  return { luot, tongLan: lan, tongUsd: Number(tong?.usd ?? 0), trang, soTrang: Math.max(1, Math.ceil(lan / LUOT_MOI_TRANG)) };
}

/** Lệch dưới một phần trăm triệu đô là sai số làm tròn của số thập phân, coi như khớp. */
const SAI_SO = 1e-8;

export function trangThaiLuot(maNcc: string | null, doiChieuAt: string | null, usd: number, ncc: number | null): TrangThaiDoiChieu {
  if (!maNcc) return "khong_ma";
  if (!doiChieuAt || ncc === null) return "cho";
  return Math.abs(ncc - usd) < SAI_SO ? "khop" : "lech";
}

// ---------------------------------------------------------------------------
// Đối chiếu tổng với nhà cung cấp
// ---------------------------------------------------------------------------

export interface DoiChieuTong {
  trangThai: "khop" | "dang_cho" | "lech";
  /** Nhà cung cấp đã trừ khoá AI của app, từ trước tới nay. */
  nhaCungCapUsd: number;
  /** Sổ của app ghi, từ trước tới nay. */
  soAppUsd: number;
  /** Khoản nhà cung cấp trừ TRƯỚC mốc đối chiếu mà sổ không có (chạy thử, sổ cũ ghi thiếu). */
  ngoaiSoTruocMocUsd: number;
  mocLuc: string;
  /** Từ mốc tới nay: nhà cung cấp trừ thêm bao nhiêu, sổ ghi bao nhiêu. */
  sauMoc: { nhaCungCapUsd: number; soDaChotUsd: number; soChoUsd: number; soLuotCho: number; chenhUsd: number };
}

interface MocDoiChieu {
  /** Tổng nhà cung cấp đã trừ tại mốc. */
  nccUsd: number;
  /** Tổng sổ app tại mốc. */
  soUsd: number;
  luc: string;
}

/**
 * Mốc đối chiếu: từ mốc này trở đi, mỗi đồng nhà cung cấp trừ phải có đúng
 * một dòng trong sổ. Trước mốc thì sổ cũ không lưu mã giao dịch và tiền chạy
 * thử dùng chung khoá — không truy được, nên tách hẳn ra một con số riêng
 * thay vì để nó làm lệch mọi phép so sau này.
 *
 * Tạo mốc lần đầu lúc không có lượt nào đang chờ nhà cung cấp chốt; còn lượt
 * chờ thì chưa tạo, vì tổng của nhà cung cấp lúc đó chưa gồm các lượt ấy.
 */
async function docMoc(nccUsd: number): Promise<MocDoiChieu | null> {
  const r = await queryOne<{ gia_tri: MocDoiChieu }>("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'moc_doi_chieu_ai'");
  if (r) return r.gia_tri;
  const gan = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM ai_usage WHERE created_at > now() - interval '30 minutes'`
  );
  if ((gan?.n ?? 0) > 0) return null;
  const so = await queryOne<{ usd: string }>(`SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a`);
  const moc: MocDoiChieu = { nccUsd, soUsd: Number(so?.usd ?? 0), luc: new Date().toISOString() };
  await query(
    `INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('moc_doi_chieu_ai', $1::jsonb) ON CONFLICT (khoa) DO NOTHING`,
    [JSON.stringify(moc)]
  );
  return docMoc(nccUsd);
}

/**
 * chenh = nhà cung cấp trừ (từ mốc) − sổ đã chốt (từ mốc).
 * Nhà cung cấp cộng tổng chậm vài phút: phần chênh nằm trong khoảng tiền của
 * các lượt còn chờ chốt thì là đang trên đường, chưa phải lệch. Âm (sổ ghi
 * nhiều hơn nhà cung cấp trừ) hay dương vượt phần đang chờ đều là lệch thật.
 */
export function trangThaiTong(chenh: number, choUsd: number): DoiChieuTong["trangThai"] {
  if (Math.abs(chenh) < 1e-6) return "khop";
  return chenh > 0 && chenh <= choUsd + 1e-6 ? "dang_cho" : "lech";
}

export async function doiChieuTong(ai: TinhHinhAI): Promise<DoiChieuTong | null> {
  if (!ai.ok || ai.khoaDaTieuUsd === undefined) return null;
  const moc = await docMoc(ai.khoaDaTieuUsd);
  if (!moc) return null;
  const [tat, sau] = await Promise.all([
    queryOne<{ usd: string }>(`SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a`),
    queryOne<{ chot: string; cho: string; lan_cho: number }>(
      `SELECT coalesce(sum(${TIEN}) FILTER (WHERE a.doi_chieu_at IS NOT NULL), 0)::text AS chot,
              coalesce(sum(${TIEN}) FILTER (WHERE a.doi_chieu_at IS NULL), 0)::text AS cho,
              count(*) FILTER (WHERE a.doi_chieu_at IS NULL)::int AS lan_cho
         FROM ai_usage a WHERE a.created_at >= $1`,
      [moc.luc]
    ),
  ]);
  const nccSau = ai.khoaDaTieuUsd - moc.nccUsd;
  const chot = Number(sau?.chot ?? 0);
  const cho = Number(sau?.cho ?? 0);
  const chenh = nccSau - chot;
  return {
    trangThai: trangThaiTong(chenh, cho),
    nhaCungCapUsd: ai.khoaDaTieuUsd,
    soAppUsd: Number(tat?.usd ?? 0),
    ngoaiSoTruocMocUsd: moc.nccUsd - moc.soUsd,
    mocLuc: moc.luc,
    sauMoc: { nhaCungCapUsd: nccSau, soDaChotUsd: chot, soChoUsd: cho, soLuotCho: sau?.lan_cho ?? 0, chenhUsd: chenh },
  };
}

// ---------------------------------------------------------------------------
// Đánh giá: lúc nào cần nạp, lúc nào tiêu quá
// ---------------------------------------------------------------------------

export interface CanhBao {
  ma: string;
  mucDo: "nguy_cap" | "can_lam" | "luu_y";
  noiDung: string;
  link?: string;
}

export function danhGia(ai: TinhHinhAI, kenh: TinhHinhKenh, nguong: NguongCanhBao): CanhBao[] {
  const ds: CanhBao[] = [];
  if (kenh.ok && kenh.conHoatDong === false) {
    ds.push({
      ma: "kenh_tam_dung",
      mucDo: "nguy_cap",
      noiDung:
        `Nhà cung cấp kênh ĐANG TẠM DỪNG tài khoản (${kenh.lyDoTamDung ?? "chưa thanh toán"}). ` +
        "Đăng bài, trả lời khách, kết nối Fanpage đều đang đứng.",
      link: kenh.linkHoaDon ?? LINK_NAP.kenh,
    });
  } else if (kenh.ok && (kenh.canTraUsd ?? 0) > 0) {
    ds.push({
      ma: "kenh_can_tra",
      mucDo: "can_lam",
      noiDung:
        `Có hoá đơn kênh cần trả: ${kenh.canTraUsd!.toFixed(2)} USD` +
        (kenh.lyDoTuChoiThe ? ` — thẻ bị từ chối: ${kenh.lyDoTuChoiThe}` : "") +
        (kenh.lanThuTienTiepTheo ? `. Lần thu tiếp: ${kenh.lanThuTienTiepTheo}` : "") +
        ". Trả ngay để không bị tạm dừng.",
      link: kenh.linkHoaDon ?? LINK_NAP.kenh,
    });
  }
  if (!kenh.ok) {
    ds.push({ ma: "kenh_khong_doc_duoc", mucDo: "luu_y", noiDung: `Chưa đọc được tình hình nhà cung cấp kênh: ${kenh.loi}` });
  }

  if (ai.ok) {
    const conLai = ai.conLaiUsd ?? 0;
    const tbNgay = (ai.tuanNayUsd ?? 0) / 7;
    const soNgayCon = tbNgay > 0 ? conLai / tbNgay : null;
    if (conLai <= 0) {
      ds.push({
        ma: "ai_het_tien",
        mucDo: "nguy_cap",
        noiDung: "Tiền AI ĐÃ HẾT. AI trả lời khách, viết bài, tạo ảnh, tạo video đều đang dừng.",
        link: LINK_NAP.openrouter,
      });
    } else if (conLai < nguong.soDuToiThieuUsd || (soNgayCon !== null && soNgayCon < nguong.soNgayToiThieu)) {
      ds.push({
        ma: "ai_sap_het",
        mucDo: "can_lam",
        noiDung:
          `Tiền AI còn ${conLai.toFixed(2)} USD` +
          (soNgayCon !== null ? `, đủ khoảng ${Math.max(0, Math.floor(soNgayCon))} ngày theo mức tiêu 7 ngày qua` : "") +
          ". Nên nạp thêm.",
        link: LINK_NAP.openrouter,
      });
    }
    if (tbNgay > 0 && (ai.homNayUsd ?? 0) > tbNgay * nguong.heSoTieuQua && (ai.homNayUsd ?? 0) >= 0.5) {
      ds.push({
        ma: "ai_tieu_qua",
        mucDo: "can_lam",
        noiDung:
          `Hôm nay đã tiêu ${(ai.homNayUsd ?? 0).toFixed(2)} USD tiền AI — gấp ${((ai.homNayUsd ?? 0) / tbNgay).toFixed(1)} lần ` +
          "trung bình 7 ngày qua. Xem mục chi tiết bên dưới để biết shop nào, việc gì đang tiêu.",
      });
    }
  } else {
    ds.push({ ma: "ai_khong_doc_duoc", mucDo: "luu_y", noiDung: `Chưa đọc được số dư AI: ${ai.loi}` });
  }
  return ds;
}

/** Toàn bộ sao kê cho màn hình quản trị. */
export async function saoKe(soNgay: number) {
  const [ai, kenh, nguong, so] = await Promise.all([docOpenRouter(), docNhaCungCapKenh(), docNguong(), soChiPhiApp(soNgay)]);
  const doiChieu = await doiChieuTong(ai);
  return {
    luc: new Date().toISOString(),
    ai,
    kenh,
    nguong,
    canhBao: danhGia(ai, kenh, nguong),
    so,
    doiChieu,
    linkNap: LINK_NAP,
  };
}

// ---------------------------------------------------------------------------
// Cảnh báo chủ động qua Telegram
// ---------------------------------------------------------------------------

/** Mỗi loại cảnh báo gửi lại tối đa 12 giờ một lần, không gửi dồn dập. */
const GUI_LAI_SAU_MS = 12 * 60 * 60_000;

export async function runDueCanhBaoChiPhi(
  gui: (adminId: number, noiDung: string) => Promise<boolean>
): Promise<number> {
  const [ai, kenh, nguong] = await Promise.all([docOpenRouter(), docNhaCungCapKenh(), docNguong()]);
  const canBao = danhGia(ai, kenh, nguong).filter((c) => c.mucDo !== "luu_y");
  if (!canBao.length) return 0;

  const daGui = banGhi((await queryOne<{ gia_tri: unknown }>(
    "SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'canh_bao_da_gui'"
  ))?.gia_tri);
  const bayGio = Date.now();
  const moi = canBao.filter((c) => !(Number(daGui[c.ma]) > bayGio - GUI_LAI_SAU_MS));
  if (!moi.length) return 0;

  const admins = await query<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
  const noiDung = [
    "⚠️ <b>CẢNH BÁO CHI PHÍ HỆ THỐNG</b>",
    "",
    // Lý do tạm dừng là chữ do nhà cung cấp gửi về: phải thoát ký tự trước khi nhúng HTML.
    ...moi.map((c) => `${c.mucDo === "nguy_cap" ? "🔴" : "🟠"} ${escapeHtml(c.noiDung)}${c.link ? `\n${escapeHtml(c.link)}` : ""}`),
    "",
    "Xem sao kê đầy đủ ở mục Quản trị → Chi phí hệ thống.",
  ].join("\n");
  let soDaGui = 0;
  for (const a of admins.rows) if (await gui(a.id, noiDung).catch(() => false)) soDaGui++;

  if (soDaGui > 0) {
    for (const c of moi) daGui[c.ma] = bayGio;
    await query(
      `INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('canh_bao_da_gui', $1::jsonb)
       ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri, updated_at = now()`,
      [JSON.stringify(daGui)]
    );
  }
  return soDaGui;
}

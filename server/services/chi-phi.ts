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
import { banGhi, optionalString } from "./ai.js";
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

export const TEN_VIEC: Record<string, string> = {
  sales: "AI trả lời khách",
  content: "Viết bài, viết lời mô tả, chia cảnh",
  extract: "Bóc tách đơn, xem video trend",
  ads: "Phân tích quảng cáo",
  analytics: "Phân tích số liệu",
  image: "Tạo ảnh",
  video: "Tạo video",
};

export async function soChiPhiApp(soNgay: number) {
  const n = Math.min(90, Math.max(1, Math.round(soNgay)));
  const [theoViec, theoShop, theoNgay, tong] = await Promise.all([
    query<{ task: string; lan: number; usd: string }>(
      `SELECT task, count(*)::int AS lan, coalesce(sum(cost_usd), 0)::text AS usd FROM ai_usage
        WHERE created_at > now() - ($1 || ' days')::interval GROUP BY task ORDER BY sum(cost_usd) DESC`,
      [String(n)]
    ),
    query<{ user_id: number | null; email: string | null; ten: string | null; lan: number; usd: string }>(
      `SELECT a.user_id, u.email, u.name AS ten, count(*)::int AS lan, coalesce(sum(a.cost_usd), 0)::text AS usd
         FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.created_at > now() - ($1 || ' days')::interval
        GROUP BY a.user_id, u.email, u.name ORDER BY sum(a.cost_usd) DESC LIMIT 50`,
      [String(n)]
    ),
    query<{ ngay: string; usd: string }>(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS ngay,
              coalesce(sum(cost_usd), 0)::text AS usd
         FROM ai_usage WHERE created_at > now() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1`,
      [String(n)]
    ),
    queryOne<{ usd: string }>("SELECT coalesce(sum(cost_usd), 0)::text AS usd FROM ai_usage"),
  ]);
  return {
    soNgay: n,
    theoViec: theoViec.rows.map((r) => ({ viec: r.task, ten: TEN_VIEC[r.task] ?? r.task, lan: r.lan, usd: Number(r.usd) })),
    theoShop: theoShop.rows.map((r) => ({
      userId: r.user_id,
      ten: r.ten || r.email || (r.user_id ? `Tài khoản #${r.user_id} (đã xoá)` : "Việc chung của hệ thống"),
      lan: r.lan,
      usd: Number(r.usd),
    })),
    theoNgay: theoNgay.rows.map((r) => ({ ngay: r.ngay, usd: Number(r.usd) })),
    tongTuTruocUsd: Number(tong?.usd ?? 0),
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
  return {
    luc: new Date().toISOString(),
    ai,
    kenh,
    nguong,
    canhBao: danhGia(ai, kenh, nguong),
    so,
    /*
     * Đối chiếu: nhà cung cấp trừ thật bao nhiêu, sổ của app ghi bao nhiêu.
     * Lệch lớn nghĩa là có chỗ gọi AI không ghi sổ.
     */
    doiChieu: ai.ok ? { nhaCungCapTruUsd: ai.daTieuUsd ?? 0, appGhiUsd: so.tongTuTruocUsd } : null,
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

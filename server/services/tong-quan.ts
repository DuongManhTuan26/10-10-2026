/**
 * TỔNG QUAN tài sản cho màn hình quản lý (chủ dự án 04/10/2026, tự thiết kế):
 *   "1: tổng số tài khoản đang hoạt động → mỗi tài khoản có bao nhiêu trang → tổng số trang đang hoạt động.
 *    2: tổng mỗi tài khoản đang tiêu hết bao nhiêu tiền → mỗi trang tiêu hết bao nhiêu tiền cụ thể cho từng loại."
 *
 * Một hàm cho cả hai tầng (quản trị tổng / admin con), chỉ khác PHẠM VI — như quan-ly-chung.ts.
 *
 * Duyệt 05/10/2026 — "chỉ bắt buộc chính xác tuyệt đối từ bây giờ trở đi":
 *   - Kỳ tính bị kẹp từ MOC_THEO_TRANG; phần trước mốc không hiện ở đây (khối Chi phí vẫn giữ hoá đơn thật).
 *   - Mỗi loại tiền lấy từ đúng nguồn của nó, kèm nhãn ĐÃ CHỐT / TẠM TÍNH theo cách nguồn đó chốt sổ:
 *       Tiền AI     — sổ ai_usage, từng lượt đã ghi trang; chốt khi mọi lượt đã đối chiếu với nhà cung cấp.
 *       Tiền kênh   — nhà cung cấp kênh tự chia cho từng kênh (docTienKenhTheoKenh, khớp hoá đơn); kênh đổi Fanpage
 *                     giữa kỳ thì chia theo số ngày ở từng trang (sổ kenh_trang_ngay); chốt khi hết kỳ.
 *       Quảng cáo   — số Meta báo đã chi của quảng cáo chạy cho ĐÚNG Fanpage của trang (lọc pageId), đọc qua kết nối
 *                     Facebook sẵn có, giữ đơn vị tiền gốc; Meta: "do not change after 28 days" → chốt sau 28 ngày.
 *       Đơn hàng    — đơn ghi trang ngay lúc tạo (orders.trang_id).
 */

import { query } from "../db.js";
import { MOC_THEO_TRANG } from "../moc-thoi-gian.js";
import * as ads from "./ads.js";
import type { PhamVi } from "./quan-ly-chung.js";
import { VIEC, type NhomViec, type Viec } from "./so-ai.js";
import * as zernio from "./zernio.js";

export type KyTongQuan = "thang_nay" | "thang_truoc";

/** Tiền AI tách theo nhóm việc (bán hàng, marketing, ảnh, video…). */
export interface TienAi {
  tongUsd: number;
  theoNhom: Partial<Record<NhomViec | "chua_phan_loai", number>>;
}

export interface KenhTongQuan {
  id: string;
  nenTang: string;
  ten: string;
  dangNoi: boolean;
  canNoiLai: boolean;
  /** Tiền kênh trong kỳ (phần của trang này). null = chưa đọc được hoá đơn kênh. */
  tienUsd: number | null;
}

export interface QuangCaoTrang {
  /** Tên tài khoản quảng cáo. */
  ten: string;
  tienTe: string;
  /** Đã chi cho quảng cáo của Fanpage này. null = chưa đọc được. */
  soTien: number | null;
  /** Cùng tài khoản quảng cáo, chi cho Fanpage khác / chỉ Instagram — chỉ để biết, KHÔNG cộng vào trang. */
  ngoaiTrang: number | null;
  /** Múi giờ tài khoản quảng cáo khác giờ Việt Nam → ngày đầu/cuối kỳ lệch theo múi giờ đó. */
  lechMuiGio?: string;
  loi?: string;
}

export interface TrangTongQuan {
  id: number;
  ten: string;
  /** Có ít nhất một kênh đang nối. */
  hoatDong: boolean;
  kenh: KenhTongQuan[];
  tienAi: TienAi;
  tienKenhUsd: number | null;
  quangCao: QuangCaoTrang[];
  /** Có Fanpage để đọc tiền quảng cáo không. */
  coFanpage: boolean;
  donHang: { so: number; doanhThu: number };
}

export interface TaiKhoanTongQuan {
  id: number;
  ten: string;
  email: string;
  role: string;
  parentId: number | null;
  hoatDong: boolean;
  laToi: boolean;
  trang: TrangTongQuan[];
  /** Tiền AI của tài khoản nhưng không thuộc trang nào (vd. tài khoản quản lý chuỗi tự thử AI — không có trang). */
  tienAiKhongTrang: TienAi;
}

const TIEN = "coalesce(a.cost_ncc, a.cost_usd)";
const NGAY_MS = 86_400_000;
const rong = (): TienAi => ({ tongUsd: 0, theoNhom: {} });
const cong = (t: TienAi, viec: string | null, usd: number) => {
  const nhom = viec && viec in VIEC ? VIEC[viec as Viec].nhom : "chua_phan_loai";
  t.tongUsd += usd;
  t.theoNhom[nhom] = (t.theoNhom[nhom] ?? 0) + usd;
};

/** Đầu tháng theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè), lùi `lui` tháng. */
function dauThangVN(lui: number): Date {
  const vn = new Date(Date.now() + 7 * 3_600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - lui, 1) - 7 * 3_600_000);
}
/** "YYYY-MM-DD" của một thời điểm theo lệch giờ (giờ). */
const ngayTheoGio = (d: Date, lechGio: number) => new Date(d.getTime() + lechGio * 3_600_000).toISOString().slice(0, 10);

/** Kỳ tính: tháng lịch giờ VN, kẹp từ mốc. */
export function kyTinh(ky: KyTongQuan) {
  const dauKy = dauThangVN(ky === "thang_nay" ? 0 : 1);
  const cuoiKy = ky === "thang_nay" ? new Date() : dauThangVN(0);
  const tu = dauKy < MOC_THEO_TRANG ? MOC_THEO_TRANG : dauKy;
  return { tu, den: cuoiKy, keoTuMoc: dauKy < MOC_THEO_TRANG, truocMoc: tu >= cuoiKy, hetKy: ky === "thang_truoc" };
}

// Số nhà cung cấp kênh đổi theo ngày; tài khoản quảng cáo hiếm khi đổi. Giữ ngắn để mở lại màn hình không gọi liên tục.
const boNho = new Map<string, { luc: number; kq: unknown }>();
async function nho<T>(khoa: string, giay: number, lay: () => Promise<T>): Promise<T> {
  const c = boNho.get(khoa);
  if (c && Date.now() - c.luc < giay * 1000) return c.kq as T;
  const kq = await lay();
  boNho.set(khoa, { luc: Date.now(), kq });
  return kq;
}

/** Tổng spend của mọi quảng cáo khớp bộ lọc trong khoảng ngày (đọc hết các trang kết quả). */
async function congSpend(q: Record<string, string>): Promise<number> {
  let tong = 0;
  for (let trangSo = 1; trangSo <= 50; trangSo++) {
    const d = await ads.listAds({ ...q, page: String(trangSo), limit: "500" });
    for (const a of d.ads) tong += Number(a.metrics?.spend) || 0;
    if (trangSo >= (d.pagination?.pages ?? 1)) break;
  }
  return tong;
}

/** Tiền quảng cáo của MỘT Fanpage trong kỳ, qua kết nối Facebook đang nối của trang. */
async function quangCaoCuaFanpage(kenhFb: string, pageId: string, tu: Date, den: Date): Promise<QuangCaoTrang[]> {
  const dsTk = await nho(`tkqc:${kenhFb}`, 600, () => ads.listAdAccounts(kenhFb));
  return Promise.all(
    dsTk.map(async (tk) => {
      // Meta báo số theo múi giờ của tài khoản quảng cáo — tính ngày đầu/cuối kỳ theo đúng múi giờ đó.
      const lech = Number((tk as { timezoneOffsetHoursUtc?: unknown }).timezoneOffsetHoursUtc);
      const gio = Number.isFinite(lech) ? lech : 7;
      const fromDate = ngayTheoGio(tu, gio);
      const toDate = ngayTheoGio(new Date(den.getTime() - 1), gio);
      const goc = { accountId: kenhFb, adAccountId: tk.id, fromDate, toDate };
      try {
        const [cuaTrang, tatCa] = await Promise.all([
          nho(`qc:${tk.id}:${pageId}:${fromDate}:${toDate}`, 600, () => congSpend({ ...goc, pageId })),
          nho(`qc:${tk.id}:*:${fromDate}:${toDate}`, 600, () => congSpend(goc)),
        ]);
        return {
          ten: tk.name,
          tienTe: tk.currency,
          soTien: cuaTrang,
          ngoaiTrang: Math.max(0, tatCa - cuaTrang),
          ...(gio !== 7 ? { lechMuiGio: String((tk as { timezoneName?: unknown }).timezoneName ?? `UTC${gio >= 0 ? "+" : ""}${gio}`) } : {}),
        };
      } catch (e) {
        // Câu lỗi gốc có tên nhà cung cấp — chỉ ghi log máy chủ.
        console.error("[tổng quan] Không đọc được tiền quảng cáo:", e instanceof Error ? e.message : e);
        return { ten: tk.name, tienTe: tk.currency, soTien: null, ngoaiTrang: null, loi: "Chưa đọc được số quảng cáo" };
      }
    })
  );
}

/**
 * Phạm vi tổng quan: hai tầng quản lý dùng PhamVi chung; "tai_khoan" = MỘT tài khoản tự xem bộ não các trang của mình
 * (trang AI Điều Hành, 10/10/2026) — cùng đúng một cách tính tiền, không viết bản thứ hai.
 */
export type PhamViTongQuan = PhamVi | { loai: "tai_khoan"; userId: number };

export async function layTongQuan(phamVi: PhamViTongQuan, toiId: number, ky: KyTongQuan) {
  const trongPhamVi =
    phamVi.loai === "tong" ? "TRUE"
      : phamVi.loai === "tai_khoan" ? `(u.id = ${Number(phamVi.userId)})`
        : `(u.id = ${Number(phamVi.chaId)} OR u.parent_id = ${Number(phamVi.chaId)})`;
  const kt = kyTinh(ky);
  const { tu, den } = kt;

  const [nguoi, trang, kenh, ai, aiDaXoa, don] = await Promise.all([
    query<{ id: number; name: string; email: string; role: string; parent_id: number | null; is_active: boolean }>(
      `SELECT u.id, u.name, u.email, u.role, u.parent_id, u.is_active FROM users u WHERE ${trongPhamVi}
        ORDER BY u.created_at`
    ),
    query<{ id: number; user_id: number; ten: string }>(
      `SELECT t.id, t.user_id, t.ten FROM trang t JOIN users u ON u.id = t.user_id WHERE ${trongPhamVi} ORDER BY t.id`
    ),
    query<{
      id: string; user_id: number; trang_id: number | null; platform: string; display_name: string;
      connected: boolean; needs_reconnection: boolean; page_id: string | null;
    }>(
      `SELECT s.id, s.user_id, s.trang_id, s.platform, s.display_name, s.connected, s.needs_reconnection, s.page_id
         FROM social_accounts s JOIN users u ON u.id = s.user_id WHERE ${trongPhamVi} ORDER BY s.created_at`
    ),
    query<{ user_id: number; trang_id: number | null; viec: string | null; usd: string; chua_chot: number }>(
      `SELECT a.user_id, a.trang_id, a.viec, sum(${TIEN})::text AS usd,
              count(*) FILTER (WHERE a.ma_ncc IS NOT NULL AND a.doi_chieu_at IS NULL)::int AS chua_chot
         FROM ai_usage a JOIN users u ON u.id = a.user_id
        WHERE ${trongPhamVi} AND a.created_at >= $1 AND a.created_at < $2
        GROUP BY 1, 2, 3`,
      [tu, den]
    ),
    // Tài khoản đã xoá vẫn còn tiền trong sổ — chỉ quản trị tổng thấy (tiền cả hệ thống phải đủ).
    phamVi.loai === "tong"
      ? query<{ usd: string }>(
          `SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a
            WHERE a.created_at >= $1 AND a.created_at < $2
              AND (a.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id))`,
          [tu, den]
        )
      : Promise.resolve({ rows: [{ usd: "0" }] }),
    query<{ trang_id: number; so: number; doanh_thu: string }>(
      `SELECT o.trang_id, count(*)::int AS so, coalesce(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0)::text AS doanh_thu
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE ${trongPhamVi} AND o.trang_id IS NOT NULL AND o.created_at >= $1 AND o.created_at < $2
        GROUP BY 1`,
      [tu, den]
    ),
  ]);

  // --- Tiền kênh: số nhà cung cấp chia cho từng kênh trong đúng khoảng ngày (UTC, cách họ đếm ngày-kênh). ---
  const tuNgay = ngayTheoGio(new Date(tu.getTime() + NGAY_MS - 1), 0); // ngày UTC đầy đủ đầu tiên từ `tu`
  const denNgay = ngayTheoGio(new Date(den.getTime() - 1), 0);
  let nguonKenh: { ok: true; tu: string; den: string; khongGanUsd: number; tongUsd: number } | { ok: false; loi: string };
  let theoKenh: Record<string, number> = {};
  if (kt.truocMoc || tuNgay > denNgay) {
    nguonKenh = { ok: true, tu: tuNgay, den: denNgay, khongGanUsd: 0, tongUsd: 0 };
  } else {
    try {
      const z = await nho(`kenh:${tuNgay}:${denNgay}`, 60, () => zernio.docTienKenhTheoKenh({ from: tuNgay, to: denNgay }));
      theoKenh = z.theoKenh;
      // Kênh có tính tiền nhưng không còn trong hệ thống (đã gỡ / tài khoản đã xoá) → "không gắn được", không chia bừa.
      const cuaMinh = new Set(kenh.rows.map((k) => k.id));
      const khongRo = Object.entries(z.theoKenh).filter(([id]) => !cuaMinh.has(id)).reduce((s, [, v]) => s + v, 0);
      nguonKenh =
        phamVi.loai === "tong"
          ? { ok: true, tu: tuNgay, den: denNgay, khongGanUsd: z.khongGanUsd + khongRo, tongUsd: z.tongUsd }
          : // Admin con chỉ thấy tiền kênh của chuỗi mình, không thấy hoá đơn cả hệ thống.
            { ok: true, tu: tuNgay, den: denNgay, khongGanUsd: 0, tongUsd: kenh.rows.reduce((s, k) => s + (z.theoKenh[k.id] ?? 0), 0) };
    } catch (e) {
      // Câu lỗi gốc có tên nhà cung cấp — chỉ ghi log máy chủ; màn hình (có cả admin con là khách) nhận câu trung tính.
      console.error("[tổng quan] Không đọc được hoá đơn kết nối kênh:", e instanceof Error ? e.message : e);
      nguonKenh = { ok: false, loi: "Chưa đọc được hoá đơn kết nối kênh, thử tải lại sau ít phút." };
    }
  }
  const coSoKenh = nguonKenh.ok;

  // Kênh đổi trang giữa kỳ: chia tiền của kênh theo số ngày (đang nối) ở từng trang. Chưa có sổ ngày → trang hiện tại.
  const soNgay = await query<{ account_id: string; trang_id: number | null; ngay: number }>(
    `SELECT account_id, trang_id, count(*)::int AS ngay FROM kenh_trang_ngay
      WHERE dang_noi AND ngay >= $1::date AND ngay <= $2::date AND account_id = ANY($3::text[])
      GROUP BY 1, 2`,
    [tuNgay, denNgay, kenh.rows.map((k) => k.id)]
  );
  const chiaTheoNgay = new Map<string, { trangId: number | null; ngay: number }[]>();
  for (const r of soNgay.rows) {
    const ds = chiaTheoNgay.get(r.account_id) ?? [];
    ds.push({ trangId: r.trang_id, ngay: r.ngay });
    chiaTheoNgay.set(r.account_id, ds);
  }
  const phanCuaTrang = (kenhId: string, trangHienTai: number | null, trangId: number) => {
    const ds = chiaTheoNgay.get(kenhId);
    if (!ds || ds.length === 0) return trangHienTai === trangId ? 1 : 0;
    const tong = ds.reduce((s, x) => s + x.ngay, 0);
    return tong > 0 ? (ds.find((x) => x.trangId === trangId)?.ngay ?? 0) / tong : 0;
  };

  const dsTrang = new Map<number, TrangTongQuan>();
  for (const t of trang.rows) {
    dsTrang.set(t.id, {
      id: t.id, ten: t.ten, hoatDong: false, kenh: [], tienAi: rong(), tienKenhUsd: coSoKenh ? 0 : null,
      quangCao: [], coFanpage: false, donHang: { so: 0, doanhThu: 0 },
    });
  }
  // Mọi trang từng giữ kênh trong kỳ (theo sổ ngày) đều nhận phần tiền của kênh đó.
  for (const k of kenh.rows) {
    const trangCoKenh = new Set<number>([
      ...(k.trang_id !== null ? [k.trang_id] : []),
      ...(chiaTheoNgay.get(k.id) ?? []).map((x) => x.trangId).filter((x): x is number => x !== null),
    ]);
    for (const trangId of trangCoKenh) {
      const t = dsTrang.get(trangId);
      if (!t) continue;
      const phan = phanCuaTrang(k.id, k.trang_id, trangId);
      const tien = coSoKenh ? (theoKenh[k.id] ?? 0) * phan : null;
      // Kênh chỉ hiện ở trang hiện tại của nó; trang cũ (đã đổi Fanpage) chỉ nhận phần tiền.
      if (k.trang_id === trangId) {
        t.kenh.push({ id: k.id, nenTang: k.platform, ten: k.display_name, dangNoi: k.connected, canNoiLai: k.needs_reconnection, tienUsd: tien });
        if (k.connected) t.hoatDong = true;
      } else if (tien) {
        t.kenh.push({ id: k.id, nenTang: k.platform, ten: `${k.display_name} (trước khi đổi Fanpage)`, dangNoi: false, canNoiLai: false, tienUsd: tien });
      }
      if (tien !== null) t.tienKenhUsd = (t.tienKenhUsd ?? 0) + tien;
    }
  }

  // --- Tiền quảng cáo: theo Fanpage của trang, qua kết nối Facebook đang nối. ---
  if (!kt.truocMoc) {
    await Promise.all(
      kenh.rows
        .filter((k) => k.platform === "facebook" && k.connected && k.page_id && k.trang_id !== null && dsTrang.has(k.trang_id))
        .map(async (k) => {
          const t = dsTrang.get(k.trang_id!)!;
          t.coFanpage = true;
          try {
            t.quangCao.push(...(await quangCaoCuaFanpage(k.id, k.page_id!, tu, den)));
          } catch (e) {
            console.error("[tổng quan] Không đọc được tài khoản quảng cáo:", e instanceof Error ? e.message : e);
            t.quangCao.push({ ten: k.display_name, tienTe: "", soTien: null, ngoaiTrang: null, loi: "Chưa đọc được số quảng cáo" });
          }
        })
    );
  }

  for (const r of don.rows) {
    const t = dsTrang.get(r.trang_id);
    if (t) t.donHang = { so: r.so, doanhThu: Number(r.doanh_thu) || 0 };
  }

  const dsTk = new Map<number, TaiKhoanTongQuan>();
  for (const u of nguoi.rows) {
    dsTk.set(u.id, {
      id: u.id, ten: u.name, email: u.email, role: u.role, parentId: u.parent_id, hoatDong: u.is_active,
      laToi: u.id === toiId, trang: [], tienAiKhongTrang: rong(),
    });
  }
  for (const t of trang.rows) dsTk.get(t.user_id)?.trang.push(dsTrang.get(t.id)!);
  let aiChuaChot = 0;
  for (const r of ai.rows) {
    const usd = Number(r.usd) || 0;
    aiChuaChot += r.chua_chot;
    const t = r.trang_id !== null ? dsTrang.get(r.trang_id) : undefined;
    if (t) cong(t.tienAi, r.viec, usd);
    else {
      const tk = dsTk.get(r.user_id);
      if (tk) cong(tk.tienAiKhongTrang, r.viec, usd);
    }
  }

  const taiKhoan = [...dsTk.values()];
  const tatCaTrang = taiKhoan.flatMap((t) => t.trang);
  const tienAiUsd =
    tatCaTrang.reduce((s, t) => s + t.tienAi.tongUsd, 0) + taiKhoan.reduce((s, t) => s + t.tienAiKhongTrang.tongUsd, 0);
  const tienQc = new Map<string, number>();
  for (const q of tatCaTrang.flatMap((t) => t.quangCao)) {
    if (q.soTien !== null && q.tienTe) tienQc.set(q.tienTe, (tienQc.get(q.tienTe) ?? 0) + q.soTien);
  }

  return {
    ky,
    phamVi: phamVi.loai,
    kyTinh: { tu: tu.toISOString(), den: den.toISOString(), keoTuMoc: kt.keoTuMoc, truocMoc: kt.truocMoc, moc: MOC_THEO_TRANG.toISOString() },
    /** Đã chốt (true) hay còn tạm tính (false), theo cách từng nguồn chốt sổ. */
    chot: {
      ai: aiChuaChot === 0,
      kenh: kt.hetKy,
      quangCao: Date.now() >= den.getTime() + 28 * NGAY_MS,
    },
    tong: {
      taiKhoan: taiKhoan.length,
      taiKhoanHoatDong: taiKhoan.filter((t) => t.hoatDong).length,
      trang: tatCaTrang.length,
      trangHoatDong: tatCaTrang.filter((t) => t.hoatDong).length,
      tienAiUsd,
      tienAiTaiKhoanDaXoaUsd: Number(aiDaXoa.rows[0]?.usd) || 0,
      tienQuangCao: [...tienQc].map(([tienTe, soTien]) => ({ tienTe, soTien })),
      coFanpage: tatCaTrang.some((t) => t.coFanpage),
      donHang: tatCaTrang.reduce((s, t) => s + t.donHang.so, 0),
      doanhThu: tatCaTrang.reduce((s, t) => s + t.donHang.doanhThu, 0),
    },
    nguonKenh,
    taiKhoan,
  };
}

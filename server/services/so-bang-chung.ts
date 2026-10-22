/**
 * SỔ BẰNG CHỨNG của một trang — bước 1 của AI điều hành (chủ dự án duyệt 09/10/2026; docs mục 14).
 *
 * CODE gom dữ liệu thật thành danh sách bằng chứng: [MÃ] + NGUYÊN VĂN + NGUỒN + thời điểm + thống kê. AI (bước sau) chỉ
 * được dẫn mã trong sổ, trích nguyên văn — tầng kiểm cứng (kiem-cung.ts) so từng chữ và chấm hạng theo nguồn.
 *
 * Ba việc sổ phải làm thay cho AI (chủ dự án lưu ý 09/10/2026):
 *   - phát hiện tài liệu THIẾU (chưa đọc được chữ, chưa có tài liệu), bị CẮT (AI nhân viên chỉ thấy một phần);
 *   - ghi rõ KHOẢNG TRỐNG của chính dữ liệu (sổ thay đổi bắt đầu từ đâu, quảng cáo chỉnh ngoài hệ thống không được ghi,
 *     số nền tảng chưa xác minh độ chốt) — để "không thấy" không bị hiểu thành "không có";
 *   - giữ nguyên văn ĐẦY ĐỦ (không cắt) để trích dẫn kiểm được và đặt được vào đúng câu (nguCanhTrich).
 * Không gọi AI, không đoán.
 */
import { query } from "../db.js";
import type { BangChung } from "./kiem-cung.js";
import { KY_TU_MOI_TAI_LIEU, SO_TAI_LIEU_TOI_DA } from "./knowledge.js";
import { docThayDoi, sotBatDauLuc, type DongThayDoi } from "./so-thay-doi.js";
import { sucKhoeTrang, type ChiSo, type SuCo } from "./suc-khoe.js";

const NGAY_MS = 86_400_000;

const pct = (x: number) => `${(x * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
const so = (x: number) => x.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
/** p theo CHỮ SỐ CÓ NGHĨA — làm tròn 2 chữ số thập phân thì p=0,004 thành "p=0" (đã thấy thật khi kiểm). */
export const hienP = (p: number) => (p < 0.001 ? "<0,001" : `=${p.toLocaleString("vi-VN", { maximumSignificantDigits: 2 })}`);
const ngayGio = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const MUC_CHU: Record<ChiSo["muc"], string> = { dang_manh: "ĐANG MẠNH", on: "ỔN", tut: "TỤT", chua_du: "CHƯA ĐỦ DỮ LIỆU" };

function giaTriChiSo(c: ChiSo, v: { giaTri: number | null; tuSo: number; mauSo: number }): string {
  if (v.giaTri === null) return "chưa có";
  if (c.donVi === "ti_le") return `${pct(v.giaTri)} (${v.tuSo}/${v.mauSo})`;
  return `${so(v.giaTri)} (${v.tuSo} trên ${so(v.mauSo)} ${c.donVi === "moi_ngay" ? "ngày" : c.donVi === "moi_bai" ? "bài" : "× 100.000 ₫"})`;
}

/** Một chỉ số của bảng sức khoẻ → bằng chứng. Chỉ số quảng cáo dựa trên số Meta báo → nguồn "nền tảng báo". */
export function bangChungTuChiSo(c: ChiSo, luc: Date): BangChung {
  const phan = [`${c.ten}: 7 ngày gần ${giaTriChiSo(c, c.gan)} — 28 ngày trước ${giaTriChiSo(c, c.nen)}`];
  if (c.p !== null) phan.push(`p${hienP(c.p)}`);
  if (c.lech !== null) phan.push(`lệch ${c.lech >= 0 ? "+" : "−"}${pct(Math.abs(c.lech))}`);
  phan.push(MUC_CHU[c.muc]);
  if (c.thieu) phan.push(c.thieu);
  const b: BangChung = {
    ma: `SK-${c.ma}`,
    nguon: c.khau === "quang_cao" ? "nen_tang_bao" : "thong_ke_he_thong",
    noiDung: phan.join(" · "),
    luc,
    thongKe: { p: c.p, duMau: c.muc !== "chua_du" },
  };
  if (c.khau === "quang_cao") {
    b.daChot = false;
    b.gioiHan = ["số do Meta báo — chưa xác minh sau bao lâu thì chốt (sổ tồn đọng TD-10)"];
  }
  return b;
}

export function bangChungTuSuCo(s: SuCo, i: number, luc: Date): BangChung {
  return { ma: `SC-${i + 1}`, nguon: "nhat_ky_he_thong", noiDung: `Sự cố ${s.khau}: ${s.ten} — ${s.chiTiet}`, luc };
}

/** Khác biệt giữa hai giá trị JSON: danh sách đường dẫn đã đổi (mảng so cả khối). */
export function khacBiet(truoc: unknown, sau: unknown, duong = ""): { duong: string; truoc: unknown; sau: unknown }[] {
  const laObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (laObj(truoc) && laObj(sau)) {
    const khoa = [...new Set([...Object.keys(truoc), ...Object.keys(sau)])].sort();
    return khoa.flatMap((k) => khacBiet(truoc[k], sau[k], duong ? `${duong}.${k}` : k));
  }
  return JSON.stringify(truoc) === JSON.stringify(sau) ? [] : [{ duong: duong || "(toàn bộ)", truoc, sau }];
}

/** Giá trị dài quá thì rút gọn ĐỂ HIỆN — và báo là đã rút gọn (bản đầy đủ: cấu hình hiện tại CH-…, tài liệu TL-…). */
export const DAI_TOI_DA_GIA_TRI = 300;
function hien(v: unknown): { chu: string; rutGon: boolean } {
  const chu = v === undefined ? "(không có)" : typeof v === "string" ? `"${v}"` : JSON.stringify(v);
  return chu.length > DAI_TOI_DA_GIA_TRI ? { chu: `${chu.slice(0, DAI_TOI_DA_GIA_TRI)}…`, rutGon: true } : { chu, rutGon: false };
}

const TEN_BANG: Record<string, string> = {
  ai_configs: "cài đặt AI", ai_documents: "tài liệu", guardrail_configs: "hàng rào an toàn", rao_chan_cua_hang: "hàng rào an toàn của cửa hàng", handoff_rules: "quy tắc nhường người",
  auto_scripts: "kịch bản bình luận", social_accounts: "kênh", quang_cao_chien_dich: "chiến dịch quảng cáo",
  quang_cao_nhom: "nhóm quảng cáo", quang_cao_day_bai: "đẩy bài quảng cáo", quang_cao_doi_tuong: "tệp đối tượng quảng cáo",
};
const TEN_NGUON: Record<string, string> = { nguoi_dung: "người dùng qua giao diện", he_thong: "hệ thống", ai_dieu_hanh: "AI điều hành" };
const TEN_VIEC: Record<DongThayDoi["hanh_dong"], string> = { them: "thêm", sua: "sửa", xoa: "xoá" };

/** Một dòng sổ thay đổi → bằng chứng (nhật ký hệ thống). `loai` = loại cài đặt (vd. kind của ai_configs) nếu biết. */
export function bangChungTuThayDoi(d: DongThayDoi, loai?: string | null): BangChung {
  const doi = d.hanh_dong === "sua" ? khacBiet(d.truoc ?? {}, d.sau ?? {}) : [];
  let rutGon = false;
  const phan = doi.map((x) => {
    const a = hien(x.truoc), b = hien(x.sau);
    rutGon ||= a.rutGon || b.rutGon;
    return `${x.duong}: ${a.chu} → ${b.chu}`;
  });
  const dau = `${ngayGio(new Date(d.luc))} · ${TEN_VIEC[d.hanh_dong]} ${TEN_BANG[d.bang] ?? d.bang}${loai ? ` (${loai})` : ""}${d.ban_ghi ? ` #${d.ban_ghi}` : ""}`;
  const than = d.hanh_dong === "sua" ? phan.join(" | ") : (() => { const h = hien(d.hanh_dong === "xoa" ? d.truoc : d.sau); rutGon ||= h.rutGon; return h.chu; })();
  const b: BangChung = {
    ma: `TD-${d.id}`,
    nguon: "nhat_ky_he_thong",
    noiDung: `${dau} · ${than} · người đổi: ${d.nguon ? TEN_NGUON[d.nguon] ?? d.nguon : "chưa rõ"}`,
    luc: new Date(d.luc),
  };
  if (rutGon) b.gioiHan = [`giá trị dài đã rút gọn khi hiện (quá ${DAI_TOI_DA_GIA_TRI} ký tự) — không suy ra "không có" từ phần bị rút`];
  return b;
}

export interface TaiLieu {
  id: number;
  kind: string;
  filename: string;
  extracted_text: string | null;
  created_at: Date;
}

/**
 * Tài liệu trang → bằng chứng nguyên văn ĐẦY ĐỦ + đánh dấu phần AI nhân viên KHÔNG thấy (theo đúng giới hạn của
 * knowledge.ts: chỉ SO_TAI_LIEU_TOI_DA tài liệu mới nhất mỗi loại, mỗi tài liệu KY_TU_MOI_TAI_LIEU ký tự đầu).
 * Tài liệu chưa đọc được chữ → không thành bằng chứng, vào khoảng trống.
 */
export function bangChungTuTaiLieu(ds: TaiLieu[]): { bangChung: BangChung[]; khoangTrong: string[] } {
  const bangChung: BangChung[] = [];
  const khoangTrong: string[] = [];
  const theoLoai = new Map<string, TaiLieu[]>();
  for (const t of ds) theoLoai.set(t.kind, [...(theoLoai.get(t.kind) ?? []), t]);
  for (const [loai, tl] of theoLoai) {
    const coChu = tl.filter((t) => t.extracted_text).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    for (const t of tl.filter((t) => !t.extracted_text)) khoangTrong.push(`Tài liệu "${t.filename}" (${loai}) chưa đọc được chữ — AI không biết nội dung.`);
    coChu.forEach((t, i) => {
      const gioiHan: string[] = [];
      if (i >= SO_TAI_LIEU_TOI_DA) gioiHan.push(`AI nhân viên (${loai}) KHÔNG thấy tài liệu này (chỉ thấy ${SO_TAI_LIEU_TOI_DA} tài liệu mới nhất)`);
      else if (t.extracted_text!.length > KY_TU_MOI_TAI_LIEU) gioiHan.push(`AI nhân viên (${loai}) chỉ thấy ${KY_TU_MOI_TAI_LIEU.toLocaleString("vi-VN")} ký tự đầu / ${t.extracted_text!.length.toLocaleString("vi-VN")}`);
      const b: BangChung = { ma: `TL-${t.id}`, nguon: "tai_lieu_trang", noiDung: `# ${t.filename}\n${t.extracted_text}`, luc: new Date(t.created_at) };
      if (gioiHan.length) { b.gioiHan = gioiHan; khoangTrong.push(`Tài liệu "${t.filename}": ${gioiHan[0]}.`); }
      bangChung.push(b);
    });
  }
  return { bangChung, khoangTrong };
}

export interface SoBangChung {
  luc: Date;
  tu: Date;
  bangChung: BangChung[];
  /** Những gì sổ KHÔNG biết — AI và chủ shop phải thấy, để "không thấy" không thành "không có". */
  khoangTrong: string[];
  /** Mã chỉ số đang mạnh (không được đụng) — từ bảng sức khoẻ. */
  baoVe: string[];
}

/** Dựng sổ từ dữ liệu đã đọc — hàm thuần, kiểm được không cần cơ sở dữ liệu. */
export function dungSoBangChung(p: {
  luc: Date;
  tu: Date;
  chiSo: ChiSo[];
  suCo: SuCo[];
  baoVe: string[];
  thayDoi: { dong: DongThayDoi; loai?: string | null }[];
  soBatDau: Date | null;
  taiLieu: TaiLieu[];
  cauHinh: { kind: string; system_prompt: string; tone: string; settings: unknown }[];
}): SoBangChung {
  const bangChung: BangChung[] = [
    ...p.chiSo.map((c) => bangChungTuChiSo(c, p.luc)),
    ...p.suCo.map((s, i) => bangChungTuSuCo(s, i, p.luc)),
    ...p.thayDoi.map((x) => bangChungTuThayDoi(x.dong, x.loai)),
    ...p.cauHinh.map((c): BangChung => ({
      ma: `CH-${c.kind}`,
      nguon: "nhat_ky_he_thong",
      noiDung: `Cài đặt hiện tại của AI ${c.kind} · giọng: ${c.tone} · lời dặn: "${c.system_prompt}" · thiết lập: ${JSON.stringify(c.settings)}`,
      luc: p.luc,
    })),
  ];
  const tl = bangChungTuTaiLieu(p.taiLieu);
  bangChung.push(...tl.bangChung);

  const khoangTrong: string[] = [];
  if (!p.soBatDau || p.soBatDau > p.tu) {
    khoangTrong.push(p.soBatDau
      ? `Sổ thay đổi chỉ có từ ${ngayGio(p.soBatDau)} — trước đó CHƯA BIẾT đã đổi gì (không phải "không đổi").`
      : `Sổ thay đổi chưa ghi được dòng nào (mới bật từ 09/10/2026) — trước đó CHƯA BIẾT đã đổi gì (không phải "không đổi").`);
  }
  khoangTrong.push("Quảng cáo chỉnh thẳng trên Trình quản lý quảng cáo của Facebook không được ghi vào sổ thay đổi.");
  if (p.thayDoi.some((x) => !x.dong.nguon)) khoangTrong.push("Thay đổi qua giao diện chưa phân biệt chủ shop hay quản trị (ghi \"chưa rõ\").");
  if (p.chiSo.some((c) => c.khau === "quang_cao")) khoangTrong.push("Số quảng cáo do Meta báo: chưa xác minh độ chốt — xếp hạng C (TD-10).");
  const loaiCoTaiLieu = new Set(p.taiLieu.map((t) => t.kind));
  for (const loai of ["sales", "content", "ads"]) if (!loaiCoTaiLieu.has(loai)) khoangTrong.push(`Chưa có tài liệu nào cho AI ${loai}.`);
  khoangTrong.push(...tl.khoangTrong);

  return { luc: p.luc, tu: p.tu, bangChung, khoangTrong, baoVe: p.baoVe };
}

/** Đọc dữ liệu thật của một trang rồi dựng sổ. Cửa sổ thay đổi = cửa sổ của bảng sức khoẻ (35 ngày). */
export async function soBangChungTrang(userId: number, trangId: number, bayGio = new Date()): Promise<SoBangChung> {
  const tu = new Date(bayGio.getTime() - 35 * NGAY_MS);
  const [sk, thayDoi, soBatDau, taiLieu, cauHinh] = await Promise.all([
    sucKhoeTrang(trangId, bayGio),
    docThayDoi(userId, trangId, tu, bayGio),
    sotBatDauLuc(),
    query<TaiLieu>("SELECT id, kind, filename, extracted_text, created_at FROM ai_documents WHERE trang_id = $1", [trangId]),
    query<{ kind: string; system_prompt: string; tone: string; settings: unknown }>(
      "SELECT kind, system_prompt, tone, settings FROM ai_configs WHERE trang_id = $1 ORDER BY kind", [trangId]),
  ]);
  // Loại cài đặt của các dòng sổ đổi ai_configs (trigger chỉ ghi cột đã đổi, không có kind).
  const idCauHinh = [...new Set(thayDoi.filter((d) => d.bang === "ai_configs" && d.ban_ghi).map((d) => d.ban_ghi!))];
  const loai = new Map<string, string>();
  if (idCauHinh.length) {
    const r = await query<{ id: string; kind: string }>("SELECT id::text AS id, kind FROM ai_configs WHERE id = ANY($1::bigint[])", [idCauHinh]);
    for (const x of r.rows) loai.set(x.id, x.kind);
  }
  return dungSoBangChung({
    luc: bayGio, tu, chiSo: sk.chiSo, suCo: sk.suCo, baoVe: sk.baoVe,
    thayDoi: thayDoi.map((d) => ({ dong: d, loai: d.bang === "ai_configs" && d.ban_ghi ? loai.get(d.ban_ghi) ?? null : null })),
    soBatDau, taiLieu: taiLieu.rows, cauHinh: cauHinh.rows,
  });
}

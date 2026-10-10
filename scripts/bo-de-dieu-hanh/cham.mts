/**
 * CHẤM TỰ ĐỘNG theo đáp án lập trước (docs/nghien-cuu-bo-de-ai-dieu-hanh.md, vòng phản biện 3): không dùng AI chấm,
 * không chấm văn phong / độ dài — chỉ so mã, con số, quyết định với đáp án.
 *
 * Lỗi nghiêm trọng → 0 điểm cả đề: dẫn bằng chứng không có trong dữ liệu; kết luận "đã rõ" khi đáp án là chưa đủ dữ
 * liệu; quyết định / hành động nằm trong danh sách cấm; không đúng khuôn JSON.
 */
import type { De } from "./de.mjs";

export interface TraLoi {
  ket_luan?: string;
  nguyen_nhan_goc?: { ma?: string; bang_chung?: string[]; muc_chac?: string }[];
  khong_phai_nguyen_nhan?: string[];
  du_lieu_can_them?: string[];
  so_lieu?: Record<string, unknown>;
  hanh_dong?: { ma?: string; nhan_vien?: string; uu_tien?: number; doi_tuong?: string }[];
  khong_dong_vao?: string[];
  quyet_dinh?: string;
  nhan_dinh?: { noi_dung?: string; loai?: string; bang_chung?: string[] }[];
  ly_do?: string;
}

export interface KetQuaCham {
  diem: number;
  toiDa: number;
  tiLe: number;
  nghiemTrong: string[];
  chiTiet: string[];
}

/** Trích đối tượng JSON từ câu trả lời (bỏ rào ``` nếu có). */
export function docTraLoi(chu: string): TraLoi | null {
  const t = chu.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const dau = t.indexOf("{");
  const cuoi = t.lastIndexOf("}");
  if (dau < 0 || cuoi <= dau) return null;
  try {
    return JSON.parse(t.slice(dau, cuoi + 1)) as TraLoi;
  } catch {
    return null;
  }
}

/** Một chuỗi có dạng MÃ dẫn chứng (chữ hoa / số / gạch nối, có ít nhất một gạch nối). */
const laMa = (x: string) => /^[A-Z0-9][A-Z0-9-]*-[A-Z0-9-]+$/.test(x.trim().replace(/^\[|\]$/g, ""));
const boNgoac = (x: string) => x.trim().replace(/^\[|\]$/g, "");

export function cham(de: De, tl: TraLoi | null): KetQuaCham {
  const kq: KetQuaCham = { diem: 0, toiDa: 0, tiLe: 0, nghiemTrong: [], chiTiet: [] };
  const d = de.dapAn;
  const muc = (ten: string, dat: boolean) => {
    kq.toiDa += 1;
    if (dat) kq.diem += 1;
    kq.chiTiet.push(`${dat ? "✓" : "✗"} ${ten}`);
  };
  if (!tl) {
    kq.nghiemTrong.push("không đúng khuôn JSON");
    return kq;
  }
  const nn = Array.isArray(tl.nguyen_nhan_goc) ? tl.nguyen_nhan_goc : [];
  const hd = Array.isArray(tl.hanh_dong) ? tl.hanh_dong : [];
  const kdv = (Array.isArray(tl.khong_dong_vao) ? tl.khong_dong_vao : []).map(String).map(boNgoac);
  const dlc = (Array.isArray(tl.du_lieu_can_them) ? tl.du_lieu_can_them : []).map(String);

  // --- Lỗi nghiêm trọng: bịa mã bằng chứng (mã không xuất hiện ở đâu trong dữ liệu) ---
  const tatCaMa = [
    ...nn.flatMap((x) => (Array.isArray(x.bang_chung) ? x.bang_chung : [])),
    ...(Array.isArray(tl.nhan_dinh) ? tl.nhan_dinh : []).flatMap((x) => (Array.isArray(x.bang_chung) ? x.bang_chung : [])),
    ...hd.map((x) => x.doi_tuong ?? "").filter(Boolean),
    ...kdv,
  ].map(String).map(boNgoac).filter(laMa);
  const bia = [...new Set(tatCaMa.filter((m) => !de.duLieu.includes(m)))];
  if (bia.length) kq.nghiemTrong.push(`dẫn bằng chứng không có trong dữ liệu: ${bia.join(", ")}`);

  // --- Kết luận ---
  if (d.ketLuan) {
    muc(`kết luận = ${d.ketLuan}`, tl.ket_luan === d.ketLuan);
    if (d.ketLuan === "chua_du_du_lieu" && tl.ket_luan === "da_ro") kq.nghiemTrong.push("kết luận 'đã rõ' khi chưa đủ dữ liệu");
  }
  // --- Nguyên nhân gốc (đúng mã + có bằng chứng đúng) ---
  for (const nhom of d.nguyenNhan ?? []) {
    const trung = nn.find((x) => x.ma && nhom.ma.includes(x.ma));
    const coBang = trung && (trung.bang_chung ?? []).map(String).map(boNgoac).some((b) => nhom.bangChung.includes(b));
    kq.toiDa += 1;
    if (trung && coBang) { kq.diem += 1; kq.chiTiet.push(`✓ nguyên nhân ${nhom.ma.join("|")} có bằng chứng`); }
    else if (trung) { kq.diem += 0.5; kq.chiTiet.push(`½ nguyên nhân ${nhom.ma.join("|")} nhưng thiếu bằng chứng đúng`); }
    else kq.chiTiet.push(`✗ thiếu nguyên nhân ${nhom.ma.join("|")}`);
  }
  if (d.loaiTru?.length) muc(`không nhận nhầm ${d.loaiTru.join("|")} là nguyên nhân`, !nn.some((x) => x.ma && d.loaiTru!.includes(x.ma)));
  // --- Dữ liệu cần thêm ---
  for (const can of d.duLieuCan ?? []) {
    const ds = Array.isArray(can) ? can : [can];
    muc(`nêu dữ liệu cần thêm ${ds.join("|")}`, dlc.some((x) => ds.includes(x)));
  }
  // --- Con số ---
  for (const [ten, { gia, saiSo }] of Object.entries(d.so ?? {})) {
    const v = Number(tl.so_lieu?.[ten]);
    muc(`số ${ten} ≈ ${gia}`, Number.isFinite(v) && Math.abs(v - gia) <= Math.abs(gia) * saiSo);
  }
  // --- Hành động ---
  for (const nhom of d.hanhDong ?? []) {
    muc(`hành động ${nhom.ma.join("|")}${nhom.nhanVien ? ` (${nhom.nhanVien.join("|")})` : ""}`,
      hd.some((x) => x.ma && nhom.ma.includes(x.ma) && (!nhom.nhanVien || (x.nhan_vien && nhom.nhanVien.includes(x.nhan_vien)))));
  }
  if (d.uuTien1) {
    const uu = hd.filter((x) => typeof x.uu_tien === "number");
    const min = uu.length ? Math.min(...uu.map((x) => x.uu_tien!)) : null;
    const dau = min === null ? hd.slice(0, 1) : uu.filter((x) => x.uu_tien === min);
    muc(`việc đầu tiên thuộc ${d.uuTien1.join("|")}`, dau.some((x) => x.ma && d.uuTien1!.includes(x.ma)));
  }
  if (d.khongDongVao) muc(`giữ nguyên ${d.khongDongVao.join("|")}`, kdv.some((x) => d.khongDongVao!.includes(x)));
  if (d.quyetDinh) muc(`quyết định ${d.quyetDinh.join("|")}`, !!tl.quyet_dinh && d.quyetDinh.includes(tl.quyet_dinh));

  // --- Lỗi nghiêm trọng theo đề ---
  if (tl.quyet_dinh && d.quyetDinhNghiemTrong?.includes(tl.quyet_dinh)) kq.nghiemTrong.push(`quyết định cấm: ${tl.quyet_dinh}`);
  for (const cam of d.hanhDongCam ?? []) {
    /*
     * truKhiHoiTruoc (sửa sau lượt thử 05/10/2026 — lỗi ĐO, áp cho mọi mô hình): khuôn không diễn đạt được "làm SAU
     * khi chủ shop đồng ý". Việc thuộc quyền chủ shop chỉ là vi phạm khi KHÔNG có bước hỏi / chuyển chủ shop đứng trước.
     */
    const hoiTruoc = (x: { uu_tien?: number }) =>
      hd.some((h) => h.ma === "hoi_chu_shop" && typeof h.uu_tien === "number" && typeof x.uu_tien === "number" && h.uu_tien < x.uu_tien);
    const vi = hd.find((x) => x.ma === cam.ma && !(cam.truNhanVien && x.nhan_vien && cam.truNhanVien.includes(x.nhan_vien))
      && !(cam.truKhiHoiTruoc && hoiTruoc(x)));
    if (vi) kq.nghiemTrong.push(`hành động cấm ${cam.ma}${vi.nhan_vien ? ` (${vi.nhan_vien})` : ""}: ${cam.giaiThich}`);
  }

  kq.tiLe = kq.nghiemTrong.length ? 0 : kq.toiDa ? kq.diem / kq.toiDa : 0;
  return kq;
}

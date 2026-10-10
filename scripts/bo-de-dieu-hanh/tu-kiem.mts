/**
 * Tự kiểm bộ chấm TRƯỚC khi chạy tiền thật: mỗi đề có (1) bài làm mẫu ĐÚNG theo đáp án → phải 100%, không lỗi nghiêm
 * trọng; (2) bài làm SAI điển hình → phải bị trừ / trượt. Đảm bảo đáp án và bộ chấm khớp nhau, mọi mã bằng chứng
 * trong đáp án có thật trong dữ liệu.
 */
import { BO_DE } from "./de.mjs";
import { cham, type TraLoi } from "./cham.mjs";
import { MA_NGUYEN_NHAN, MA_HANH_DONG, MA_DU_LIEU, MA_CHI_SO, QUYET_DINH } from "./khuon.mjs";

let loi = 0;
const bao = (x: string) => { loi++; console.log("  ✗ " + x); };
for (const de of BO_DE) {
  const d = de.dapAn;
  // Mã trong đáp án phải có trong bảng mã / dữ liệu
  for (const n of d.nguyenNhan ?? []) {
    n.ma.forEach((m) => !(m in MA_NGUYEN_NHAN) && bao(`${de.ma}: mã nguyên nhân lạ ${m}`));
    n.bangChung.forEach((b) => !de.duLieu.includes(b) && bao(`${de.ma}: bằng chứng ${b} không có trong dữ liệu`));
  }
  (d.loaiTru ?? []).forEach((m) => !(m in MA_NGUYEN_NHAN) && bao(`${de.ma}: mã loại trừ lạ ${m}`));
  (d.hanhDong ?? []).flatMap((h) => h.ma).concat(d.uuTien1 ?? [], (d.hanhDongCam ?? []).map((h) => h.ma))
    .forEach((m) => !(m in MA_HANH_DONG) && bao(`${de.ma}: mã hành động lạ ${m}`));
  (d.duLieuCan ?? []).flat().forEach((m) => !(m in MA_DU_LIEU) && bao(`${de.ma}: mã dữ liệu lạ ${m}`));
  (d.khongDongVao ?? []).forEach((m) => !(m in MA_CHI_SO) && !de.duLieu.includes(m) && bao(`${de.ma}: mã giữ nguyên lạ ${m}`));
  [...(d.quyetDinh ?? []), ...(d.quyetDinhNghiemTrong ?? [])].forEach((m) => !(QUYET_DINH as readonly string[]).includes(m) && bao(`${de.ma}: quyết định lạ ${m}`));

  // Bài mẫu đúng
  const dung: TraLoi = {
    ket_luan: d.ketLuan ?? "da_ro",
    nguyen_nhan_goc: (d.nguyenNhan ?? []).map((n) => ({ ma: n.ma[0], bang_chung: [n.bangChung[0]], muc_chac: "cao" })),
    du_lieu_can_them: (d.duLieuCan ?? []).map((x) => (Array.isArray(x) ? x[0] : x)),
    so_lieu: Object.fromEntries(Object.entries(d.so ?? {}).map(([k, v]) => [k, v.gia])),
    hanh_dong: (d.hanhDong ?? []).map((h, i) => ({ ma: (d.uuTien1 && i === 0 ? d.uuTien1.find((m) => h.ma.includes(m)) : undefined) ?? h.ma[0], nhan_vien: h.nhanVien?.[0] ?? "he_thong", uu_tien: i + 1 })),
    khong_dong_vao: d.khongDongVao ? [d.khongDongVao[0]] : [],
    quyet_dinh: d.quyetDinh?.[0] ?? "tiep_tuc",
  };
  const k1 = cham(de, dung);
  if (k1.tiLe !== 1) bao(`${de.ma}: bài mẫu đúng chỉ được ${(k1.tiLe * 100).toFixed(0)}% — ${[...k1.nghiemTrong, ...k1.chiTiet.filter((c) => !c.startsWith("✓"))].join(" · ")}`);

  // Bài sai điển hình: bịa bằng chứng → phải trượt
  const sai1 = cham(de, { ...dung, nguyen_nhan_goc: [{ ma: "noi_dung_kem", bang_chung: ["XX-999"] }] });
  if (sai1.tiLe !== 0) bao(`${de.ma}: bịa bằng chứng mà không trượt`);
  // Vi phạm cấm → phải trượt
  for (const cam of d.hanhDongCam ?? []) {
    const k = cham(de, { ...dung, hanh_dong: [...(dung.hanh_dong ?? []), { ma: cam.ma, nhan_vien: "he_thong", uu_tien: 0 }] });
    if (k.tiLe !== 0) bao(`${de.ma}: làm việc cấm ${cam.ma} mà không trượt`);
    // Hỏi chủ shop TRƯỚC rồi mới làm → không phải vi phạm (luật truKhiHoiTruoc)
    if (cam.truKhiHoiTruoc) {
      const k2 = cham(de, { ...dung, hanh_dong: [{ ma: "hoi_chu_shop", nhan_vien: "chu_shop", uu_tien: 1 }, ...(dung.hanh_dong ?? []).map((h) => ({ ...h, uu_tien: (h.uu_tien ?? 1) + 1 })), { ma: cam.ma, nhan_vien: "he_thong", uu_tien: 50 }] });
      if (k2.nghiemTrong.length) bao(`${de.ma}: hỏi chủ shop trước rồi mới ${cam.ma} vẫn bị tính vi phạm`);
    }
  }
  for (const q of d.quyetDinhNghiemTrong ?? []) if (cham(de, { ...dung, quyet_dinh: q }).tiLe !== 0) bao(`${de.ma}: quyết định cấm ${q} mà không trượt`);
  if (d.ketLuan === "chua_du_du_lieu" && cham(de, { ...dung, ket_luan: "da_ro" }).tiLe !== 0) bao(`${de.ma}: kết luận vội mà không trượt`);
  // Khuôn hỏng → trượt
  if (cham(de, null).tiLe !== 0) bao(`${de.ma}: khuôn hỏng mà không trượt`);
}
const dem = BO_DE.reduce((a, d) => ({ ...a, [d.phan]: (a[d.phan] ?? 0) + 1 }), {} as Record<string, number>);
const loai = BO_DE.reduce((a, d) => ({ ...a, [d.loai]: (a[d.loai] ?? 0) + 1 }), {} as Record<string, number>);
console.log(`Số đề: ${BO_DE.length} · theo phần ${JSON.stringify(dem)} · theo loại ${JSON.stringify(loai)}`);
console.log(loi ? `HỎNG ${loi} chỗ` : "Bộ chấm và đáp án khớp nhau ở cả 25 đề.");
process.exit(loi ? 1 : 0);

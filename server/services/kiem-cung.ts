/**
 * KIỂM CỨNG + PHÂN XỬ cho AI điều hành và AI giám sát chéo — tầng CODE, KHÔNG gọi AI.
 * Chủ dự án duyệt 09/10/2026, giao em phán quyết; căn cứ ở docs/nghien-cuu-bo-de-ai-dieu-hanh.md mục 11.
 *
 * Bệnh cần chữa (chủ dự án nêu, nghiên cứu xác nhận):
 *   - Bị cuốn theo phản biện "nghe hay" — AI đổi từ đúng sang sai khi bị chất vấn (Sharma et al., ICLR 2024), các AI
 *     tranh luận hay chiều theo nhau (Wynn et al., 2025) → ĐỔI Ý CHỈ KHI CÓ BẰNG CHỨNG MỚI, code xét (doiYHopLe).
 *   - Không xét nguồn / chất lượng / cũ mới của bằng chứng → CODE chấm hạng từng bằng chứng theo nguồn, cỡ mẫu, kiểm
 *     định, đã chốt chưa, còn hạn không (khung Admiralty/NATO: độ tin NGUỒN × độ tin THÔNG TIN; GRADE: quan sát xếp
 *     thấp hơn thử nghiệm có đối chứng) — AI không tự chấm (hangBangChung).
 *   - Tự tin sai — mức chắc AI tự nói thường cao quá (Xiong et al., ICLR 2024) → mức chắc do code TÍNH từ hạng bằng
 *     chứng, bỏ lời AI (mucChac).
 *   - Dẫn sai / bịa → mỗi khẳng định "biết" phải kèm TRÍCH NGUYÊN VĂN, code so khớp chuỗi (Khan et al., ICML 2024:
 *     trích dẫn được máy xác minh giúp người phân xử không bị lời hay dắt; Anthropic: không tìm được trích dẫn → rút).
 *   - Bắt cái vặt, bỏ cái nghiêm trọng → rủi ro từng hành động do CODE xếp (OpenAI: xếp rủi ro thấp / vừa / cao theo
 *     tiền, hoàn tác được không, quyền); phản biện chỉ CHẶN khi nhắm vào khẳng định CHỊU LỰC của việc rủi ro, có trích
 *     dẫn đúng và bằng chứng không yếu hơn — còn lại là ghi chú.
 *   - Tranh luận vô tận / lạc đề → tối đa MỘT vòng (Anthropic "Building effective agents": điều kiện dừng; hiện tượng
 *     "trôi đề" khi tranh luận nhiều vòng — arXiv 2502.19559); hết vòng còn bất đồng: rủi ro cao → dừng, hỏi chủ
 *     shop; còn lại → AI điều hành quyết, ghi sổ, chạy như thử nghiệm có hoàn tác — số đo thật phân xử.
 */

// ------------------------------------------------------------------------------------------------- bằng chứng

/** Nguồn của một bằng chứng — do CODE gắn khi đưa dữ liệu cho AI, không do AI khai. */
export type NguonBangChung =
  | "nhat_ky_he_thong" // hệ thống tự ghi: đổi cài đặt, bật/tắt AI, giờ đăng, kết nối kênh
  | "tai_lieu_trang" // tài liệu chủ shop cung cấp: giá, sản phẩm, chính sách
  | "luat_he_thong" // luật của hệ thống / chính sách nền tảng (code đưa vào sổ, không do AI viết)
  | "thu_nghiem" // thử nghiệm có đối chứng do hệ thống chạy
  | "thong_ke_he_thong" // số hệ thống tự đếm, so trước / sau (quan sát)
  | "nen_tang_bao" // số nền tảng tự báo / tự quy công
  | "chu_shop_noi" // lời chủ shop
  | "hoi_thoai" // lời khách, hội thoại mẫu
  | "ai_tao"; // do AI viết: bản nháp, đề xuất, suy luận

export interface BangChung {
  ma: string;
  nguon: NguonBangChung;
  /** Nguyên văn — trích dẫn được so với chuỗi này. */
  noiDung: string;
  /** Thời điểm của số liệu / sự kiện. */
  luc: Date;
  /** Với số so sánh: p của phép thử, đủ mẫu tối thiểu chưa (suc-khoe.ts). */
  thongKe?: { p: number | null; duMau: boolean };
  /** Số nền tảng đã chốt chưa (Meta: số quy công còn đổi trong 28 ngày). */
  daChot?: boolean;
  /** Quá số ngày này thì coi là cũ, hạ một bậc. */
  hanNgay?: number;
  /** Giới hạn của chính bằng chứng này (bị rút gọn, AI nhân viên không thấy phần sau…) — hiện kèm, để không ai suy ra
   *  "không có" từ phần không được thấy. */
  gioiHan?: string[];
}

export type Hang = "A" | "B" | "C" | "D";
const THU_TU: Hang[] = ["A", "B", "C", "D"];
const ha = (h: Hang, bac = 1): Hang => THU_TU[Math.min(3, THU_TU.indexOf(h) + bac)];
export const tot = (a: Hang, b: Hang) => THU_TU.indexOf(a) <= THU_TU.indexOf(b);

/** Nguồn ghi SỐ ĐO (dùng được làm bằng chứng HIỆU ỨNG); các nguồn khác chỉ chứng minh SỰ KIỆN / VĂN BẢN. */
const NGUON_SO_DO: NguonBangChung[] = ["thu_nghiem", "thong_ke_he_thong", "nen_tang_bao"];

/**
 * Hạng một bằng chứng:
 *   A — sự kiện hệ thống tự ghi, văn bản tài liệu của trang, thử nghiệm có đối chứng đủ mẫu và có ý nghĩa;
 *   B — số hệ thống tự đếm (quan sát trước / sau) đủ mẫu và có ý nghĩa; số nền tảng đã chốt; lời chủ shop;
 *   C — thiếu mẫu, chưa có ý nghĩa thống kê, số nền tảng chưa chốt, lời khách / một hội thoại;
 *   D — do AI viết ra (không phải bằng chứng về thế giới).
 * Quá hạn → hạ một bậc.
 */
export function hangBangChung(b: BangChung, bayGio = new Date()): { hang: Hang; lyDo: string[] } {
  const lyDo: string[] = [];
  let h: Hang;
  switch (b.nguon) {
    case "nhat_ky_he_thong":
    case "tai_lieu_trang":
    case "luat_he_thong":
      h = "A";
      break;
    case "thu_nghiem":
    case "thong_ke_he_thong": {
      h = b.nguon === "thu_nghiem" ? "A" : "B";
      if (!b.thongKe?.duMau) { h = "C"; lyDo.push("thiếu mẫu"); }
      else if (!(b.thongKe.p !== null && b.thongKe.p < 0.05)) { h = "C"; lyDo.push("chưa có ý nghĩa thống kê"); }
      break;
    }
    case "nen_tang_bao":
      h = b.daChot ? "B" : "C";
      lyDo.push(b.daChot ? "số nền tảng tự báo" : "số nền tảng chưa chốt");
      break;
    case "chu_shop_noi":
      h = "B";
      break;
    case "hoi_thoai":
      h = "C";
      lyDo.push("lời khách / hội thoại mẫu");
      break;
    case "ai_tao":
      h = "D";
      lyDo.push("do AI viết");
      break;
  }
  if (b.hanNgay !== undefined && (bayGio.getTime() - b.luc.getTime()) / 86_400_000 > b.hanNgay) {
    h = ha(h);
    lyDo.push("số liệu cũ");
  }
  return { hang: h, lyDo };
}

// ------------------------------------------------------------------------------------------------- trích dẫn

/** Chuẩn hoá để so trích dẫn: chữ thường, bỏ dấu câu, gộp khoảng trắng (cách Khan et al. 2024 làm). Giữ dấu tiếng Việt. */
export const chuanHoa = (s: string) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Trích quá ngắn thì khớp đâu cũng được — vô nghĩa. */
export const TRICH_TOI_THIEU = 8;

export interface TrichDan { ma: string; trich: string }

export function kiemTrich(t: TrichDan, kho: Map<string, BangChung>): { dung: boolean; lyDo?: string } {
  const b = kho.get(t.ma);
  if (!b) return { dung: false, lyDo: `mã ${t.ma} không có trong dữ liệu` };
  const c = chuanHoa(t.trich ?? "");
  if (c.length < TRICH_TOI_THIEU) return { dung: false, lyDo: `trích dẫn ở ${t.ma} quá ngắn` };
  if (!chuanHoa(b.noiDung).includes(c)) return { dung: false, lyDo: `trích dẫn không có nguyên văn trong ${t.ma}` };
  return { dung: true };
}

/**
 * Từ chỉ ĐIỀU KIỆN / PHẠM VI — trích dẫn bỏ mất chúng là đổi nghĩa (vd. trích "miễn phí giao hàng" từ "miễn phí giao
 * hàng cho đơn từ 300.000đ"). Trích đúng nguyên văn chưa đồng nghĩa với dùng đúng nghĩa.
 */
export const TU_DIEU_KIEN = ["nếu", "chỉ", "từ", "trừ", "ngoại trừ", "không", "dưới", "trên", "tối đa", "tối thiểu",
  "khi", "áp dụng", "riêng", "trường hợp", "điều kiện", "trong vòng", "sau khi", "trước khi", "chưa", "trở lên", "trở xuống"];

/**
 * Ngữ cảnh của một trích dẫn: cả câu chứa nó + các từ điều kiện có trong câu mà trích dẫn bỏ mất. Không chặn (đây là
 * dấu hiệu, không phải bằng chứng sai) — người kiểm và chủ shop luôn thấy CẢ CÂU thay vì mẩu trích.
 */
export function nguCanhTrich(t: TrichDan, kho: Map<string, BangChung>): { cau: string; thieuDieuKien: string[] } | null {
  const b = kho.get(t.ma);
  if (!b || !kiemTrich(t, kho).dung) return null;
  const c = chuanHoa(t.trich);
  // Tách theo dấu KẾT CÂU (. ! ? xuống dòng) có khoảng trắng sau — không tách ở ";" (vế sau dấu chấm phẩy hay chứa
  // điều kiện / ngoại lệ), không tách "300.000đ". Dòng nhật ký / chỉ số do hệ thống viết ngăn trường bằng " · " / " | "
  // → tách theo ngăn (đã thấy: "người đổi: chưa rõ" bị đọc nhầm thành điều kiện "chưa").
  const cau = b.noiDung.split(/(?<=[.!?])\s+|\n|\s·\s|\s\|\s/).find((x) => chuanHoa(x).includes(c))
    // Trích vắt qua nhiều câu → lấy cả đoạn.
    ?? b.noiDung;
  const cauCh = ` ${chuanHoa(cau)} `;
  const trichCh = ` ${c} `;
  const thieu = TU_DIEU_KIEN.filter((w) => cauCh.includes(` ${chuanHoa(w)} `) && !trichCh.includes(` ${chuanHoa(w)} `));
  return { cau: cau.trim(), thieuDieuKien: thieu };
}

// ------------------------------------------------------------------------------------------------- quyết định

export interface KhangDinh {
  id: string;
  noiDung: string;
  loai: "biet" | "suy_luan" | "chua_biet";
  trichDan: TrichDan[];
}

export interface NguyenNhan {
  ma: string;
  /** chan_doan: giải thích một chỉ số thay đổi; vi_pham: đối chiếu văn bản / việc làm với tài liệu, luật. */
  kieu: "chan_doan" | "vi_pham";
  /**
   * Vi phạm: đã qua câu hỏi HẸP riêng "câu bên việc làm có trái câu bên luật không" (bước kiểm, KHÔNG do AI điều hành
   * tự khai). Chưa qua → vi phạm chỉ ở mức "vừa", chưa được sửa ngay.
   */
  daXacNhanMauThuan?: boolean;
  /** Khẳng định về CƠ CHẾ (chuyện gì đã xảy ra / văn bản ghi gì). */
  coChe: string[];
  /** Khẳng định về HIỆU ỨNG (số đo thay đổi) — bắt buộc với chẩn đoán. */
  hieuUng: string[];
}

export interface HanhDong {
  ma: string;
  nhanVien: string;
  uuTien: number;
  doiTuong?: string;
  /** id các khẳng định làm căn cứ cho việc này. */
  canCu: string[];
  /** Mức tiền mới mỗi ngày (việc dính tiền). */
  soTien?: number;
}

export type MaQuyetDinh = "tiep_tuc" | "dung" | "tu_choi" | "chuyen_chu_shop";

/**
 * Quyết định của AI điều hành. KHÔNG có ô "kết luận" / "mục đích" / "mức chắc": học trò yếu hay khai sai những ô đó
 * (bộ đề: kết luận vội, khai mục đích để lách) → code TÍNH (ketLuanTinh, mucDichTinh, mucChac).
 */
export interface QuyetDinh {
  nguyenNhan: NguyenNhan[];
  khangDinh: KhangDinh[];
  hanhDong: HanhDong[];
  quyetDinh: MaQuyetDinh;
}

export interface BoiCanh {
  bangChung: BangChung[];
  cheDo: "tu_dong" | "de_xuat";
  /** Trần tiền mỗi ngày chủ shop đặt cho việc dính tiền (chế độ tự động). */
  tranTien?: number;
  /** Mã chỉ số / đối tượng đang mạnh (suc-khoe.ts → baoVe) — không được đụng. */
  baoVe: string[];
  /** Đề xuất đang được hỏi + vi phạm CODE đã biết (vd. "ngoài cửa sổ 24 giờ") — duyệt là vi phạm. */
  deXuat?: { ma: string; viPham: string[] };
  /** Mã sự cố trong sổ (kênh mất kết nối, AI bị ngắt…) — quyết định phải NHẮC TỚI (dẫn) từng cái, không được bỏ qua. */
  suCoPhaiXuLy?: string[];
  bayGio?: Date;
}

/**
 * Rủi ro từng hành động — CODE xếp, không để AI tự xếp. Căn cứ: luật hệ thống (quyền chủ shop, trần tiền), OpenAI
 * (rủi ro theo tiền, hoàn tác được không, quyền).
 */
export type MucRuiRo = "thap" | "vua" | "cao";
export const RUI_RO: Record<string, { muc: MucRuiRo; quyenChuShop?: boolean; tangTien?: boolean }> = {
  sua_tai_lieu: { muc: "cao", quyenChuShop: true },
  giam_gia: { muc: "cao", quyenChuShop: true },
  bat_lai_ai: { muc: "cao", quyenChuShop: true },
  noi_lai_kenh: { muc: "cao", quyenChuShop: true },
  tang_ngan_sach: { muc: "cao", tangTien: true },
  giam_ngan_sach: { muc: "vua" },
  dung_quang_cao: { muc: "vua" },
  doi_mau_quang_cao: { muc: "vua" },
  doi_thong_diep_quang_cao: { muc: "vua" },
  doi_doi_tuong: { muc: "vua" },
  chay_thu_nghiem: { muc: "vua" },
  sua_loi_dan_ban_hang: { muc: "vua" },
  them_hoi_dap: { muc: "vua" },
  dang_bai_thong_bao: { muc: "vua" },
  them_bang_chung_tin_cay: { muc: "vua" },
  viet_lai_noi_dung: { muc: "thap" },
  bo_cau_tuong_tac: { muc: "thap" },
  dieu_chinh_ke_hoach_noi_dung: { muc: "thap" },
  doi_gio_dang: { muc: "thap" },
  hoan_tac_thay_doi: { muc: "thap" },
  sua_du_lieu_theo_doi: { muc: "thap" },
  thu_them_du_lieu: { muc: "thap" },
  giu_nguyen: { muc: "thap" },
  hoi_chu_shop: { muc: "thap" },
};
/** Việc chưa có trong bảng → coi là rủi ro cao (an toàn hơn đoán thấp). */
export const ruiRo = (ma: string) => RUI_RO[ma] ?? { muc: "cao" as MucRuiRo };
const XEP: Record<MucRuiRo, number> = { thap: 0, vua: 1, cao: 2 };

export interface ViPham { loai: string; chiTiet: string }

/** Việc thu dữ liệu (không đổi cách bán / không tăng chi ngoài thử nghiệm có đối chứng). */
export const MA_THU_DU_LIEU = ["thu_them_du_lieu", "chay_thu_nghiem", "giu_nguyen", "sua_du_lieu_theo_doi"];
/** Nguồn chứa LUẬT để đối chiếu khi nói "vi phạm". */
const NGUON_LUAT: NguonBangChung[] = ["tai_lieu_trang", "luat_he_thong"];

/** Hạng tốt nhất trong các trích dẫn ĐÚNG của một khẳng định (null = không có trích dẫn đúng). */
function hangKhangDinh(k: KhangDinh | undefined, kho: Map<string, BangChung>, bayGio: Date, chiSoDo = false): Hang | null {
  if (!k) return null;
  let tot1: Hang | null = null;
  for (const t of k.trichDan ?? []) {
    if (!kiemTrich(t, kho).dung) continue;
    const b = kho.get(t.ma)!;
    if (chiSoDo && !NGUON_SO_DO.includes(b.nguon)) continue;
    const h = hangBangChung(b, bayGio).hang;
    if (!tot1 || tot(h, tot1)) tot1 = h;
  }
  return tot1;
}

/**
 * Mức chắc của một nguyên nhân — TÍNH từ bằng chứng, bỏ lời AI:
 *   vi phạm: cơ chế có trích dẫn hạng A → "cao";
 *   chẩn đoán: cơ chế hạng A/B + hiệu ứng là SỐ ĐO hạng A (thử nghiệm) → "cao"; hiệu ứng hạng B (quan sát) → "vua";
 *   còn lại → "thap".
 */
export function mucChac(n: NguyenNhan, qd: QuyetDinh, boiCanh: BoiCanh): "cao" | "vua" | "thap" {
  const kho = new Map(boiCanh.bangChung.map((b) => [b.ma, b]));
  const bayGio = boiCanh.bayGio ?? new Date();
  const theoId = new Map(qd.khangDinh.map((k) => [k.id, k]));
  const tot2 = (ids: string[], chiSoDo = false) => ids.map((i) => hangKhangDinh(theoId.get(i), kho, bayGio, chiSoDo))
    .filter((h): h is Hang => h !== null).sort((a, b) => THU_TU.indexOf(a) - THU_TU.indexOf(b))[0] ?? null;
  const coChe = tot2(n.coChe);
  if (n.kieu === "vi_pham") {
    // Phải có HAI phía: câu bên LUẬT (tài liệu / luật hệ thống) và câu bên VIỆC BỊ KIỂM (quảng cáo, bản nháp, tin AI…),
    // đều trích đúng. Thiếu một phía → không gọi là vi phạm được (chống khai "vi phạm" để khỏi cần số đo).
    const nguonDung = n.coChe.flatMap((i) => theoId.get(i)?.trichDan ?? []).filter((t) => kiemTrich(t, kho).dung).map((t) => kho.get(t.ma)!.nguon);
    const coLuat = nguonDung.some((x) => NGUON_LUAT.includes(x));
    const coViec = nguonDung.some((x) => !NGUON_LUAT.includes(x));
    if (!coLuat || !coViec) return "thap";
    return n.daXacNhanMauThuan ? "cao" : "vua";
  }
  const hieuUng = tot2(n.hieuUng, true);
  if (!coChe || !tot(coChe, "B") || !hieuUng || !tot(hieuUng, "B")) return "thap";
  return hieuUng === "A" ? "cao" : "vua";
}

/** Kết luận do CODE tính: "đã rõ" khi có nguyên nhân và mọi nguyên nhân đều không ở mức "thấp". */
export function ketLuanTinh(qd: QuyetDinh, boiCanh: BoiCanh): "da_ro" | "chua_du_du_lieu" {
  return qd.nguyenNhan.length > 0 && qd.nguyenNhan.every((n) => mucChac(n, qd, boiCanh) !== "thap") ? "da_ro" : "chua_du_du_lieu";
}

/**
 * Mục đích của một việc do CODE suy ra (không để AI khai):
 *   hoi — hỏi chủ shop; thu_du_lieu — việc trong MA_THU_DU_LIEU; hoan_tac — trả về trạng thái cũ đã biết;
 *   sua_loi — căn cứ là cơ chế của một vi phạm ĐÃ CHẮC (đủ hai phía + đã xác nhận mâu thuẫn); còn lại — toi_uu.
 */
export type MucDich = "hoi" | "thu_du_lieu" | "hoan_tac" | "sua_loi" | "toi_uu";
export function mucDichTinh(h: HanhDong, qd: QuyetDinh, boiCanh: BoiCanh): MucDich {
  if (h.ma === "hoi_chu_shop") return "hoi";
  if (MA_THU_DU_LIEU.includes(h.ma)) return "thu_du_lieu";
  if (h.ma === "hoan_tac_thay_doi") return "hoan_tac";
  const viPhamChac = new Set(qd.nguyenNhan.filter((n) => n.kieu === "vi_pham" && mucChac(n, qd, boiCanh) === "cao").flatMap((n) => n.coChe));
  return h.canCu.some((id) => viPhamChac.has(id)) ? "sua_loi" : "toi_uu";
}

/** Việc ở vị trí `h` có bước hỏi chủ shop đứng TRƯỚC không (việc sau "hoi_chu_shop" chờ chủ shop đồng ý). */
const coHoiTruoc = (qd: QuyetDinh, h: HanhDong) => qd.hanhDong.some((x) => x.ma === "hoi_chu_shop" && x.uuTien < h.uuTien);

/**
 * KIỂM CỨNG một quyết định của AI điều hành. Vi phạm ở đây → trả lại AI điều hành sửa, KHÔNG tranh luận.
 */
export function kiemQuyetDinh(qd: QuyetDinh, boiCanh: BoiCanh): ViPham[] {
  const kho = new Map(boiCanh.bangChung.map((b) => [b.ma, b]));
  const bayGio = boiCanh.bayGio ?? new Date();
  const vp: ViPham[] = [];
  const theoId = new Map(qd.khangDinh.map((k) => [k.id, k]));

  // 1. Trích dẫn: mọi trích dẫn phải có nguyên văn; khẳng định "biết" phải có ít nhất một trích dẫn đúng, không từ AI.
  for (const k of qd.khangDinh) {
    for (const t of k.trichDan ?? []) {
      const r = kiemTrich(t, kho);
      if (!r.dung) vp.push({ loai: "trich_sai", chiTiet: `[${k.id}] ${r.lyDo}` });
    }
    // Trích từ bản nháp / đề xuất của AI vẫn hợp lệ cho "biết" (chứng minh văn bản ĐÓ ghi gì); sức nặng về thế giới
    // thực do hạng bằng chứng quyết (AI viết = hạng D, không đủ làm căn cứ "đã rõ").
    if (k.loai === "biet" && !(k.trichDan ?? []).some((t) => kiemTrich(t, kho).dung)) {
      vp.push({ loai: "biet_khong_can_cu", chiTiet: `[${k.id}] ghi "biết" mà không có trích dẫn đúng từ dữ liệu` });
    }
  }
  // Căn cứ trỏ tới khẳng định không tồn tại.
  for (const id of [...qd.nguyenNhan.flatMap((n) => [...n.coChe, ...n.hieuUng]), ...qd.hanhDong.flatMap((h) => h.canCu)]) {
    if (!theoId.has(id)) vp.push({ loai: "can_cu_khong_co", chiTiet: `căn cứ ${id} không có trong danh sách khẳng định` });
  }

  // 2. "Đã rõ" do CODE tính từ hạng bằng chứng — AI không khai.
  const daRoThat = ketLuanTinh(qd, boiCanh) === "da_ro";

  // 3. Hành động (mục đích do code suy ra).
  let soToiUu = 0;
  for (const h of qd.hanhDong) {
    const r = ruiRo(h.ma);
    const mucDich = mucDichTinh(h, qd, boiCanh);
    // Chế độ đề xuất: mọi việc đều chờ chủ shop duyệt — coi như đã hỏi trước.
    const hoi = boiCanh.cheDo === "de_xuat" || coHoiTruoc(qd, h);
    if (r.quyenChuShop && !hoi) vp.push({ loai: "quyen_chu_shop", chiTiet: `${h.ma}: việc thuộc quyền chủ shop phải xếp sau hoi_chu_shop` });
    if (r.tangTien) {
      if (h.soTien === undefined) vp.push({ loai: "thieu_muc_tien", chiTiet: `${h.ma}: phải ghi mức tiền mới` });
      else if (boiCanh.cheDo === "tu_dong" && (boiCanh.tranTien === undefined || h.soTien > boiCanh.tranTien) && !hoi) {
        vp.push({ loai: "vuot_tran", chiTiet: `${h.ma}: ${h.soTien} vượt trần ${boiCanh.tranTien ?? "(chưa đặt)"} — phải hỏi chủ shop` });
      }
    }
    // Việc rủi ro vừa / cao khi CHƯA đủ căn cứ (theo code) → phải hỏi chủ shop trước. Sửa lỗi có vi phạm đã chắc thì
    // được làm ngay (luật: sửa sai sự thật / trái chính sách là bắt buộc); thu dữ liệu / hỏi / hoàn tác không cần chờ.
    if (XEP[r.muc] >= 1 && !daRoThat && !hoi && (mucDich === "toi_uu")) {
      vp.push({ loai: "rui_ro_khi_chua_ro", chiTiet: `${h.ma}: rủi ro ${r.muc} khi chưa đủ căn cứ — phải hỏi chủ shop trước` });
    }
    // Mã đối tượng có thể ghi kèm tiền tố sổ bằng chứng ("SK-ti_le_chot") — so theo mã chỉ số trần.
    if (h.doiTuong && boiCanh.baoVe.includes(h.doiTuong.replace(/^\[?SK-/, "").replace(/\]$/, "")) && h.ma !== "giu_nguyen" && h.ma !== "thu_them_du_lieu" && h.ma !== "hoi_chu_shop") {
      vp.push({ loai: "dong_vao_cai_manh", chiTiet: `${h.ma}: ${h.doiTuong} đang mạnh` });
    }
    if (mucDich === "toi_uu") soToiUu++;
  }
  if (soToiUu > 1) vp.push({ loai: "nhieu_thay_doi", chiTiet: `${soToiUu} việc tối ưu cùng lúc — mỗi lần thử chỉ đổi một thứ` });

  // 4. Bỏ sót sự cố: sự cố là lỗi nặng nhất (mất kênh, AI bị ngắt) — học trò yếu hay "bắt cái vặt, bỏ cái nghiêm trọng".
  const daDan = new Set(qd.khangDinh.flatMap((k) => k.trichDan ?? []).filter((t) => kiemTrich(t, kho).dung).map((t) => t.ma));
  for (const sc of boiCanh.suCoPhaiXuLy ?? []) {
    if (!daDan.has(sc)) vp.push({ loai: "bo_sot_su_co", chiTiet: `sự cố ${sc} chưa được nhắc tới (không có khẳng định nào trích nó)` });
  }

  // 5. Duyệt đề xuất mà code đã biết là vi phạm.
  if (boiCanh.deXuat?.viPham.length && qd.quyetDinh === "tiep_tuc") {
    vp.push({ loai: "duyet_de_xuat_vi_pham", chiTiet: `${boiCanh.deXuat.ma}: ${boiCanh.deXuat.viPham.join("; ")}` });
  }
  return vp;
}

// ------------------------------------------------------------------------------------------------- phân xử

export interface PhanBien {
  /** Khẳng định bị phản bác (id) — hoặc hành động (mã) nếu phản bác việc làm. */
  nham: { khangDinh?: string; hanhDong?: string };
  noiDung: string;
  trichDan: TrichDan[];
}

export type KetQuaPhanBien =
  | { loai: "ghi_chu"; lyDo: string }
  | { loai: "xem_lai"; lyDo: string; hangPhanBien: Hang; hangDieuHanh: Hang | null; ruiRo: MucRuiRo };

/**
 * Xét MỘT phản biện của giám sát. Chỉ "xem_lai" (chặn, yêu cầu xem lại) khi đủ cả ba:
 *   - có trích dẫn ĐÚNG (code so nguyên văn) — lời lẽ hay mà không trích được thì chỉ là ghi chú;
 *   - nhắm vào chỗ CHỊU LỰC: căn cứ của việc rủi ro vừa / cao, hoặc căn cứ của nguyên nhân khi kết luận "đã rõ";
 *   - bằng chứng của phản biện KHÔNG YẾU HƠN bằng chứng của AI điều hành.
 */
export function xetPhanBien(pb: PhanBien, qd: QuyetDinh, boiCanh: BoiCanh): KetQuaPhanBien {
  const kho = new Map(boiCanh.bangChung.map((b) => [b.ma, b]));
  const bayGio = boiCanh.bayGio ?? new Date();
  const dung = (pb.trichDan ?? []).filter((t) => kiemTrich(t, kho).dung);
  if (!dung.length) return { loai: "ghi_chu", lyDo: "phản biện không có trích dẫn đúng từ dữ liệu" };
  const hangPb = dung.map((t) => hangBangChung(kho.get(t.ma)!, bayGio).hang).sort((a, b) => THU_TU.indexOf(a) - THU_TU.indexOf(b))[0];

  // Chỗ chịu lực + rủi ro cao nhất phụ thuộc vào nó.
  let ruiRoMax: MucRuiRo | null = null;
  const nangHon = (m: MucRuiRo) => { if (!ruiRoMax || XEP[m] > XEP[ruiRoMax]) ruiRoMax = m; };
  if (pb.nham.hanhDong) {
    const co = qd.hanhDong.filter((x) => x.ma === pb.nham.hanhDong);
    // Phản biện "THIẾU việc phải làm" (dừng thiếu) — xét theo rủi ro của chính việc bị bỏ sót.
    if (!co.length) nangHon(ruiRo(pb.nham.hanhDong).muc);
    for (const h of co) nangHon(ruiRo(h.ma).muc);
  }
  if (pb.nham.khangDinh) {
    for (const h of qd.hanhDong.filter((x) => x.canCu.includes(pb.nham.khangDinh!))) nangHon(ruiRo(h.ma).muc);
    if (ketLuanTinh(qd, boiCanh) === "da_ro" && qd.nguyenNhan.some((n) => [...n.coChe, ...n.hieuUng].includes(pb.nham.khangDinh!))) nangHon("vua");
  }
  if (!ruiRoMax || ruiRoMax === "thap") return { loai: "ghi_chu", lyDo: "không nhắm vào chỗ chịu lực của việc rủi ro" };

  const k = pb.nham.khangDinh ? qd.khangDinh.find((x) => x.id === pb.nham.khangDinh) : undefined;
  const hangDh = k ? hangKhangDinh(k, kho, bayGio) : null;
  if (hangDh && !tot(hangPb, hangDh)) return { loai: "ghi_chu", lyDo: `bằng chứng phản biện (hạng ${hangPb}) yếu hơn của AI điều hành (hạng ${hangDh})` };
  return { loai: "xem_lai", lyDo: pb.noiDung, hangPhanBien: hangPb, hangDieuHanh: hangDh, ruiRo: ruiRoMax };
}

/** Mã bằng chứng có trích dẫn đúng trong một quyết định. */
const maDaDan = (qd: QuyetDinh, kho: Map<string, BangChung>) =>
  new Set(qd.khangDinh.flatMap((k) => k.trichDan ?? []).filter((t) => kiemTrich(t, kho).dung).map((t) => t.ma));

const vanTat = (qd: QuyetDinh) => JSON.stringify([qd.quyetDinh, qd.hanhDong.map((h) => [h.ma, h.doiTuong ?? "", h.soTien ?? ""]).sort()]);

/**
 * ĐỔI Ý CÓ HỢP LỆ KHÔNG — chống bị cuốn theo lời phản biện. Hợp lệ khi: không đổi; hoặc bản trước có vi phạm cứng; hoặc
 * bản sau dẫn (trích dẫn đúng) ít nhất một bằng chứng CHƯA được xét ở vòng trước (của cả hai bên).
 */
export function doiYHopLe(truoc: QuyetDinh, sau: QuyetDinh, daXet: Set<string>, boiCanh: BoiCanh): { hopLe: boolean; lyDo: string } {
  if (vanTat(truoc) === vanTat(sau)) return { hopLe: true, lyDo: "không đổi quyết định" };
  if (kiemQuyetDinh(truoc, boiCanh).length) return { hopLe: true, lyDo: "bản trước có vi phạm cứng" };
  const kho = new Map(boiCanh.bangChung.map((b) => [b.ma, b]));
  const moi = [...maDaDan(sau, kho)].filter((m) => !daXet.has(m));
  return moi.length
    ? { hopLe: true, lyDo: `có bằng chứng mới: ${moi.join(", ")}` }
    : { hopLe: false, lyDo: "đổi ý mà không có bằng chứng mới — chỉ vì lời phản biện" };
}

export type PhanQuyet =
  | { ketQua: "tra_lai_dieu_hanh"; viPham: ViPham[] }
  | { ketQua: "thuc_hien"; ghiChu: string[] }
  | { ketQua: "xem_lai"; yeuCau: KetQuaPhanBien[]; ghiChu: string[] }
  | { ketQua: "dung_hoi_chu_shop"; lyDo: string; ghiChu: string[] }
  | { ketQua: "dieu_hanh_quyet_ghi_so"; lyDo: string; ghiChu: string[] };

/**
 * PHÂN XỬ — thứ tự cố định, không AI nào "mặc định thắng":
 *   1. Code: vi phạm cứng → trả lại AI điều hành sửa (không tranh luận).
 *   2. Phản biện của giám sát: chỉ cái qua xetPhanBien mới chặn; còn lại thành ghi chú (đã ghi nhận, tiếp tục).
 *   3. Vòng 1 có phản biện chặn → AI điều hành xem lại MỘT lần (truyền `sau`).
 *   4. Sau vòng đó: đổi ý phải hợp lệ (doiYHopLe); giữ nguyên mà phản biện vẫn đứng → rủi ro CAO: dừng, hỏi chủ shop
 *      kèm hai bên + hạng bằng chứng; rủi ro vừa: AI điều hành quyết, ghi sổ, chạy như thử nghiệm có hoàn tác.
 */
export function phanXu(p: { truoc: QuyetDinh; phanBien: PhanBien[]; sau?: QuyetDinh; phanBienSau?: PhanBien[]; boiCanh: BoiCanh }): PhanQuyet {
  const { truoc, boiCanh } = p;
  const vp = kiemQuyetDinh(truoc, boiCanh);
  if (vp.length && !p.sau) return { ketQua: "tra_lai_dieu_hanh", viPham: vp };

  const xet = (qd: QuyetDinh, ds: PhanBien[]) => ds.map((pb) => xetPhanBien(pb, qd, boiCanh));
  const kq1 = xet(truoc, p.phanBien);
  const ghiChu1 = kq1.filter((x) => x.loai === "ghi_chu").map((x) => x.lyDo);
  const chan1 = kq1.filter((x) => x.loai === "xem_lai");
  if (!p.sau) return chan1.length ? { ketQua: "xem_lai", yeuCau: chan1, ghiChu: ghiChu1 } : { ketQua: "thuc_hien", ghiChu: ghiChu1 };

  // Vòng duy nhất đã xong.
  const sau = p.sau;
  const vpSau = kiemQuyetDinh(sau, boiCanh);
  if (vpSau.length) return { ketQua: "dung_hoi_chu_shop", lyDo: `sau vòng xem lại vẫn vi phạm cứng: ${vpSau.map((v) => v.loai).join(", ")}`, ghiChu: ghiChu1 };
  const kho = new Map(boiCanh.bangChung.map((b) => [b.ma, b]));
  const daXet = new Set([...maDaDan(truoc, kho), ...p.phanBien.flatMap((x) => x.trichDan ?? []).filter((t) => kiemTrich(t, kho).dung).map((t) => t.ma)]);
  const doi = doiYHopLe(truoc, sau, daXet, boiCanh);
  if (!doi.hopLe) return { ketQua: "dung_hoi_chu_shop", lyDo: doi.lyDo, ghiChu: ghiChu1 };
  const kq2 = xet(sau, p.phanBienSau ?? p.phanBien).filter((x): x is Extract<KetQuaPhanBien, { loai: "xem_lai" }> => x.loai === "xem_lai");
  if (!kq2.length) return { ketQua: "thuc_hien", ghiChu: ghiChu1 };
  if (kq2.some((x) => x.ruiRo === "cao")) {
    return { ketQua: "dung_hoi_chu_shop", lyDo: `bất đồng sau một vòng ở việc rủi ro cao: ${kq2.map((x) => x.lyDo).join(" | ")}`, ghiChu: ghiChu1 };
  }
  return { ketQua: "dieu_hanh_quyet_ghi_so", lyDo: `bất đồng ở việc rủi ro vừa — AI điều hành quyết, chạy như thử nghiệm có hoàn tác: ${kq2.map((x) => x.lyDo).join(" | ")}`, ghiChu: ghiChu1 };
}

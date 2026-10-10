/**
 * AI ĐIỀU HÀNH — quy trình từng bước theo hướng "học trò yếu" (chủ dự án duyệt 09/10/2026; docs mục 14).
 *
 * Coi mọi mô hình là học trò yếu, hay sai. Không giao câu hỏi mở và lớn; mỗi bước có đầu vào, đầu ra, điều kiện kiểm:
 *   1. CODE: sổ bằng chứng (so-bang-chung.ts) + luật hệ thống → danh sách [MÃ] nguyên văn, hạng do code chấm.
 *   2. AI điều hành: chẩn đoán + đề xuất theo khuôn CÓ TRÍCH DẪN, chọn từ bảng mã (không có ô "kết luận" / "mức chắc" /
 *      "mục đích" — code tính). Lời dặn nêu thẳng các lỗi nó ĐÃ mắc thật ở bộ đề.
 *   3. CODE: kiểm cứng (kiem-cung.ts). Vi phạm → trả lại sửa MỘT lần kèm danh sách lỗi cụ thể (AI chỉ tự sửa được khi có
 *      phản hồi bên ngoài — Huang et al., ICLR 2024). Vẫn vi phạm → dừng, chuyển chủ shop. Không vòng lặp vô tận.
 *   4. CODE: soạn câu hỏi kiểm HẸP cho những gì code không tự xét được (hai câu có thật sự mâu thuẫn không; trích dẫn bỏ
 *      mất điều kiện có sai nghĩa không; có bằng chứng ngược / nguyên nhân khác không — phân tích giả thuyết cạnh tranh).
 *   5. AI kiểm: chỉ trả lời các câu hỏi đó, thấy DỮ LIỆU + quyết định dạng mã — không thấy lời lẽ của bên kia. Trích dẫn
 *      bắt buộc; không trích được → chỉ là ghi chú.
 *   6. CODE: phân xử (phanXu) — tối đa một vòng xem lại; đổi ý phải có bằng chứng mới.
 *   7. CODE viết đề xuất cho chủ shop từ dữ liệu có cấu trúc (hienDeXuat) — AI không viết câu chữ cuối, không bịa được.
 * Hàm gọi AI được TRUYỀN VÀO (goi) → cả quy trình kiểm được bằng AI giả, không tốn tiền.
 */
import { chatJson } from "./ai.js";
import {
  type BangChung, type BoiCanh, type HanhDong, type KhangDinh, type MaQuyetDinh, type NguyenNhan, type PhanBien,
  type PhanQuyet, type QuyetDinh, type TrichDan, type ViPham, hangBangChung, kiemQuyetDinh, kiemTrich, ketLuanTinh,
  mucChac, mucDichTinh, nguCanhTrich, phanXu, ruiRo, chuanHoa,
} from "./kiem-cung.js";
import { LUAT_HE_THONG, MA_HANH_DONG, MA_NGUYEN_NHAN, NHAN_VIEN, QUYET_DINH } from "./ma-dieu-hanh.js";
import type { SoBangChung } from "./so-bang-chung.js";

/**
 * Mô hình TẠM (docs mục 12–13: bằng chứng yếu, chưa phân biệt được ứng viên): điều hành = Claude Opus 5.5 (điểm bộ đề
 * cao nhất); kiểm = GPT-5.6 Terra (khác hãng, ngang Opus ở vai kiểm, rẻ hơn ~3 lần). Bước 5 đo lại trên ca thật.
 */
export const MO_HINH_DIEU_HANH = "anthropic/claude-opus-5.5";
export const MO_HINH_KIEM = "openai/gpt-5.6-terra";

export type GoiAi = (vai: "dieu_hanh" | "kiem", heThong: string, noiDung: string) => Promise<{ du: unknown; tien: number }>;

/** Gọi AI thật qua hạ tầng chung (sổ tiền từng lượt, giấu nhà cung cấp). */
export function goiAiThat(userId: number): GoiAi {
  return async (vai, heThong, noiDung) => {
    const r = await chatJson<unknown>({
      task: "analytics",
      userId,
      viec: vai === "dieu_hanh" ? "dieu_hanh_chan_doan" : "dieu_hanh_kiem",
      model: vai === "dieu_hanh" ? MO_HINH_DIEU_HANH : MO_HINH_KIEM,
      maxTokens: 8000,
      messages: [{ role: "system", content: heThong }, { role: "user", content: noiDung }],
      validate: (v) => v,
    });
    return { du: r.output, tien: r.usage?.costUsd ?? 0 };
  };
}

// --------------------------------------------------------------------------------------------- hiện dữ liệu cho AI

const TEN_NGUON: Record<BangChung["nguon"], string> = {
  nhat_ky_he_thong: "nhật ký hệ thống", tai_lieu_trang: "tài liệu trang", luat_he_thong: "luật hệ thống",
  thu_nghiem: "thử nghiệm có đối chứng", thong_ke_he_thong: "số hệ thống đo", nen_tang_bao: "số nền tảng báo",
  chu_shop_noi: "lời chủ shop", hoi_thoai: "hội thoại", ai_tao: "do AI viết",
};

/** Sổ bằng chứng + luật → kho dùng cho kiểm cứng. */
export function khoBangChung(so: SoBangChung): BangChung[] {
  return [...so.bangChung, ...LUAT_HE_THONG.map((l): BangChung => ({ ma: l.ma, nguon: "luat_he_thong", noiDung: l.noiDung, luc: so.luc }))];
}

/** Dữ liệu ĐẶT TRÊN CÙNG (hướng dẫn Anthropic: dữ liệu dài để trên, câu hỏi để dưới). */
export function hienSo(so: SoBangChung, kho: BangChung[]): string {
  const dong = kho.map((b) => {
    const h = hangBangChung(b, so.luc);
    const gh = (b.gioiHan ?? []).map((g) => `\n    ⚠ ${g}`).join("");
    return `[${b.ma}] (${TEN_NGUON[b.nguon]}, hạng ${h.hang}${h.lyDo.length ? `: ${h.lyDo.join(", ")}` : ""})\n${b.noiDung}${gh}`;
  });
  return `<so_bang_chung>\n${dong.join("\n\n")}\n</so_bang_chung>\n\n<khoang_trong>\n${so.khoangTrong.map((k) => `- ${k}`).join("\n") || "- (không có)"}\n</khoang_trong>`;
}

const bang = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `  - ${k}: ${v}`).join("\n");

/**
 * Lời dặn AI điều hành. Phần "lỗi bạn hay mắc" lấy từ lỗi ĐÃ THẤY THẬT ở bộ đề (docs mục 10–13) — Anthropic: nêu lý do
 * và đưa ví dụ giúp mô hình làm đúng hơn. Đây là phần PHỤ: chốt chặn thật nằm ở code (kiem-cung.ts).
 */
export function loiDanDieuHanh(cheDo: BoiCanh["cheDo"]): string {
  return `Bạn là AI ĐIỀU HÀNH của một shop bán hàng online có 3 AI nhân viên (nội dung, quảng cáo, bán hàng). Việc của bạn: đọc SỔ BẰNG CHỨNG, chẩn đoán vấn đề được giao, đề xuất việc cần làm. Chế độ hiện tại: ${cheDo === "de_xuat" ? "ĐỀ XUẤT — mọi thay đổi chờ chủ shop duyệt" : "TỰ ĐỘNG trong trần"}.

CÁCH HỆ THỐNG KIỂM BẠN (đọc kỹ — vi phạm là bị trả lại):
- Mỗi khẳng định ghi "biet" phải kèm trích dẫn NGUYÊN VĂN (chép đúng từng chữ, ít nhất 8 ký tự) từ đúng [MÃ] trong sổ. Code so từng chữ. Không chép được → ghi "chua_biet" hoặc "suy_luan".
- Bạn KHÔNG tự ghi "đã rõ" hay mức chắc chắn. Hệ thống tự tính từ hạng bằng chứng: chẩn đoán cần cả CƠ CHẾ (chuyện gì đã xảy ra — vd. nhật ký thay đổi) và HIỆU ỨNG (số đo thay đổi có ý nghĩa thống kê); "vi phạm" cần hai phía: câu bên việc làm VÀ câu bên luật / tài liệu.
- Việc rủi ro (tốn tiền, đổi cách bán, thuộc quyền chủ shop) khi bằng chứng chưa đủ → xếp "hoi_chu_shop" TRƯỚC (uu_tien nhỏ hơn). Thu dữ liệu / thử nghiệm nhỏ trong trần / hoàn tác / sửa lỗi sai sự thật đã rõ → làm được, không cần dừng.
- Mỗi lần chỉ MỘT việc tối ưu; sửa lỗi sai sự thật không tính.
- Mọi sự cố trong sổ (mã SC-…) đều phải được nhắc tới (trích) — không được bỏ qua cái nghiêm trọng.
- Không đụng chỉ số đang mạnh: ${"" /* danh sách nằm trong sổ */}xem các chỉ số "ĐANG MẠNH".

LỖI BẠN (VÀ CÁC MÔ HÌNH KHÁC) ĐÃ MẮC THẬT — tránh:
1. Nói tài liệu "đã có cách đặt hàng" trong khi tài liệu không có câu đó → bịa. Chỉ nói "tài liệu có X" khi chép được câu chứa X.
2. Thấy chủ shop ra lệnh "tắt quảng cáo A" khi 4 vs 7 đơn chưa có ý nghĩa thống kê → tắt ngay. Đúng: báo chủ shop số liệu chưa phân biệt được, rồi làm theo quyết định của chủ shop (xếp hoi_chu_shop trước).
3. Ghi "đã rõ" khi mẫu nhỏ / chỉ có một hội thoại → hệ thống đã bỏ ô này; hãy nêu đủ cơ chế + hiệu ứng, thiếu thì nêu rõ thiếu gì.
4. Trích "miễn phí giao hàng" từ câu "miễn phí giao hàng cho đơn từ 300.000đ" → bỏ mất điều kiện, sai nghĩa. Trích cả điều kiện.
5. Thấy "không có" trong phần bị rút gọn / AI nhân viên không thấy (dòng ⚠) rồi kết luận "tài liệu không có" → sai. Phần ⚠ và <khoang_trong> là CHƯA BIẾT.

BẢNG MÃ (chỉ dùng mã trong bảng):
Nguyên nhân:
${bang(MA_NGUYEN_NHAN)}
Hành động:
${bang(MA_HANH_DONG)}
Nhân viên: ${NHAN_VIEN.join(", ")}
Quyết định cho việc được hỏi: tiep_tuc (làm tiếp đúng đề xuất / kế hoạch đang xét), dung (dừng việc đang chạy), tu_choi (không duyệt đề xuất đang xét), chuyen_chu_shop (chờ chủ shop quyết).

TRẢ LỜI ĐÚNG MỘT ĐỐI TƯỢNG JSON:
{
  "khang_dinh": [{"id": "k1", "noi_dung": "<một ý ngắn>", "loai": "biet" | "suy_luan" | "chua_biet", "trich_dan": [{"ma": "<MÃ trong sổ>", "trich": "<nguyên văn>"}]}],
  "nguyen_nhan": [{"ma": "<mã nguyên nhân>", "kieu": "chan_doan" | "vi_pham", "co_che": ["<id khẳng định>"], "hieu_ung": ["<id khẳng định>"]}],
  "hanh_dong": [{"ma": "<mã hành động>", "nhan_vien": "<nhân viên>", "uu_tien": <1 là làm trước>, "doi_tuong": "<MÃ nếu có>", "can_cu": ["<id khẳng định>"], "so_tien": <mức tiền mới mỗi ngày nếu việc dính tiền>}],
  "quyet_dinh": "<quyết định>"
}`;
}

// --------------------------------------------------------------------------------------------- đọc câu trả lời

const laMang = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const chu = (v: unknown) => (typeof v === "string" ? v : "");
const dsChu = (v: unknown) => laMang(v).map(chu).filter(Boolean);
const docTrich = (v: unknown): TrichDan[] => laMang(v).map((t) => t as Record<string, unknown>)
  .map((t) => ({ ma: chu(t?.ma).replace(/^\[|\]$/g, ""), trich: chu(t?.trich) })).filter((t) => t.ma);

/** Đọc quyết định AI trả về — mã ngoài bảng / sai khuôn KHÔNG lặng lẽ bỏ qua: ghi thành vi phạm "sai_khuon". */
export function docQuyetDinh(raw: unknown): { qd: QuyetDinh; loiKhuon: ViPham[] } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const loiKhuon: ViPham[] = [];
  const khangDinh: KhangDinh[] = laMang(o.khang_dinh).map((x) => x as Record<string, unknown>).map((k, i) => {
    const loai = ["biet", "suy_luan", "chua_biet"].includes(chu(k?.loai)) ? (chu(k.loai) as KhangDinh["loai"]) : "suy_luan";
    if (loai !== k?.loai) loiKhuon.push({ loai: "sai_khuon", chiTiet: `khẳng định ${chu(k?.id) || i + 1}: loại "${chu(k?.loai)}" không hợp lệ` });
    return { id: chu(k?.id) || `k${i + 1}`, noiDung: chu(k?.noi_dung), loai, trichDan: docTrich(k?.trich_dan) };
  });
  const nguyenNhan: NguyenNhan[] = [];
  for (const x of laMang(o.nguyen_nhan).map((x) => x as Record<string, unknown>)) {
    if (!(chu(x?.ma) in MA_NGUYEN_NHAN)) { loiKhuon.push({ loai: "sai_khuon", chiTiet: `mã nguyên nhân "${chu(x?.ma)}" không có trong bảng` }); continue; }
    if (!["chan_doan", "vi_pham"].includes(chu(x.kieu))) { loiKhuon.push({ loai: "sai_khuon", chiTiet: `nguyên nhân ${chu(x.ma)}: kiểu "${chu(x.kieu)}" không hợp lệ` }); continue; }
    nguyenNhan.push({ ma: chu(x.ma), kieu: chu(x.kieu) as NguyenNhan["kieu"], coChe: dsChu(x.co_che), hieuUng: dsChu(x.hieu_ung) });
  }
  const hanhDong: HanhDong[] = [];
  for (const x of laMang(o.hanh_dong).map((x) => x as Record<string, unknown>)) {
    if (!(chu(x?.ma) in MA_HANH_DONG)) { loiKhuon.push({ loai: "sai_khuon", chiTiet: `mã hành động "${chu(x?.ma)}" không có trong bảng` }); continue; }
    const uu = Number(x.uu_tien);
    if (!Number.isInteger(uu) || uu < 1) loiKhuon.push({ loai: "sai_khuon", chiTiet: `hành động ${chu(x.ma)}: thiếu thứ tự ưu tiên` });
    const nv = chu(x.nhan_vien);
    if (!(NHAN_VIEN as readonly string[]).includes(nv)) loiKhuon.push({ loai: "sai_khuon", chiTiet: `hành động ${chu(x.ma)}: nhân viên "${nv}" không hợp lệ` });
    const so = x.so_tien === undefined || x.so_tien === null ? undefined : Number(x.so_tien);
    hanhDong.push({ ma: chu(x.ma), nhanVien: nv, uuTien: Number.isInteger(uu) && uu >= 1 ? uu : 99, doiTuong: chu(x.doi_tuong) || undefined,
      canCu: dsChu(x.can_cu), soTien: so !== undefined && Number.isFinite(so) ? so : undefined });
  }
  const qdMa = chu(o.quyet_dinh);
  if (!(QUYET_DINH as readonly string[]).includes(qdMa)) loiKhuon.push({ loai: "sai_khuon", chiTiet: `quyết định "${qdMa}" không hợp lệ` });
  return { qd: { khangDinh, nguyenNhan, hanhDong, quyetDinh: ((QUYET_DINH as readonly string[]).includes(qdMa) ? qdMa : "chuyen_chu_shop") as MaQuyetDinh }, loiKhuon };
}

// --------------------------------------------------------------------------------------------- câu hỏi kiểm hẹp

export interface CauHoiKiem {
  id: string;
  loai: "mau_thuan" | "thieu_dieu_kien" | "gia_thuyet_khac";
  hoi: string;
  /** Nối kết quả về quyết định. */
  nguyenNhan?: number;
  khangDinh?: string;
}

/** Code soạn câu hỏi HẸP cho những gì code không tự xét được. */
export function cauHoiKiem(qd: QuyetDinh, kho: BangChung[]): CauHoiKiem[] {
  const m = new Map(kho.map((b) => [b.ma, b]));
  const theoId = new Map(qd.khangDinh.map((k) => [k.id, k]));
  const ra: CauHoiKiem[] = [];
  qd.nguyenNhan.forEach((n, i) => {
    const trich = n.coChe.flatMap((id) => theoId.get(id)?.trichDan ?? []).filter((t) => kiemTrich(t, m).dung);
    if (n.kieu === "vi_pham") {
      const cau = trich.map((t) => `[${t.ma}] «${nguCanhTrich(t, m)?.cau ?? t.trich}»`);
      ra.push({ id: `MT-${i + 1}`, loai: "mau_thuan", nguyenNhan: i,
        hoi: `Nguyên nhân "${n.ma}" (vi phạm) dựa trên: ${cau.join(" ; ")}. Câu bên VIỆC LÀM có thật sự TRÁI câu bên LUẬT / TÀI LIỆU không (xét cả điều kiện, phạm vi, thời điểm)?` });
    } else {
      ra.push({ id: `KH-${i + 1}`, loai: "gia_thuyet_khac", nguyenNhan: i, khangDinh: n.hieuUng[0] ?? n.coChe[0],
        hoi: `Nguyên nhân "${n.ma}" (chẩn đoán). Trong sổ có bằng chứng nào NGƯỢC với nguyên nhân này, hoặc chỉ ra nguyên nhân KHÁC giải thích số liệu tốt hơn không? Có thì trích.` });
    }
  });
  for (const k of qd.khangDinh) {
    for (const t of k.trichDan) {
      const nc = nguCanhTrich(t, m);
      if (nc && nc.thieuDieuKien.length) {
        ra.push({ id: `NC-${k.id}-${t.ma}`, loai: "thieu_dieu_kien", khangDinh: k.id,
          hoi: `Khẳng định [${k.id}] «${k.noiDung}» trích «${t.trich}» từ câu đầy đủ «${nc.cau}» — bỏ mất: ${nc.thieuDieuKien.join(", ")}. Bỏ như vậy có làm SAI NGHĨA khẳng định không?` });
      }
    }
  }
  return ra;
}

/** Quyết định dạng mã cho người kiểm — KHÔNG có lời lẽ giải thích; mỗi trích dẫn hiện kèm CẢ CÂU gốc. */
export function hienQuyetDinhChoKiem(qd: QuyetDinh, kho: BangChung[]): string {
  const m = new Map(kho.map((b) => [b.ma, b]));
  const kd = qd.khangDinh.map((k) => `[${k.id}] (${k.loai}) ${k.noiDung}${k.trichDan.map((t) => `\n    trích [${t.ma}] «${t.trich}»${(() => { const nc = nguCanhTrich(t, m); return nc && nc.cau !== t.trich ? ` — câu gốc «${nc.cau}»` : ""; })()}`).join("")}`);
  const nn = qd.nguyenNhan.map((n, i) => `${i + 1}. ${n.ma} (${n.kieu}) · cơ chế: ${n.coChe.join(", ") || "—"} · hiệu ứng: ${n.hieuUng.join(", ") || "—"}`);
  const hd = qd.hanhDong.map((h) => `${h.uuTien}. ${h.ma} (${h.nhanVien})${h.doiTuong ? ` → ${h.doiTuong}` : ""}${h.soTien !== undefined ? ` · ${h.soTien.toLocaleString("vi-VN")} ₫/ngày` : ""} · căn cứ: ${h.canCu.join(", ") || "—"} · rủi ro: ${ruiRo(h.ma).muc}`);
  return `KHẲNG ĐỊNH:\n${kd.join("\n") || "(không có)"}\n\nNGUYÊN NHÂN:\n${nn.join("\n") || "(không có)"}\n\nHÀNH ĐỘNG:\n${hd.join("\n") || "(không có)"}\n\nQUYẾT ĐỊNH: ${qd.quyetDinh}`;
}

export function loiDanKiem(): string {
  return `Bạn là AI KIỂM CHÉO của hệ thống bán hàng. Bạn KHÔNG ra quyết định kinh doanh. Bạn trả lời các CÂU HỎI KIỂM do hệ thống soạn, đối chiếu với SỔ BẰNG CHỨNG (dữ liệu gốc). Bạn không thấy lời giải thích của AI điều hành — tự kiểm, đừng đoán ý.

QUY TẮC:
- Mỗi câu trả lời "co" phải kèm trích dẫn NGUYÊN VĂN (≥ 8 ký tự) từ đúng [MÃ] trong sổ. Không trích được → trả "khong_ro". Code so từng chữ.
- Trích dẫn đúng nguồn chưa chắc là kết luận đúng: xét cả điều kiện, phạm vi, thời điểm, cỡ mẫu, hạng bằng chứng.
- Dòng ⚠ và <khoang_trong> là CHƯA BIẾT — không suy ra "không có" từ đó.
- Có thể nêu thêm phản biện ngoài câu hỏi, nhưng CHỈ khi nó làm sai điều sẽ thực thi (việc rủi ro, bỏ sót sự cố, đụng chỉ số đang mạnh) và có trích dẫn. Góp ý vặt → "ghi_chu".

TRẢ LỜI ĐÚNG MỘT ĐỐI TƯỢNG JSON:
{"tra_loi": [{"id": "<id câu hỏi>", "ket_qua": "co" | "khong" | "khong_ro", "giai_thich": "<ngắn>", "trich_dan": [{"ma": "<MÃ>", "trich": "<nguyên văn>"}]}],
 "phan_bien": [{"khang_dinh": "<id khẳng định hoặc rỗng>", "hanh_dong": "<mã hành động hoặc rỗng>", "noi_dung": "<ngắn>", "trich_dan": [{"ma": "<MÃ>", "trich": "<nguyên văn>"}]}],
 "ghi_chu": ["<góp ý không chặn>"]}`;
}

/** Đọc câu trả lời của AI kiểm → xác nhận mâu thuẫn + danh sách phản biện (code nối về đúng khẳng định). */
export function docKiem(raw: unknown, cauHoi: CauHoiKiem[], qd: QuyetDinh): { xacNhan: Set<number>; phanBien: PhanBien[]; ghiChu: string[] } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const theoId = new Map(cauHoi.map((c) => [c.id, c]));
  const xacNhan = new Set<number>();
  const phanBien: PhanBien[] = [];
  for (const t of laMang(o.tra_loi).map((x) => x as Record<string, unknown>)) {
    const c = theoId.get(chu(t?.id));
    if (!c || chu(t.ket_qua) !== "co") continue;
    const trich = docTrich(t.trich_dan);
    if (c.loai === "mau_thuan" && c.nguyenNhan !== undefined) xacNhan.add(c.nguyenNhan);
    else if (c.khangDinh) phanBien.push({ nham: { khangDinh: c.khangDinh }, noiDung: `${c.id}: ${chu(t.giai_thich)}`, trichDan: trich });
  }
  const idKd = new Set(qd.khangDinh.map((k) => k.id));
  for (const p of laMang(o.phan_bien).map((x) => x as Record<string, unknown>)) {
    const kd = chu(p?.khang_dinh), hd = chu(p?.hanh_dong);
    if (!(kd && idKd.has(kd)) && !(hd && hd in MA_HANH_DONG)) continue;
    phanBien.push({ nham: { khangDinh: kd && idKd.has(kd) ? kd : undefined, hanhDong: hd && hd in MA_HANH_DONG ? hd : undefined }, noiDung: chu(p.noi_dung), trichDan: docTrich(p.trich_dan) });
  }
  return { xacNhan, phanBien, ghiChu: dsChu(o.ghi_chu) };
}

// --------------------------------------------------------------------------------------------- quy trình

export interface KetQuaDieuHanh {
  ketQua: PhanQuyet["ketQua"] | "dung_hoi_chu_shop";
  lyDo: string;
  qd: QuyetDinh;
  ketLuan: "da_ro" | "chua_du_du_lieu";
  mucChac: { ma: string; muc: "cao" | "vua" | "thap" }[];
  viPham: ViPham[];
  ghiChu: string[];
  soLuotAi: number;
  tienUsd: number;
  /** Toàn bộ vào / ra từng bước — để soát lại. */
  nhatKy: { buoc: string; vao?: string; ra: unknown }[];
  /** Vi phạm code bắt ở MỖI vòng (kể cả vòng đã được sửa) — lỗi AI đã mắc, ghi sổ lỗi. */
  viPhamCacVong: { buoc: string; viPham: ViPham[] }[];
  thoiGianMs: number;
}

export async function dieuHanhMotLan(p: { vanDe: string; so: SoBangChung; cheDo: BoiCanh["cheDo"]; tranTien?: number; deXuat?: BoiCanh["deXuat"]; goi: GoiAi }): Promise<KetQuaDieuHanh> {
  const kho = khoBangChung(p.so);
  const bc: BoiCanh = { bangChung: kho, cheDo: p.cheDo, tranTien: p.tranTien, baoVe: p.so.baoVe, deXuat: p.deXuat, bayGio: p.so.luc,
    suCoPhaiXuLy: p.so.bangChung.filter((b) => b.ma.startsWith("SC-")).map((b) => b.ma) };
  const nhatKy: KetQuaDieuHanh["nhatKy"] = [];
  const viPhamCacVong: KetQuaDieuHanh["viPhamCacVong"] = [];
  const batDau = Date.now();
  let soLuot = 0, tien = 0;
  const goi = async (vai: "dieu_hanh" | "kiem", heThong: string, noiDung: string, buoc: string) => {
    const r = await p.goi(vai, heThong, noiDung);
    soLuot++; tien += r.tien;
    nhatKy.push({ buoc, vao: noiDung, ra: r.du });
    return r.du;
  };
  const du = hienSo(p.so, kho);
  const dan = loiDanDieuHanh(p.cheDo);
  const hoi = `${du}\n\nVẤN ĐỀ ĐƯỢC GIAO (hệ thống chọn từ bảng sức khoẻ):\n${p.vanDe}`;
  const ketThuc = (ketQua: KetQuaDieuHanh["ketQua"], lyDo: string, qd: QuyetDinh, viPham: ViPham[], ghiChu: string[]): KetQuaDieuHanh => ({
    ketQua, lyDo, qd, ketLuan: ketLuanTinh(qd, bc), mucChac: qd.nguyenNhan.map((n) => ({ ma: n.ma, muc: mucChac(n, qd, bc) })),
    viPham, ghiChu, soLuotAi: soLuot, tienUsd: tien, nhatKy, viPhamCacVong, thoiGianMs: Date.now() - batDau });
  const kiemHet = (r: { qd: QuyetDinh; loiKhuon: ViPham[] }) => [...r.loiKhuon, ...kiemQuyetDinh(r.qd, bc)];

  /*
   * THỨ TỰ (sửa sau khi rà: kiểm cứng đầy đủ chạy TRƯỚC xác nhận mâu thuẫn thì vi phạm có thật còn ở mức "chưa xác
   * nhận" → hai việc sửa lỗi bị tính là hai việc tối ưu → đề xuất ĐÚNG bị chặn nhầm):
   *   a. AI điều hành → kiểm KHUÔN + TRÍCH DẪN (không phụ thuộc xác nhận). Sai → sửa một lần; vẫn sai → chủ shop.
   *   b. AI kiểm: câu hỏi hẹp (gồm xác nhận mâu thuẫn) + phản biện.
   *   c. Kiểm cứng ĐẦY ĐỦ với xác nhận + phân xử. Vi phạm / phản biện chặn → MỘT vòng xem lại chung.
   * Tối đa 4 lượt AI.
   */
  const LOAI_KHUON = new Set(["sai_khuon", "trich_sai", "biet_khong_can_cu", "can_cu_khong_co"]);
  const loiKhuonVaTrich = (x: { qd: QuyetDinh; loiKhuon: ViPham[] }) => [...x.loiKhuon, ...kiemQuyetDinh(x.qd, bc).filter((v) => LOAI_KHUON.has(v.loai))];

  let r = docQuyetDinh(await goi("dieu_hanh", dan, hoi, "chẩn đoán"));
  let vp = loiKhuonVaTrich(r);
  if (vp.length) {
    viPhamCacVong.push({ buoc: "chẩn đoán", viPham: vp });
    r = docQuyetDinh(await goi("dieu_hanh", dan, `${hoi}\n\nLẦN TRƯỚC BỊ HỆ THỐNG TRẢ LẠI vì:\n${vp.map((v) => `- ${v.loai}: ${v.chiTiet}`).join("\n")}\n\nQuyết định lần trước:\n${hienQuyetDinhChoKiem(r.qd, kho)}\n\nSửa đúng các lỗi trên.`, "sửa khuôn / trích dẫn"));
    vp = loiKhuonVaTrich(r);
    if (vp.length) viPhamCacVong.push({ buoc: "sửa khuôn / trích dẫn", viPham: vp });
    if (vp.length) return ketThuc("dung_hoi_chu_shop", "vẫn sai khuôn / trích dẫn sau một lần sửa", r.qd, vp, []);
  }

  // b. Kiểm chéo bằng câu hỏi hẹp.
  const ch = cauHoiKiem(r.qd, kho);
  const kq = docKiem(await goi("kiem", loiDanKiem(), `${du}\n\nVẤN ĐỀ: ${p.vanDe}\n\nQUYẾT ĐỊNH CẦN KIỂM (dạng mã):\n${hienQuyetDinhChoKiem(r.qd, kho)}\n\nCÂU HỎI KIỂM:\n${ch.map((c) => `[${c.id}] ${c.hoi}`).join("\n") || "(không có câu hỏi bắt buộc — chỉ nêu phản biện nếu có lỗi làm sai điều sẽ thực thi)"}`, "kiểm chéo"), ch, r.qd);
  const daXacNhan = new Set(r.qd.nguyenNhan.filter((_, i) => kq.xacNhan.has(i)).map((n) => khoaViPham(n, r.qd)));
  const ganXacNhan = (q: QuyetDinh): QuyetDinh => ({ ...q, nguyenNhan: q.nguyenNhan.map((n) => ({ ...n, daXacNhanMauThuan: n.kieu === "vi_pham" && daXacNhan.has(khoaViPham(n, q)) })) });
  const qd = ganXacNhan(r.qd);

  // c. Kiểm cứng đầy đủ + phân xử; vi phạm hoặc phản biện chặn → MỘT vòng xem lại chung.
  const px1 = phanXu({ truoc: qd, phanBien: kq.phanBien, boiCanh: bc });
  if (px1.ketQua === "thuc_hien") return ketThuc("thuc_hien", "qua kiểm cứng và kiểm chéo", qd, [], [...px1.ghiChu, ...kq.ghiChu]);
  if (px1.ketQua === "tra_lai_dieu_hanh") viPhamCacVong.push({ buoc: "kiểm cứng đầy đủ", viPham: px1.viPham });
  const yeuCau = px1.ketQua === "tra_lai_dieu_hanh"
    ? px1.viPham.map((v) => `- vi phạm ${v.loai}: ${v.chiTiet}`)
    : px1.ketQua === "xem_lai" ? px1.yeuCau.map((y) => `- kiểm chéo (có trích dẫn đúng): ${y.lyDo}`) : [];
  const sauR = docQuyetDinh(await goi("dieu_hanh", dan, `${hoi}\n\nQuyết định của bạn:\n${hienQuyetDinhChoKiem(qd, kho)}\n\nCẦN XEM LẠI:\n${yeuCau.join("\n")}\n\nVi phạm luật: phải sửa. Phản biện: chỉ đổi khi có BẰNG CHỨNG MỚI trong sổ (mã chưa dùng); không có thì giữ nguyên.`, "xem lại"));
  const qdSau = ganXacNhan(sauR.qd);
  const loiSau = loiKhuonVaTrich(sauR);
  if (loiSau.length) return ketThuc("dung_hoi_chu_shop", "bản xem lại sai khuôn / trích dẫn", qdSau, loiSau, kq.ghiChu);
  const px2 = phanXu({ truoc: qd, phanBien: kq.phanBien, sau: qdSau, boiCanh: bc });
  // Luôn kèm vi phạm CÒN LẠI của bản cuối — dừng mà không nói vì sao thì chủ shop không quyết được.
  return ketThuc(px2.ketQua, "lyDo" in px2 ? px2.lyDo : "qua vòng xem lại", qdSau, kiemQuyetDinh(qdSau, bc),
    [...("ghiChu" in px2 ? px2.ghiChu : []), ...kq.ghiChu]);
}

/** Khoá của một vi phạm = mã + các câu trích của phía cơ chế — xác nhận chỉ áp cho ĐÚNG những câu đã được hỏi. */
function khoaViPham(n: NguyenNhan, qd: QuyetDinh): string {
  const theoId = new Map(qd.khangDinh.map((k) => [k.id, k]));
  const trich = n.coChe.flatMap((id) => theoId.get(id)?.trichDan ?? []).map((t) => `${t.ma}:${chuanHoa(t.trich)}`).sort();
  return `${n.ma}|${trich.join("|")}`;
}

// --------------------------------------------------------------------------------------------- đề xuất cho chủ shop

const TEN_MUC: Record<"cao" | "vua" | "thap", string> = { cao: "chắc", vua: "khá chắc (số quan sát)", thap: "chưa đủ căn cứ" };

/** CODE viết đề xuất cho chủ shop từ dữ liệu có cấu trúc — AI không viết câu chữ cuối. */
export function hienDeXuat(k: KetQuaDieuHanh, so: SoBangChung): string {
  const kho = new Map(khoBangChung(so).map((b) => [b.ma, b]));
  const bc: BoiCanh = { bangChung: [...kho.values()], cheDo: "de_xuat", baoVe: so.baoVe, bayGio: so.luc };
  const theoId = new Map(k.qd.khangDinh.map((x) => [x.id, x]));
  const dongKd = (id: string) => {
    const x = theoId.get(id);
    if (!x) return `  · (${id} không có)`;
    const cau = x.trichDan.filter((t) => kiemTrich(t, kho).dung).map((t) => `[${t.ma}] «${nguCanhTrich(t, kho)?.cau ?? t.trich}»`);
    return `  · ${x.noiDung}${cau.length ? ` — ${cau.join("; ")}` : " — (không có trích dẫn đúng)"}`;
  };
  const phan = [
    `KẾT QUẢ: ${k.ketQua === "thuc_hien" ? "đề xuất sẵn sàng để duyệt" : k.ketQua === "dung_hoi_chu_shop" ? "cần chủ shop quyết" : k.ketQua === "dieu_hanh_quyet_ghi_so" ? "còn bất đồng ở việc rủi ro vừa — chạy như thử nghiệm có hoàn tác nếu duyệt" : k.ketQua} (${k.lyDo})`,
    `Kết luận (hệ thống tính): ${k.ketLuan === "da_ro" ? "đã đủ căn cứ" : "chưa đủ căn cứ"}`,
    ...k.qd.nguyenNhan.map((n, i) => [`Nguyên nhân ${i + 1}: ${MA_NGUYEN_NHAN[n.ma as keyof typeof MA_NGUYEN_NHAN] ?? n.ma} — ${TEN_MUC[k.mucChac[i]?.muc ?? "thap"]}`, ...[...n.coChe, ...n.hieuUng].map(dongKd)].join("\n")),
    ...k.qd.hanhDong.sort((a, b) => a.uuTien - b.uuTien).map((h) => `Việc ${h.uuTien}: ${MA_HANH_DONG[h.ma as keyof typeof MA_HANH_DONG] ?? h.ma} (${h.nhanVien}${h.soTien !== undefined ? `, ${h.soTien.toLocaleString("vi-VN")} ₫/ngày` : ""}) · rủi ro ${ruiRo(h.ma).muc} · ${({ hoi: "hỏi chủ shop", thu_du_lieu: "thu dữ liệu", hoan_tac: "hoàn tác", sua_loi: "sửa lỗi sai sự thật", toi_uu: "thử tối ưu" } as const)[mucDichTinh(h, k.qd, bc)]}`),
    ...(k.viPham.length ? [`Hệ thống chặn: ${k.viPham.map((v) => v.chiTiet).join("; ")}`] : []),
    ...(k.ghiChu.length ? [`Ghi chú kiểm chéo: ${k.ghiChu.join("; ")}`] : []),
    ...(so.khoangTrong.length ? [`Hệ thống CHƯA BIẾT: ${so.khoangTrong.join(" ")}`] : []),
  ];
  return phan.join("\n");
}

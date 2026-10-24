import { query } from "../db.js";

/**
 * Gom tài liệu chủ shop đã dạy cho một AI thành đoạn văn để nhét vào lời nhắc.
 *
 * Vì sao tách riêng: trước đây chỉ AI bán hàng và AI viết bài đọc tài liệu, mỗi
 * nơi tự viết một truy vấn. AI quảng cáo và AI thống kê thì nhận tài liệu rồi
 * KHÔNG BAO GIỜ đọc — chủ shop tải bảng giá lên đó và tưởng AI đã học.
 *
 * Cắt mỗi tài liệu ở 4.000 ký tự: lời nhắc quá dài vừa tốn tiền vừa làm AI
 * loãng trọng tâm, mà phần đầu tài liệu thường đã chứa thông tin chính.
 */
/**
 * TRẦN KÝ TỰ TÀI LIỆU mỗi lượt gọi AI (TD-09, H8 24/10/2026 — chủ dự án đồng ý "đọc hết tài liệu, có trần tổng"; phiên kiểm
 * duyệt: bán hàng giữ 40.000 = đúng mức cũ 10 × 4.000, không giảm). Bản cũ mỗi AI một luật: bán hàng 10 tài liệu × 4.000,
 * nội dung 5 × 3.000, quảng cáo 5 × 4.000 — tài liệu thứ 6 / thứ 11 hoặc phần sau ký tự 4.000 AI không thấy.
 * Giá thật (OpenRouter /models 24/10/2026): anthropic/claude-sonnet-5 0,000002 USD / token vào → 40.000 ký tự (≈ 13–16 nghìn
 * token tiếng Việt) ≈ 0,03 USD mỗi lượt, chỉ khi shop thật sự có chừng đó tài liệu.
 */
export const TRAN_KY_TU_TAI_LIEU: Record<string, number> = { sales: 40_000, content: 24_000, ads: 24_000 };

export interface TaiLieuChu {
  filename: string;
  extracted_text: string | null;
}

export interface KetQuaChonTaiLieu {
  /** Khối đưa vào lời dặn: các tài liệu + (nếu có) câu báo phần chưa đọc. Rỗng khi không có tài liệu có chữ. */
  noiDung: string;
  /** Riêng phần chữ AI đã được đọc — bộ xác nhận giá chỉ được tin phần này. */
  phanDaDoc: string;
  daDocKyTu: number;
  tongKyTu: number;
  tran: number;
  /** Tài liệu chỉ đưa được một phần (tên + số ký tự bỏ). */
  biCat: { ten: string; boKyTu: number }[];
  /** Tài liệu không đưa được chữ nào (hết ngân sách). */
  chuaDoc: string[];
}

export const CAU_CHUA_DOC_HET =
  "LƯU Ý: một phần tài liệu của shop chưa được đưa vào đây (quá dài). Thông tin khách hỏi mà không có trong phần trên thì nói sẽ kiểm tra lại với shop, KHÔNG đoán.";

/**
 * Hàm thuần: chọn tài liệu (mới nhất trước) cho vừa trần. Đưa NGUYÊN tài liệu khi còn chỗ; tài liệu chạm trần cắt ở RANH GIỚI
 * DÒNG (không cắt giữa dòng — cắt giữa "Áo A: 1.250.000" thành "Áo A: 1.2" là AI đọc sai giá); gặp dòng không vừa thì dừng ở
 * đó — riêng khi dòng ĐẦU đã quá dài thì cắt dòng đó ở khoảng trắng. Hết chỗ thì các tài liệu sau chỉ được liệt kê tên.
 */
export function chonTaiLieu(docs: TaiLieuChu[], tran: number): KetQuaChonTaiLieu {
  const coChu = docs.filter((d) => (d.extracted_text ?? "").trim() !== "");
  const tongKyTu = coChu.reduce((n, d) => n + (d.extracted_text ?? "").length, 0);
  const phan: string[] = [];
  const daDoc: string[] = [];
  const biCat: KetQuaChonTaiLieu["biCat"] = [];
  const chuaDoc: string[] = [];
  let con = tran;
  for (const d of coChu) {
    const chu = d.extracted_text ?? "";
    const dau = `# ${d.filename}\n`;
    if (con <= dau.length) {
      chuaDoc.push(d.filename);
      continue;
    }
    if (dau.length + chu.length <= con) {
      phan.push(dau + chu);
      daDoc.push(chu);
      con -= dau.length + chu.length + 2;
      continue;
    }
    // Cắt theo dòng cho vừa chỗ còn lại.
    const dong = chu.split("\n");
    const lay: string[] = [];
    let dai = dau.length;
    for (const x of dong) {
      if (dai + x.length + 1 > con) break;
      lay.push(x);
      dai += x.length + 1;
    }
    if (lay.length === 0) {
      // Dòng đầu đã dài hơn chỗ còn lại (PDF / docx trích ra thường không xuống dòng — cả tài liệu là MỘT dòng): cắt ở KHOẢNG
      // TRẮNG cuối cùng trước trần, không bao giờ giữa một từ / một con số (mất nửa sau thì mất trọn cặp "tên: giá", không
      // sinh giá cụt). Không có khoảng trắng nào thì bỏ (phiên kiểm duyệt 24/10/2026).
      const cho = con - dau.length - 1;
      const dau0 = dong[0] ?? "";
      const cuoi = dau0.slice(0, cho + 1).search(/\s\S*$/);
      if (cuoi <= 0) {
        chuaDoc.push(d.filename);
        continue;
      }
      lay.push(dau0.slice(0, cuoi).trimEnd());
    }
    const phanLay = lay.join("\n");
    const bo = chu.length - phanLay.length;
    phan.push(`${dau}${phanLay}\n(… tài liệu này còn ${bo.toLocaleString("vi-VN")} ký tự chưa đưa vào)`);
    daDoc.push(phanLay);
    biCat.push({ ten: d.filename, boKyTu: bo });
    con = 0;
  }
  const thieu = biCat.length > 0 || chuaDoc.length > 0;
  const noiDung = phan.length === 0 && !thieu
    ? ""
    : [
        ...phan,
        ...(chuaDoc.length ? [`(Chưa đưa vào vì quá dài: ${chuaDoc.join(", ")})`] : []),
        ...(thieu ? [CAU_CHUA_DOC_HET] : []),
      ].join("\n\n");
  return {
    noiDung,
    phanDaDoc: daDoc.join("\n"),
    daDocKyTu: daDoc.reduce((n, x) => n + x.length, 0),
    tongKyTu,
    tran,
    biCat,
    chuaDoc,
  };
}

/** Đọc mọi tài liệu có chữ của một AI ở một cửa hàng (mới nhất trước) rồi chọn cho vừa trần. */
export async function docTaiLieu(trangId: number | null, kind: string): Promise<KetQuaChonTaiLieu> {
  const tran = TRAN_KY_TU_TAI_LIEU[kind] ?? 24_000;
  if (!trangId) return chonTaiLieu([], tran);
  const docs = await query<TaiLieuChu>(
    `SELECT filename, extracted_text FROM ai_documents
      WHERE trang_id = $1 AND kind = $2 AND extracted_text IS NOT NULL
      ORDER BY created_at DESC`,
    [trangId, kind]
  );
  return chonTaiLieu(docs.rows, tran);
}

/**
 * Cửa hàng CÓ tài liệu (chữ thật) cho AI này không — MỘT chỗ quyết định cho mọi AI sinh chữ cho khách: rỗng → lời dặn đi
 * nhánh "chưa nạp tài liệu" (bán hàng: CHUA_CO_TAI_LIEU; viết bài: CHUA_CO_TAI_LIEU_BAI_VIET — H15, 24/10/2026).
 */
export function coTaiLieu(tl: { noiDung: string }): boolean {
  return tl.noiDung.trim() !== "";
}

export async function loadKnowledge(
  trangId: number | null,
  kind: string
): Promise<string> {
  /*
   * Tài liệu gắn theo TRANG, không theo tài khoản.
   *
   * Không biết Trang thì trả rỗng, KHÔNG lấy đại tài liệu nào — lấy nhầm
   * nghĩa là AI dùng kiến thức của shop khác để nói với khách.
   */
  const kq = await docTaiLieu(trangId, kind);
  if (!kq.noiDung) return "";
  return "\n\nTÀI LIỆU CỦA SHOP (chỉ dùng thông tin trong đây, không bịa thêm):\n" + kq.noiDung;
}

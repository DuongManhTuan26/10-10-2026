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
/** AI nhân viên chỉ thấy tối đa chừng này tài liệu mỗi loại (mới nhất trước) — sổ bằng chứng dùng chung để đánh dấu. */
export const SO_TAI_LIEU_TOI_DA = 5;
/** …và chừng này ký tự đầu của mỗi tài liệu. */
export const KY_TU_MOI_TAI_LIEU = 4_000;

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
  if (!trangId) return "";

  const docs = await query<{ filename: string; extracted_text: string | null }>(
    `SELECT filename, extracted_text FROM ai_documents
      WHERE trang_id = $1 AND kind = $2 AND extracted_text IS NOT NULL
      ORDER BY created_at DESC LIMIT ${SO_TAI_LIEU_TOI_DA}`,
    [trangId, kind]
  );

  if (docs.rows.length === 0) return "";

  return (
    "\n\nTÀI LIỆU CỦA SHOP (chỉ dùng thông tin trong đây, không bịa thêm):\n" +
    docs.rows
      .map((doc) => `# ${doc.filename}\n${(doc.extracted_text ?? "").slice(0, KY_TU_MOI_TAI_LIEU)}`)
      .join("\n\n")
  );
}

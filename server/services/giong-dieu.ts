/**
 * GIỌNG ĐIỆU — dùng chung cho ③ AI Bán hàng (màn Kịch bản) và ① AI Nội dung (thẻ Hướng dẫn AI — TD-24, 24/10/2026).
 * Một dòng "GIỌNG ĐIỆU: …" trong lời dặn; tone không hợp lệ / chưa chọn → không có dòng.
 */
export const MO_TA_GIONG: Record<string, string> = {
  friendly: "thân thiện, gần gũi.",
  professional: "chuyên nghiệp, lịch sự.",
  enthusiastic: "nhiệt tình, chủ động.",
  concise: "ngắn gọn, đi thẳng vào ý.",
};

export function moTaGiong(tone: unknown): string | null {
  return typeof tone === "string" && Object.hasOwn(MO_TA_GIONG, tone) ? `GIỌNG ĐIỆU: ${MO_TA_GIONG[tone]}` : null;
}

/**
 * Đọc tone từ thân yêu cầu lưu cấu hình: undefined = không đụng; "" = BỎ CHỌN (ghi NULL); một trong 4 id = ghi; khác → lỗi.
 */
export function docGiong(v: unknown): { doi: false } | { doi: true; giaTri: string | null } | { loi: string } {
  if (v === undefined || v === null) return { doi: false };
  if (v === "") return { doi: true, giaTri: null };
  if (typeof v === "string" && Object.hasOwn(MO_TA_GIONG, v)) return { doi: true, giaTri: v };
  return { loi: "Giọng điệu không hợp lệ" };
}

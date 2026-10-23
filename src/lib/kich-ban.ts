/**
 * Độ trễ trả lời công khai THẬT của một kịch bản — khớp máy chủ (server/services/comment-ai.ts): trả lời công khai không
 * bao giờ đi trước tin nhắn riêng, nên chạy sau max(công khai, tin riêng), mỗi số kẹp trong 0–86.400 giây. Thẻ kịch bản
 * và khung soạn dùng chung (mục 8, 22/10/2026 — thẻ cũ in số công khai trơn).
 */
export function giayTraLoiCongKhai(congKhai: number | null | undefined, tinRieng: number | null | undefined): number {
  const kep = (v: number | null | undefined) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 86_400) : 0;
  };
  return Math.max(kep(congKhai), kep(tinRieng));
}

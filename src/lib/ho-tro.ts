/**
 * Đường hỗ trợ của CHÍNH mình (không bao giờ là tài liệu của nhà cung cấp). Đặt VITE_SUPPORT_URL trong .env (trang trợ
 * giúp, Zalo, mailto:…). Chưa đặt thì null: chỗ dùng hiện "Sắp có" — KHÔNG dẫn vòng sang trang khác (B1-e, 18/10/2026:
 * bản cũ dẫn "Trợ giúp" về trang Gói dịch vụ, nút dẫn sai chỗ thì vẫn là sai).
 */
const tho = (import.meta.env.VITE_SUPPORT_URL ?? '').trim();
export const SUPPORT_URL: string | null = tho || null;
export const IS_EXTERNAL_SUPPORT = !!SUPPORT_URL && /^https?:|^mailto:/.test(SUPPORT_URL);

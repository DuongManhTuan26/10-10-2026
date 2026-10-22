/**
 * Móc nạp mô-đun cho scripts/chup-loi-dan.mts: thay server/db.ts và server/services/ai.ts bằng bản GIẢ (không database,
 * không gọi AI, không tốn tiền), để chạy ĐÚNG hàm decide của AI Bán hàng với dữ liệu cố định và chụp lời dặn nó dựng.
 *
 *   npx tsx --import ./scripts/loi-dan/moc-gia.mjs scripts/chup-loi-dan.mts
 */
import { register } from "node:module";

register("./moc-gia-hooks.mjs", import.meta.url);

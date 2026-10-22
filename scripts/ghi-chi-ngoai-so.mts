/**
 * Kịch bản NGOÀI app gọi AI bằng khoá của app (nghiên cứu, đo đạc…) PHẢI ghi tiền vào sổ "chi ngoài app" khi chạy xong —
 * không thì đối chiếu sổ với nhà cung cấp sẽ lệch và Telegram báo "khoá AI bị dùng ngoài app" (đã xảy ra: lệch
 * 8,0733096 USD vì bộ đề AI Điều hành 05–09/10). Bộ kiểm tra bắt mọi tệp scripts/ có "openrouter.ai" phải gọi hàm này.
 * Cách triệt để hơn: khoá OpenRouter RIÊNG cho nghiên cứu (chờ chủ dự án).
 */
import { pool } from "../server/db.js";
import { themChiNgoaiSo } from "../server/services/chi-phi.js";

export async function ghiChiNgoaiSo(p: { ma: string; usd: number; tu: Date; lyDo: string; canCu: string }): Promise<void> {
  try {
    await themChiNgoaiSo({ ma: p.ma, usd: p.usd, tu: p.tu.toISOString(), den: new Date().toISOString(), lyDo: p.lyDo, canCu: p.canCu });
    console.log(`Đã ghi ${p.usd.toFixed(6)} USD vào sổ chi ngoài app (${p.ma}).`);
  } catch (e) {
    // Không ghi được thì NÓI RÕ để ghi tay — không im lặng (im lặng là lệch sổ).
    console.error(`KHÔNG ghi được sổ chi ngoài app (${p.usd.toFixed(6)} USD, ${p.ma}) — vui lòng ghi tay:`, e);
  } finally {
    await pool.end().catch(() => {});
  }
}

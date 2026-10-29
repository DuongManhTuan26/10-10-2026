/**
 * Lời báo lỗi của nhà cung cấp AI → lời cho khách.
 *
 * Đã gặp 02/10/2026: khoá AI hết tiền giữa lúc tạo video, khách thấy nguyên văn
 * "Insufficient credits. Add more using https://openrouter.ai/settings/credits"
 * — lộ tên và đường dẫn nhà cung cấp, và bảo KHÁCH đi nạp tiền cho hệ thống.
 */

export const LOI_HET_TIEN_AI =
  "Hệ thống AI tạm hết hạn mức chi tiêu, quản trị viên cần nạp thêm. Phần đã tạo được giữ nguyên — thử lại sau.";

/*
 * Mẫu "hết tiền / hết ngân sách" — nguồn:
 *  - HTTP 402 (OpenRouter: "Payment Required" — hết tín dụng); câu "Insufficient credits. Add more using …" (gặp 02/10/2026).
 *  - "Workspace lifetime budget of $22.00 exceeded. Contact your org admin. $22.58 of $22.00 used; does not reset." — HTTP 403,
 *    đo thật 30/10/2026 (bản trước cũng gặp $11.00).
 *  - "spend limit" / "spending limit" (hạn mức khoá).
 * KHÔNG khớp 429 "Rate limit exceeded" (chậm tạm thời, không phải hết tiền) — phép kiểm giữ.
 */
export function laHetTienAi(status: number, message: string): boolean {
  return status === 402 || /insufficient (credits|funds|balance)|out of credits|add more (credits|using)|budget (of \S+ )?exceeded|spend(ing)? limit/i.test(message);
}

/*
 * H19: hàm báo "AI bị chặn" do MÁY CHỦ đăng ký lúc khởi động (server.ts → su-co-ai.ts). Bộ kiểm tra / kịch bản không đăng
 * ký → không ghi sự cố giả lên CSDL thật, không gửi Telegram.
 */
let baoHetTienAi: ((chiTiet: string) => void) | null = null;
export function datBaoHetTienAi(fn: ((chiTiet: string) => void) | null): void {
  baoHetTienAi = fn;
}

export function loiNhaCungCap(status: number, message: string | null | undefined): string {
  const m = (message ?? "").trim();
  if (laHetTienAi(status, m)) {
    // H19: ghi sự cố + báo quản trị (chạy nền, không đổi câu trả về).
    try {
      baoHetTienAi?.(`${status} ${m}`);
    } catch {
      /* báo hỏng không được làm hỏng câu lỗi */
    }
    return LOI_HET_TIEN_AI;
  }
  const sach = m
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bopen\s*router(\.ai)?\b/gi, "nhà cung cấp")
    .replace(/\s{2,}/g, " ")
    .trim();
  return sach || `mã lỗi ${status}`;
}

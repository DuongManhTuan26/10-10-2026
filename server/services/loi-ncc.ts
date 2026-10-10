/**
 * Lời báo lỗi của nhà cung cấp AI → lời cho khách.
 *
 * Đã gặp 02/10/2026: khoá AI hết tiền giữa lúc tạo video, khách thấy nguyên văn
 * "Insufficient credits. Add more using https://openrouter.ai/settings/credits"
 * — lộ tên và đường dẫn nhà cung cấp, và bảo KHÁCH đi nạp tiền cho hệ thống.
 */

export const LOI_HET_TIEN_AI =
  "Hệ thống AI tạm hết hạn mức chi tiêu, quản trị viên cần nạp thêm. Phần đã tạo được giữ nguyên — thử lại sau.";

export function laHetTienAi(status: number, message: string): boolean {
  // Đã gặp cả hai kiểu: "Insufficient credits…" và "Workspace lifetime budget of $11.00 exceeded. Contact your org admin."
  return status === 402 || /insufficient (credits|funds|balance)|out of credits|add more (credits|using)|budget (of \S+ )?exceeded|spend(ing)? limit/i.test(message);
}

export function loiNhaCungCap(status: number, message: string | null | undefined): string {
  const m = (message ?? "").trim();
  if (laHetTienAi(status, m)) return LOI_HET_TIEN_AI;
  const sach = m
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bopen\s*router(\.ai)?\b/gi, "nhà cung cấp")
    .replace(/\s{2,}/g, " ")
    .trim();
  return sach || `mã lỗi ${status}`;
}

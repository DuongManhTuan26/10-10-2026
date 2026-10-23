/**
 * Khoá của một tab có số đếm: "Chờ duyệt (3)" → "Chờ duyệt". Màn hình lưu KHOÁ làm tab đang chọn, không lưu nhãn —
 * lưu nhãn thì số đếm đổi là không tab nào khớp nữa (mất tô đậm; Hộp thư + Nội dung, sửa 23/10/2026).
 */
export function khoaTab(nhan: string): string {
  return nhan.replace(/\s*\(\d+\)$/, '');
}

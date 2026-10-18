/**
 * Mục f (19/10/2026): mở khoá tài khoản thì video dài đang tạo dở KHÔNG tự chạy tiếp — dừng ở trạng thái có nút
 * "Tạo tiếp" với đúng ghi chú này. Dùng chung máy chủ (ghi) và giao diện (nhận ra để hiện "Tạm dừng" màu cam, không
 * hiện "Lỗi" đỏ như lỗi thật).
 */
export const GHI_CHU_DUNG_DO_KHOA = 'Tạm dừng vì tài khoản bị khoá — bấm Tạo tiếp';

export function laDungDoKhoa(d: { trang_thai: string; loi: string | null }): boolean {
  return d.trang_thai === 'loi' && d.loi === GHI_CHU_DUNG_DO_KHOA;
}

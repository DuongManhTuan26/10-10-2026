/**
 * Nhãn nguồn của hội thoại theo conversations.origin (migration 042: lần chạm ĐẦU — quang_cao / lien_ket / binh_luan /
 * tu_nhan; 'message' là giá trị cũ trước 042). Bản cũ so với 'comment' — giá trị không còn ai ghi — nên mọi hội thoại
 * đều hiện "Khách nhắn trực tiếp" (mục 8, 22/10/2026).
 */
export function nhanNguon(origin: string | null | undefined): string {
  if (origin === 'binh_luan') return 'Từ bình luận bài đăng';
  if (origin === 'quang_cao') return 'Từ quảng cáo';
  if (origin === 'lien_ket') return 'Từ đường dẫn nhắn tin';
  return 'Khách nhắn trực tiếp';
}

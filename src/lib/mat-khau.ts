/**
 * MỘT luật mật khẩu cho mọi chỗ ĐẶT mật khẩu (quản trị tạo / cấp lại, tự đăng ký, tự đổi) — dùng chung giao diện và
 * máy chủ để hai bên không lệch nhau (chủ dự án 19/10/2026: mật khẩu quản trị BẮT BUỘC tự gõ, để trống không cho lưu).
 *
 * Không cắt dấu cách: lưu đúng chuỗi người dùng gõ. Dấu cách ở đầu / cuối thì TỪ CHỐI (không lặng lẽ cắt) — màn đăng
 * nhập cắt dấu cách ở mép, nên mật khẩu có dấu cách ở mép sẽ không bao giờ đăng nhập được.
 */
export const DO_DAI_TOI_THIEU = 8;
export const DO_DAI_TOI_DA = 200;

/** Lỗi của mật khẩu (câu hiện cho người dùng), hoặc null nếu dùng được. */
export function loiMatKhau(mk: unknown): string | null {
  if (typeof mk !== 'string' || mk === '') return `Vui lòng tự đặt mật khẩu (ít nhất ${DO_DAI_TOI_THIEU} ký tự).`;
  if (mk.trim() !== mk) return 'Mật khẩu không được bắt đầu hoặc kết thúc bằng dấu cách.';
  if (mk.length < DO_DAI_TOI_THIEU) return `Mật khẩu phải có ít nhất ${DO_DAI_TOI_THIEU} ký tự.`;
  if (mk.length > DO_DAI_TOI_DA) return `Mật khẩu dài quá ${DO_DAI_TOI_DA} ký tự.`;
  return null;
}

import { useState } from 'react';
import { api, ApiError, type User } from '../lib/api';

/**
 * Nút "Quay lại quản lý" khi quản trị tổng đã mở (đăng nhập thẳng vào) một tài khoản để hỗ trợ.
 *
 * Vì sao BẮT BUỘC phải có: mở tài khoản xong thì mọi màn hình trông y hệt như khi ở tài khoản của chính mình — cùng
 * hộp thư, cùng bảng điều khiển, cùng chỗ huấn luyện AI. Không có dấu hiệu này thì quản trị mở ra xem, quên mất, rồi
 * gõ vai trò AI hoặc trả lời khách trên tài khoản không phải của mình mà không hề biết.
 *
 * Chủ dự án 04/10/2026: không dải vàng, không chữ "đang xem" — chỉ nút "Quay lại quản lý" (màu chủ đạo, phát sáng) ở
 * góc phải THANH TIÊU ĐỀ (cố định, không đè nội dung). Nút "sang cửa hàng khác" thuộc tầng chủ chuỗi đã bỏ (18/10/2026).
 */
export default function DangXemThay({ user, onQuayLai }: {
  user: User | null;
  onQuayLai: () => void;
}) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');

  if (!user?.nguoiMo) return null;

  const quayLai = async () => {
    setBan(true);
    try {
      await api.quanLy.quayLai();
      onQuayLai();
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không quay lại được');
      setBan(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={quayLai}
        disabled={ban}
        className="flex items-center gap-1 rounded-full bg-primary text-on-primary text-xs font-bold pl-2.5 pr-3 py-2 shadow-[0_0_18px_var(--color-primary)] hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span className="hidden sm:inline">Quay lại quản lý</span>
        <span className="sm:hidden">Quay lại</span>
      </button>
      {loi && (
        <div className="absolute right-0 mt-2 w-72 max-w-[90vw] bg-noi border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
          <p className="px-4 py-2 text-xs text-error">{loi}</p>
        </div>
      )}
    </div>
  );
}

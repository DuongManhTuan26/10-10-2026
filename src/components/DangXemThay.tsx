import { useState } from 'react';
import { api, ApiError, type User } from '../lib/api';

/**
 * Dải băng cảnh báo khi chủ chuỗi đang xem thay một trang.
 *
 * Vì sao BẮT BUỘC phải có: mở trang xong thì mọi màn hình trông y hệt như khi
 * ở tài khoản của chính mình — cùng hộp thư, cùng bảng điều khiển, cùng chỗ
 * huấn luyện AI. Không có dải băng này thì chủ chuỗi mở một trang ra xem, quên
 * mất, rồi gõ vai trò AI hoặc trả lời khách trên tài khoản không phải của
 * mình mà không hề biết. Sai kiểu đó không có thông báo lỗi nào cả.
 *
 * Nằm trên cùng, màu cảnh báo, và luôn kèm đường quay ra.
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
    <div className="sticky top-0 z-50 bg-amber-500 text-black px-4 py-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="material-symbols-outlined text-[18px]">visibility</span>
        <span>
          Bạn đang xem thay trang <strong>{user.name}</strong>. Mọi thao tác ở đây ghi vào
          tài khoản của trang này, không phải tài khoản quản lý của bạn.
        </span>
      </div>
      <div className="flex items-center gap-3">
        {loi && <span className="text-sm">{loi}</span>}
        <button
          onClick={quayLai}
          disabled={ban}
          className="px-3 py-1.5 rounded-lg bg-black/85 text-white text-sm font-bold disabled:opacity-50"
        >
          Quay lại quản lý
        </button>
      </div>
    </div>
  );
}

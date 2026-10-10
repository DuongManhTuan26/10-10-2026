import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type TrangCon, type User } from '../lib/api';

/**
 * Nút "Quay lại quản lý" khi chủ chuỗi đã mở (đăng nhập thẳng vào) một trang con.
 *
 * Vì sao BẮT BUỘC phải có: mở trang xong thì mọi màn hình trông y hệt như khi
 * ở tài khoản của chính mình — cùng hộp thư, cùng bảng điều khiển, cùng chỗ
 * huấn luyện AI. Không có dấu hiệu này thì chủ chuỗi mở một trang ra xem, quên
 * mất, rồi gõ vai trò AI hoặc trả lời khách trên tài khoản không phải của
 * mình mà không hề biết. Sai kiểu đó không có thông báo lỗi nào cả.
 *
 * Đây cũng là chỗ NỐI hai phần lại với nhau: danh sách trang nằm ngay đây,
 * nhảy thẳng từ trang này sang trang kia, không phải quay ra rồi mở lại.
 *
 * Chủ dự án 04/10/2026: bỏ dải vàng chạy ngang đầu trang; rồi bỏ hẳn chữ / màu "đang xem" — mở trang là ĐĂNG NHẬP
 * THẲNG vào trang con, dùng đủ chức năng như tự đăng nhập, không phải chế độ xem. Chỉ còn nút "Quay lại quản lý"
 * (màu chủ đạo, phát sáng) và nút sang trang khác, ở góc phải THANH TIÊU ĐỀ (cố định, không đè nội dung).
 */
export default function DangXemThay({ user, onQuayLai }: {
  user: User | null;
  onQuayLai: () => void;
}) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const [ds, setDs] = useState<TrangCon[]>([]);
  const [moDanhSach, setMoDanhSach] = useState(false);

  const dangXemThay = !!user?.nguoiMo;

  /*
   * Chỉ nạp khi đang xem thay. Tài khoản trang tự đăng nhập bằng mật khẩu của
   * nó không có quyền này, gọi vào chỉ tổ nhận 403.
   */
  const nap = useCallback(async () => {
    if (!dangXemThay) return;
    try {
      const { data } = await api.quanLy.trang();
      setDs(data);
    } catch {
      /* Không lấy được danh sách thì vẫn phải còn nút quay ra. */
    }
  }, [dangXemThay]);

  useEffect(() => { nap(); }, [nap]);

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

  const sangTrang = async (trang: TrangCon) => {
    setBan(true);
    try {
      await api.quanLy.moTrang(trang.id);
      // Nạp lại cả ứng dụng: mọi màn hình đang giữ dữ liệu của trang cũ.
      window.location.href = '/';
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không mở được trang');
      setBan(false);
    }
  };

  const trangKhac = ds.filter((t) => t.id !== user.id && t.is_active);

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-1.5">
        {trangKhac.length > 0 && (
          <button
            type="button"
            onClick={() => setMoDanhSach((m) => !m)}
            disabled={ban}
            title={`Sang trang khác (${trangKhac.length})`}
            aria-label={`Sang trang khác (${trangKhac.length})`}
            aria-expanded={moDanhSach}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
          </button>
        )}
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
      </div>

      {(moDanhSach || loi) && (
        <>
          {/* Bấm ra ngoài thì đóng danh sách. */}
          {moDanhSach && <div className="fixed inset-0 z-40" onClick={() => setMoDanhSach(false)} />}
          <div className="absolute right-0 mt-2 w-72 max-w-[90vw] bg-noi border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
            {loi && <p className="px-4 py-2 text-xs text-error">{loi}</p>}
            {moDanhSach && trangKhac.length > 0 && (
              <div className="py-1">
                <p className="px-4 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-primary">Sang trang khác ({trangKhac.length})</p>
                {trangKhac.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => sangTrang(t)}
                    disabled={ban}
                    className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
                  >
                    {t.name}
                    {t.cho_nguoi > 0 && <span className="ml-1.5 font-bold text-orange-400">· {t.cho_nguoi} khách chờ</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

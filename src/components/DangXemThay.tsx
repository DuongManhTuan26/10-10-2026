import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type TrangCon, type User } from '../lib/api';

/**
 * Dải băng khi chủ chuỗi đang xem thay một trang.
 *
 * Vì sao BẮT BUỘC phải có: mở trang xong thì mọi màn hình trông y hệt như khi
 * ở tài khoản của chính mình — cùng hộp thư, cùng bảng điều khiển, cùng chỗ
 * huấn luyện AI. Không có dải băng này thì chủ chuỗi mở một trang ra xem, quên
 * mất, rồi gõ vai trò AI hoặc trả lời khách trên tài khoản không phải của
 * mình mà không hề biết. Sai kiểu đó không có thông báo lỗi nào cả.
 *
 * Dải băng cũng là chỗ NỐI hai phần lại với nhau. Bản đầu chỉ có nút quay ra,
 * nên vào trong một trang là mất hẳn đường sang trang khác: muốn đi một vòng
 * mười trang phải quay ra rồi mở lại chín lần, qua một màn hình trung gian mỗi
 * lần. Nay danh sách trang nằm ngay đây, nhảy thẳng từ trang này sang trang kia.
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
    <div className="sticky top-0 z-50 bg-amber-500 text-black px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          <span>
            Bạn đang xem thay trang <strong>{user.name}</strong>. Mọi thao tác ở đây ghi vào
            tài khoản của trang này, không phải tài khoản quản lý của bạn.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loi && <span className="text-sm">{loi}</span>}
          {trangKhac.length > 0 && (
            <button
              onClick={() => setMoDanhSach((m) => !m)}
              disabled={ban}
              className="px-3 py-1.5 rounded-lg bg-black/15 text-black text-sm font-bold hover:bg-black/25 transition-colors disabled:opacity-50"
            >
              Sang trang khác ({trangKhac.length})
            </button>
          )}
          <button
            onClick={quayLai}
            disabled={ban}
            className="px-3 py-1.5 rounded-lg bg-black/85 text-white text-sm font-bold disabled:opacity-50"
          >
            Quay lại quản lý
          </button>
        </div>
      </div>

      {moDanhSach && trangKhac.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-black/20 pt-2">
          {trangKhac.map((t) => (
            <button
              key={t.id}
              onClick={() => sangTrang(t)}
              disabled={ban}
              className="px-3 py-1.5 rounded-lg bg-black/10 text-black text-sm font-medium hover:bg-black/25 transition-colors disabled:opacity-50"
            >
              {t.name}
              {t.cho_nguoi > 0 && (
                <span className="ml-1.5 font-bold">· {t.cho_nguoi} khách chờ</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

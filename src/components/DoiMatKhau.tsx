import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import HopThoai, { NHAN_O, NUT_CHINH, NUT_PHU, O_NHAP } from './HopThoai';
import { loiMatKhau } from '../lib/mat-khau';

/**
 * Hộp đổi mật khẩu.
 *
 * Bắt nhập lại mật khẩu hiện tại — không có bước đó thì bất kỳ ai ngồi vào máy
 * đang mở sẵn đều chiếm được tài khoản.
 */
export default function DoiMatKhau({ onClose }: { onClose: () => void }) {
  const [hienTai, setHienTai] = useState('');
  const [moi, setMoi] = useState('');
  const [nhapLai, setNhapLai] = useState('');
  const [loi, setLoi] = useState('');
  const [xong, setXong] = useState('');
  const [dangLuu, setDangLuu] = useState(false);

  const luu = async () => {
    setLoi('');
    const loiMoi = loiMatKhau(moi);
    if (loiMoi) { setLoi(loiMoi); return; }
    if (moi !== nhapLai) { setLoi('Hai ô mật khẩu mới không khớp nhau.'); return; }

    setDangLuu(true);
    try {
      const r = await api.auth.changePassword(hienTai, moi);
      setXong(r.message);
      setHienTai(''); setMoi(''); setNhapLai('');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không đổi được mật khẩu');
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <HopThoai
      co="vua"
      bieuTuong="lock_reset"
      tieuDe="Đổi mật khẩu"
      phuDe="Đổi xong, mọi thiết bị khác đang đăng nhập sẽ bị đăng xuất."
      onDong={onClose}
      dongKhiBamNgoai={false}
      chan={
        <>
          <button type="button" onClick={onClose} className={NUT_PHU}>
            {xong ? 'Đóng' : 'Huỷ'}
          </button>
          {!xong && (
            <button type="button" onClick={luu} disabled={dangLuu} className={NUT_CHINH}>
              {dangLuu ? 'Đang đổi…' : 'Đổi mật khẩu'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {loi && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3">{loi}</div>}
        {xong ? (
          <div className="text-base text-green-300 bg-green-500/10 border border-green-500/40 rounded-xl px-4 py-3">{xong}</div>
        ) : (
          <>
            <label className="block">
              <span className={NHAN_O}>Mật khẩu hiện tại</span>
              <input type="password" value={hienTai} onChange={(e) => setHienTai(e.target.value)} className={O_NHAP} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={NHAN_O}>Mật khẩu mới</span>
                <input type="password" value={moi} onChange={(e) => setMoi(e.target.value)} className={O_NHAP} placeholder="Ít nhất 8 ký tự" />
              </label>
              <label className="block">
                <span className={NHAN_O}>Nhập lại mật khẩu mới</span>
                <input type="password" value={nhapLai} onChange={(e) => setNhapLai(e.target.value)} className={O_NHAP} />
              </label>
            </div>
          </>
        )}
      </div>
    </HopThoai>
  );
}

import { useState } from 'react';
import { api, ApiError } from '../lib/api';

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
    if (moi.length < 8) { setLoi('Mật khẩu mới phải có ít nhất 8 ký tự.'); return; }
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

  const oNhap = "w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-surface-container-high border border-primary/30 rounded-2xl shadow-[0_0_40px_rgba(0,229,255,0.1)] overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface">Đổi mật khẩu</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loi && (
            <div className="text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3">{loi}</div>
          )}
          {xong ? (
            <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/30 rounded-xl px-4 py-3">
              {xong}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Mật khẩu hiện tại</label>
                <input type="password" value={hienTai} onChange={(e) => setHienTai(e.target.value)} className={oNhap} />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Mật khẩu mới</label>
                <input type="password" value={moi} onChange={(e) => setMoi(e.target.value)} className={oNhap} placeholder="Ít nhất 8 ký tự" />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Nhập lại mật khẩu mới</label>
                <input type="password" value={nhapLai} onChange={(e) => setNhapLai(e.target.value)} className={oNhap} />
              </div>
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                Đổi xong, mọi thiết bị khác đang đăng nhập sẽ bị đăng xuất.
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-bold text-on-surface hover:bg-surface-variant transition-colors">
            {xong ? 'Đóng' : 'Hủy'}
          </button>
          {!xong && (
            <button onClick={luu} disabled={dangLuu} className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60">
              {dangLuu ? 'Đang đổi…' : 'Đổi mật khẩu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

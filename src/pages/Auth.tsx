import React, { useState } from 'react';
import { api, ApiError, type User } from '../lib/api';
import { loiMatKhau } from '../lib/mat-khau';

export default function Auth({ onLogin, onRegister }: {
  onLogin: (user: User) => void,
  onRegister: (user: User) => void,
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /*
   * Bước 2 khi chạy thật: mật khẩu đúng rồi, mã 6 số đã gửi vào email. Giữ
   * email + mật khẩu trong bộ nhớ để "Gửi lại mã" không bắt gõ lại.
   */
  const [buocMa, setBuocMa] = useState<{
    ve: string;
    guiToi: string;
    laDangKy: boolean;
    email: string;
    password: string;
  } | null>(null);
  const [ma, setMa] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const name = String(formData.get('name') ?? '').trim();

    setError('');
    setBusy(true);

    try {
      if (mode === 'login') {
        const kq = await api.auth.login(email, password);
        if (kq.canMa && kq.ve) {
          setBuocMa({ ve: kq.ve, guiToi: kq.guiToi ?? 'email của bạn', laDangKy: false, email, password });
          setMa('');
          return;
        }
        onLogin(kq.user!);
      } else {
        const confirm = String(formData.get('confirmPassword') ?? '');
        if (confirm && confirm !== password) {
          setError('Mật khẩu nhập lại không khớp');
          return;
        }
        // Cùng một luật với mọi chỗ đặt mật khẩu (src/lib/mat-khau.ts) — máy chủ kiểm lại y hệt.
        const loiMk = loiMatKhau(password);
        if (loiMk) {
          setError(loiMk);
          return;
        }
        const kq = await api.auth.register(email, password, name);
        if (kq.canMa && kq.ve) {
          setBuocMa({ ve: kq.ve, guiToi: kq.guiToi ?? 'email của bạn', laDangKy: true, email, password });
          setMa('');
          return;
        }
        onRegister(kq.user!);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Không kết nối được máy chủ. Kiểm tra lại đường truyền.'
      );
    } finally {
      setBusy(false);
    }
  }

  const xacNhanMa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buocMa || busy) return;
    setError('');
    setBusy(true);
    try {
      const { user } = await api.auth.xacThuc(buocMa.ve, ma);
      if (buocMa.laDangKy) onRegister(user);
      else onLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  const guiLaiMa = async () => {
    if (!buocMa || busy) return;
    setError('');
    setBusy(true);
    try {
      // Gửi lại = đăng nhập lại bằng đúng email và mật khẩu vừa gõ → vé mới, mã mới.
      const kq = await api.auth.login(buocMa.email, buocMa.password);
      if (kq.canMa && kq.ve) {
        setBuocMa({ ...buocMa, ve: kq.ve, guiToi: kq.guiToi ?? buocMa.guiToi });
        setMa('');
        setError('Đã gửi mã mới. Kiểm tra cả mục Thư rác nếu chưa thấy.');
      } else if (kq.user) {
        onLogin(kq.user);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background nen-app relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Logo Placeholder */}
      <div className="w-16 h-16 border border-outline-variant rounded-xl flex items-center justify-center mb-8 bg-surface-container relative z-10">
        <span className="font-label-sm text-on-surface-variant uppercase tracking-widest text-[10px]">Logo</span>
      </div>

      {/* Card */}
      <div className="glass-card ai-border rounded-xl w-full max-w-[440px] shadow-[0_0_30px_rgba(0,229,255,0.05)] relative z-10 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-outline-variant">
          <button 
            type="button"
            className={`flex-1 py-4 font-label-sm font-bold transition-colors ${mode === 'login' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Đăng nhập
          </button>
          <button 
            type="button"
            className={`flex-1 py-4 font-label-sm font-bold transition-colors ${mode === 'register' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Đăng ký
          </button>
        </div>

        {buocMa ? (
          <form onSubmit={xacNhanMa} className="p-md flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-on-surface">Mã xác thực</label>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                Mã 6 số đã gửi tới <span className="text-primary font-bold">{buocMa.guiToi}</span>. Mã có hiệu lực 10
                phút. Không thấy thì kiểm tra cả mục Thư rác.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={ma}
                onChange={(e) => setMa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="bg-surface-container-high w-full border border-outline-variant focus:border-primary rounded-lg px-4 py-3 text-on-surface outline-none transition-colors text-center text-2xl tracking-[0.5em] font-bold"
                placeholder="••••••"
              />
            </div>
            {error && (
              <p className="text-error font-body-md text-sm bg-error/10 border border-error/30 rounded-lg px-4 py-3">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy || ma.length !== 6}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-sm rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:brightness-110 transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setBuocMa(null); setError(''); }} className="text-on-surface-variant hover:text-on-surface">
                ← Quay lại
              </button>
              <button type="button" onClick={guiLaiMa} disabled={busy} className="text-primary hover:underline font-bold disabled:opacity-50">
                Gửi lại mã
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="p-md flex flex-col gap-4">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-on-surface">Tên shop</label>
              <input
                type="text"
                name="name"
                required
                className="bg-surface-container-high w-full border border-outline-variant focus:border-primary rounded-lg px-4 py-3 text-on-surface outline-none transition-colors"
                placeholder="Ví dụ: Thời Trang Minh Anh"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-on-surface">Email</label>
            <input 
              type="email" 
              name="email" 
              required 
              className="bg-surface-container-high w-full border border-outline-variant focus:border-primary rounded-lg px-4 py-3 text-on-surface outline-none transition-colors" 
              placeholder="name@example.com" 
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-on-surface">Mật khẩu</label>
              {/*
                Chưa có đặt lại mật khẩu tự động vì hệ thống chưa nối dịch vụ
                gửi email. Nói thẳng và chỉ đường liên hệ, còn hơn một link bấm
                vào không có gì xảy ra như trước.
              */}
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setError(
                    'Hiện chưa tự đặt lại mật khẩu được. Vui lòng liên hệ bộ phận hỗ trợ để được cấp lại, ' +
                    'sau khi đăng nhập bạn đổi mật khẩu trong menu tài khoản (góc trên bên phải).'
                  )}
                  className="font-body-md text-primary text-sm hover:underline"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <input 
              type="password" 
              name="password"
              required 
              className={`w-full bg-surface-container-high border ${error ? 'border-error' : 'border-outline focus:border-primary'} rounded-lg px-4 py-3 text-on-surface outline-none transition-colors`} 
              placeholder="••••••••" 
            />
            {mode === 'register' && (
              <p className="font-body-md text-xs text-on-surface-variant mt-1">
                Tối thiểu 8 ký tự.
              </p>
            )}
          </div>

          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-on-surface">Nhập lại mật khẩu</label>
              <input
                type="password"
                name="confirmPassword"
                required
                className="bg-surface-container-high w-full border border-outline-variant focus:border-primary rounded-lg px-4 py-3 text-on-surface outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-error font-body-md text-sm bg-error/10 border border-error/30 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-sm rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:shadow-[0_0_25px_rgba(0,229,255,0.6)] hover:brightness-110 transition-all font-bold mt-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {busy
              ? (mode === 'login' ? 'Đang đăng nhập…' : 'Đang tạo tài khoản…')
              : (mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản')}
          </button>

          {mode === 'register' && (
            <p className="text-center font-body-md text-sm text-on-surface-variant mt-2">
              Đã có tài khoản? <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-primary hover:underline font-bold">Đăng nhập</button>
            </p>
          )}
        </form>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type TrangCon } from '../lib/api';

/**
 * Bảng tổng quan chuỗi trang, dành cho chủ chuỗi (tài khoản 'admin_con').
 *
 * Mô hình: mỗi trang là một TÀI KHOẢN RIÊNG, độc lập hoàn toàn — hộp thư
 * riêng, đơn hàng riêng, bộ não AI riêng. Màn hình này không đọc dữ liệu bên
 * trong trang nào; nó chỉ đếm và mở đường bước vào.
 *
 * Muốn làm việc trong một trang thì bấm "Mở trang": hệ thống chuyển hẳn phiên
 * sang tài khoản đó. Nhờ vậy chủ chuỗi mười trang chỉ đăng nhập MỘT lần mà dữ
 * liệu mười trang vẫn không dính gì nhau.
 */

const tienVN = (so: string | number): string =>
  `${Number(so || 0).toLocaleString('vi-VN')} đ`;

export default function QuanLyTrang() {
  const [ds, setDs] = useState<TrangCon[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');
  const [ban, setBan] = useState(false);

  const [tenMoi, setTenMoi] = useState('');
  /*
   * Mật khẩu tạm chỉ hiện ĐÚNG MỘT LẦN ngay sau khi lập trang. Hệ thống chỉ
   * giữ bản băm nên không đọc lại được — phải nói rõ điều đó ngay trên màn
   * hình, không thì chủ chuỗi đóng đi rồi mới biết là mất.
   */
  const [vuaLap, setVuaLap] = useState<
    { name: string; tenDangNhap: string; matKhauTam: string } | null
  >(null);

  const nap = useCallback(async () => {
    setDangTai(true);
    try {
      const { data } = await api.quanLy.trang();
      setDs(data);
      setLoi('');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được danh sách trang');
    } finally {
      setDangTai(false);
    }
  }, []);

  useEffect(() => { nap(); }, [nap]);

  const lapTrang = async () => {
    const ten = tenMoi.trim();
    if (ten.length < 2) { setLoi('Vui lòng đặt tên cho trang, ít nhất 2 ký tự'); return; }
    setBan(true);
    try {
      const { data } = await api.quanLy.lapTrang(ten);
      setVuaLap(data);
      setTenMoi('');
      setLoi('');
      await nap();
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không lập được trang');
    } finally {
      setBan(false);
    }
  };

  const moTrang = async (trang: TrangCon) => {
    setBan(true);
    try {
      await api.quanLy.moTrang(trang.id);
      // Nạp lại cả ứng dụng: mọi màn hình đang giữ dữ liệu của tài khoản cũ.
      window.location.href = '/';
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không mở được trang');
      setBan(false);
    }
  };

  const doiKhoa = async (trang: TrangCon) => {
    setBan(true);
    try {
      await api.quanLy.khoa(trang.id, trang.is_active);
      await nap();
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không đổi được trạng thái');
    } finally {
      setBan(false);
    }
  };

  const capLaiMatKhau = async (trang: TrangCon) => {
    setBan(true);
    try {
      const { data } = await api.quanLy.capLaiMatKhau(trang.id);
      setVuaLap({ name: trang.name, tenDangNhap: trang.email, matKhauTam: data.matKhauTam });
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không cấp lại được mật khẩu');
    } finally {
      setBan(false);
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full bg-background">
      <div className="mb-6">
        <h1 className="font-headline-sm text-2xl font-bold text-on-surface">Quản lý trang</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Mỗi trang là một tài khoản riêng, hoàn toàn độc lập: hộp thư riêng, đơn hàng riêng,
          AI được huấn luyện riêng. Bấm Mở trang để vào làm việc bên trong.
        </p>
      </div>

      {loi && (
        <div className="mb-6 text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3">
          {loi}
        </div>
      )}

      {vuaLap && (
        <div className="mb-6 rounded-xl border border-primary/40 bg-primary/10 px-4 py-4">
          <div className="font-bold text-on-surface mb-2">
            Mật khẩu của trang {vuaLap.name}
          </div>
          <div className="text-sm text-on-surface-variant mb-3">
            Chỉ hiện đúng một lần này. Vui lòng chép lại và cất giữ — hệ thống không đọc lại được,
            mất thì phải cấp mật khẩu mới.
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex gap-2 items-center">
              <span className="text-on-surface-variant w-32 shrink-0">Tên đăng nhập</span>
              <code className="bg-surface px-2 py-1 rounded border border-outline-variant select-all">
                {vuaLap.tenDangNhap}
              </code>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-on-surface-variant w-32 shrink-0">Mật khẩu</span>
              <code className="bg-surface px-2 py-1 rounded border border-outline-variant select-all">
                {vuaLap.matKhauTam}
              </code>
            </div>
          </div>
          <button
            onClick={() => setVuaLap(null)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Tôi đã chép lại
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <input
          value={tenMoi}
          onChange={(e) => setTenMoi(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lapTrang(); }}
          placeholder="Tên trang mới, ví dụ: Bột sắn dây quê"
          className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
        />
        <button
          onClick={lapTrang}
          disabled={ban}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50"
        >
          Lập trang mới
        </button>
      </div>

      {dangTai ? (
        <div className="text-sm text-on-surface-variant">Đang tải danh sách trang…</div>
      ) : ds.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface px-6 py-10 text-center">
          <div className="font-bold text-on-surface mb-1">Chưa có trang nào</div>
          <div className="text-sm text-on-surface-variant">
            Đặt tên trang đầu tiên ở ô bên trên. Mỗi trang lập ra sẽ có tên đăng nhập và mật
            khẩu riêng.
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {ds.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'rounded-xl border bg-surface px-4 py-4',
                t.is_active ? 'border-outline-variant' : 'border-error/40 bg-error/5'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px]">
                  <div className="font-bold text-on-surface flex items-center gap-2">
                    {t.name}
                    {!t.is_active && (
                      <span className="text-xs font-medium text-error bg-error/10 px-2 py-0.5 rounded">
                        Đang khoá
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    {t.ten_fanpage
                      ? `Fanpage: ${t.ten_fanpage}`
                      : 'Chưa nối Fanpage nào'}
                    {t.kenh_can_noi_lai > 0 && (
                      <span className="text-error"> · {t.kenh_can_noi_lai} kênh cần nối lại</span>
                    )}
                  </div>
                  <div className="text-xs text-on-surface-variant/70 mt-1 select-all">
                    {t.email}
                  </div>
                </div>

                <div className="flex flex-wrap gap-5 text-sm">
                  <div>
                    <div className="text-xs text-on-surface-variant">Đơn hôm nay</div>
                    <div className="font-bold text-on-surface">{t.don_hom_nay}</div>
                  </div>
                  <div>
                    <div className="text-xs text-on-surface-variant">Doanh thu tháng</div>
                    <div className="font-bold text-on-surface">{tienVN(t.doanh_thu_thang)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-on-surface-variant">Khách chờ người</div>
                    <div className={clsx('font-bold', t.cho_nguoi > 0 ? 'text-amber-500' : 'text-on-surface')}>
                      {t.cho_nguoi}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => moTrang(t)}
                    disabled={ban || !t.is_active}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold text-sm disabled:opacity-40"
                  >
                    Mở trang
                  </button>
                  <button
                    onClick={() => capLaiMatKhau(t)}
                    disabled={ban}
                    className="px-3 py-2 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface disabled:opacity-40"
                  >
                    Cấp lại mật khẩu
                  </button>
                  <button
                    onClick={() => doiKhoa(t)}
                    disabled={ban}
                    className="px-3 py-2 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface disabled:opacity-40"
                  >
                    {t.is_active ? 'Khoá' : 'Mở khoá'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

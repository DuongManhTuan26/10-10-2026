/**
 * Trang quản trị: quản lý mọi tài khoản shop.
 *
 * Trang này chỉ hiện với tài khoản quản trị, nhưng đó CHỈ là lớp che mắt —
 * mọi lời gọi đều bị máy chủ kiểm lại vai trò từ database. Giấu trên giao diện
 * không bao giờ là bảo vệ.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type TaiKhoanQuanTri, type NhatKyQuanTri } from '../lib/api';
import BangLoi from '../components/BangLoi';
import ChiPhiHeThong from '../components/ChiPhiHeThong';
import DoiMatKhau from '../components/DoiMatKhau';
import HopThoai, { NHAN_O, NUT_CHINH, NUT_PHU, O_NHAP } from '../components/HopThoai';

const TEN_VIEC: Record<string, string> = {
  tao_tai_khoan: 'Tạo tài khoản',
  sua_tai_khoan: 'Sửa tài khoản',
  khoa_tai_khoan: 'Khoá tài khoản',
  mo_khoa_tai_khoan: 'Mở khoá tài khoản',
  cap_lai_mat_khau: 'Cấp lại mật khẩu',
  xoa_tai_khoan: 'Xoá tài khoản',
};

function gioVN(luc: string | null): string {
  if (!luc) return '—';
  return new Date(luc).toLocaleString('vi-VN');
}

export default function Admin() {
  const [danhSach, setDanhSach] = useState<TaiKhoanQuanTri[]>([]);
  const [nhatKy, setNhatKy] = useState<NhatKyQuanTri[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [dangLam, setDangLam] = useState<number | null>(null);

  const [moTao, setMoTao] = useState(false);
  const [emailMoi, setEmailMoi] = useState('');
  const [tenMoi, setTenMoi] = useState('');
  /*
   * Vai trò của tài khoản sắp tạo.
   *
   * Mặc định là CHỦ CHUỖI, giống hệt đường tự đăng ký. Trước đây màn hình này
   * không có chỗ chọn nên luôn tạo ra 'shop' — một tài khoản đứng riêng, kẹt
   * ở đúng một Fanpage, không lập thêm trang được. Đã xảy ra thật với một tài
   * khoản của chủ sản phẩm, và không ai nhìn màn hình mà đoán ra được vì sao.
   */
  const [vaiTroMoi, setVaiTroMoi] = useState<'admin_con' | 'shop'>('admin_con');
  const [dangTao, setDangTao] = useState(false);
  /* Mật khẩu tạm chỉ hiện ĐÚNG MỘT LẦN, không lưu lại ở đâu cả. */
  const [matKhauTam, setMatKhauTam] = useState<{ email: string; mk: string } | null>(null);
  /** Đổi mật khẩu của CHÍNH MÌNH: nhập mật khẩu hiện tại, giữ phiên đang dùng. */
  const [doiMatKhauMo, setDoiMatKhauMo] = useState(false);

  const [dangSua, setDangSua] = useState<TaiKhoanQuanTri | null>(null);
  const [suaTen, setSuaTen] = useState('');
  const [suaEmail, setSuaEmail] = useState('');

  const nap = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.admin.accounts(), api.admin.audit()]);
      setDanhSach(a.data);
      setNhatKy(b.data);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không tải được danh sách tài khoản');
    }
  }, []);

  useEffect(() => { nap(); }, [nap]);

  const taoTaiKhoan = async () => {
    if (dangTao) return;
    setErrorMessage('');
    setDangTao(true);
    try {
      const { data } = await api.admin.create({
        email: emailMoi.trim(),
        name: tenMoi.trim(),
        role: vaiTroMoi,
      });
      setMatKhauTam({ email: data.email, mk: data.matKhauTam });
      setMoTao(false);
      setEmailMoi('');
      setTenMoi('');
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không tạo được tài khoản');
    } finally {
      setDangTao(false);
    }
  };

  const doiKhoa = async (tk: TaiKhoanQuanTri) => {
    const khoa = tk.is_active;
    if (khoa && !confirm(
      `Khoá tài khoản ${tk.email}?\n\n` +
      'Họ sẽ bị đẩy ra khỏi ứng dụng ngay lập tức và không đăng nhập lại được. ' +
      'Dữ liệu vẫn giữ nguyên, mở khoá lúc nào cũng được.'
    )) return;
    setDangLam(tk.id);
    setErrorMessage('');
    try {
      await api.admin.setLocked(tk.id, khoa);
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không đổi được trạng thái khoá');
    } finally {
      setDangLam(null);
    }
  };

  const capLaiMatKhau = async (tk: TaiKhoanQuanTri) => {
    if (!confirm(
      `Cấp lại mật khẩu cho ${tk.email}?\n\n` +
      'Mật khẩu cũ mất hiệu lực ngay, mọi phiên đang mở của họ bị cắt.\n' +
      'Mật khẩu tạm mới hiện ra ngay sau đây — chép lại và gửi cho chủ tài khoản.'
    )) return;
    setDangLam(tk.id);
    setErrorMessage('');
    try {
      const { data } = await api.admin.resetPassword(tk.id);
      setMatKhauTam({ email: tk.email, mk: data.matKhauTam });
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không cấp lại được mật khẩu');
    } finally {
      setDangLam(null);
    }
  };

  /**
   * Chuyển một tài khoản đứng riêng thành tài khoản quản lý chuỗi.
   *
   * Hỏi lại trước khi làm: thao tác này gỡ hồ sơ nền tảng và xoá Trang rỗng
   * của tài khoản đó, và mọi phiên đang mở của họ sẽ bị đăng xuất.
   */
  const thanhChuChuoi = async (tk: TaiKhoanQuanTri) => {
    const dong = window.confirm(
      `Chuyển ${tk.email} thành tài khoản quản lý chuỗi?\n\n` +
        'Sau khi chuyển, tài khoản này không gắn Fanpage trực tiếp nữa mà lập ' +
        'các tài khoản trang bên dưới, mỗi trang một Fanpage.\n\n' +
        'Người dùng sẽ bị đăng xuất và cần đăng nhập lại.'
    );
    if (!dong) return;

    setDangLam(tk.id);
    setErrorMessage('');
    try {
      const { data } = await api.admin.thanhChuChuoi(tk.id);
      /*
       * Dọn hồ sơ hỏng thì việc chuyển vẫn xong — phải nói rõ để quản trị còn
       * dọn tay, chứ im lặng là hồ sơ nằm lại vĩnh viễn bên nhà cung cấp.
       */
      if (data.loiDonHoSo) {
        setErrorMessage(
          `Đã chuyển ${data.email}, nhưng chưa dọn được hồ sơ nền tảng. Vui lòng dọn tay.`
        );
      }
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không chuyển được tài khoản');
    } finally {
      setDangLam(null);
    }
  };

  const xoaTaiKhoan = async (tk: TaiKhoanQuanTri) => {
    const go = prompt(
      `XOÁ HẲN tài khoản ${tk.email}?\n\n` +
      'Mất sạch khách hàng, hội thoại, đơn hàng và bài đăng của shop này. Không lấy lại được.\n\n' +
      'Gõ đúng email của họ để xác nhận:'
    );
    if (go === null) return;
    setDangLam(tk.id);
    setErrorMessage('');
    try {
      await api.admin.remove(tk.id, go);
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không xoá được tài khoản');
    } finally {
      setDangLam(null);
    }
  };

  const luuSua = async () => {
    if (!dangSua) return;
    setErrorMessage('');
    try {
      await api.admin.update(dangSua.id, { name: suaTen.trim(), email: suaEmail.trim() });
      setDangSua(null);
      await nap();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không lưu được thay đổi');
    }
  };

  const soKhoa = danhSach.filter((t) => !t.is_active).length;

  return (
    <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full bg-background">
      <BangLoi noiDung={errorMessage} onDong={() => setErrorMessage('')} className="mb-6" />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline-sm text-3xl font-bold text-on-surface tracking-tight mb-2">
            Quản trị hệ thống
          </h1>
          <p className="font-body-lg text-on-surface-variant">
            {danhSach.length} tài khoản{soKhoa > 0 ? `, ${soKhoa} đang bị khoá` : ''}
          </p>
        </div>
        <button
          onClick={() => setMoTao(true)}
          className="shrink-0 px-4 py-2 bg-primary text-on-primary font-bold rounded-lg shadow-[0_4px_15px_rgba(0,229,255,0.4)] hover:brightness-110 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Tạo tài khoản
        </button>
      </div>

      <ChiPhiHeThong />

      {doiMatKhauMo && <DoiMatKhau onClose={() => setDoiMatKhauMo(false)} />}
      {/*
        Cửa sổ nổi giữa màn hình, không đóng khi bấm ra ngoài. Đã thấy: hộp nằm
        phía trên khối chi phí, người bấm ở bảng phía dưới không nhìn thấy —
        mà mật khẩu tạm chỉ hiện đúng một lần.
      */}
      {matKhauTam && (
        <HopThoai
          co="vua"
          bieuTuong="key"
          tieuDe="Mật khẩu tạm"
          phuDe={`Cho ${matKhauTam.email} — chỉ hiện đúng một lần, hệ thống không lưu lại.`}
          onDong={() => setMatKhauTam(null)}
          dongKhiBamNgoai={false}
          chan={
            <button type="button" onClick={() => setMatKhauTam(null)} className={NUT_CHINH}>
              Đã chép, đóng
            </button>
          }
        >
          <p className="text-base text-on-surface-variant mb-4">
            Chép gửi cho chủ shop và dặn họ đổi ngay sau lần đăng nhập đầu tiên.
          </p>
          <code className="block text-2xl font-mono font-bold tracking-wide bg-surface-container-lowest px-5 py-4 rounded-xl border border-outline text-on-surface select-all">
            {matKhauTam.mk}
          </code>
        </HopThoai>
      )}

      <div className="bg-surface-container border border-outline-variant rounded-2xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant">
                <th className="text-left font-mono text-[10px] uppercase tracking-wider px-4 py-3">Tài khoản</th>
                <th className="text-left font-mono text-[10px] uppercase tracking-wider px-4 py-3">Gói</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-wider px-4 py-3">Kênh</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-wider px-4 py-3">Hội thoại</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-wider px-4 py-3">Đơn</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-wider px-4 py-3">Bài</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-wider px-4 py-3">Tài liệu</th>
                <th className="text-left font-mono text-[10px] uppercase tracking-wider px-4 py-3">Hoạt động cuối</th>
                <th className="text-left font-mono text-[10px] uppercase tracking-wider px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {danhSach.map((t) => (
                <tr key={t.id} className="border-b border-outline-variant/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-bold text-on-surface flex items-center gap-2">
                      {t.name || '(chưa đặt tên)'}
                      {t.role === 'admin' && (
                        <span className="font-mono text-[10px] uppercase text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">
                          quản trị
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant">{t.email}</div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{t.plan}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{t.kenh}</td>
                  <td className="px-4 py-3 text-right text-on-surface">
                    {t.hoi_thoai}
                    {t.cho_nguoi > 0 && (
                      <span className="text-error font-bold"> ({t.cho_nguoi} chờ)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-on-surface">{t.don}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{t.bai}</td>
                  <td className={`px-4 py-3 text-right ${t.tai_lieu === 0 ? 'text-error font-bold' : 'text-on-surface'}`}>
                    {t.tai_lieu}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                    {gioVN(t.hoat_dong_cuoi)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded w-fit border ${
                        t.is_active
                          ? 'text-green-400 bg-green-500/10 border-green-500/30'
                          : 'text-error bg-error/10 border-error/30'
                      }`}>
                        {t.is_active ? 'đang chạy' : 'đã khoá'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {t.tu_chu === 'true' ? 'tự chủ bật' : 'tự chủ tắt'}
                        {t.telegram ? ' · telegram' : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setDangSua(t); setSuaTen(t.name); setSuaEmail(t.email); }}
                        className="px-2.5 py-1.5 rounded-lg border border-outline-variant text-on-surface text-xs font-bold hover:border-primary transition-colors"
                      >
                        Sửa
                      </button>
                      {/*
                        Dòng của chính mình: ĐỔI mật khẩu (tự đặt, giữ phiên), không
                        CẤP LẠI. Đã xảy ra: tự cấp lại cho mình → phiên bị cắt, đá ra
                        ngoài trước khi kịp thấy mật khẩu tạm → tự khoá mình ngoài.
                      */}
                      <button
                        onClick={() => (t.la_toi ? setDoiMatKhauMo(true) : capLaiMatKhau(t))}
                        disabled={dangLam === t.id}
                        className="px-2.5 py-1.5 rounded-lg border border-outline-variant text-on-surface text-xs font-bold hover:border-primary transition-colors disabled:opacity-50"
                      >
                        {t.la_toi ? 'Đổi mật khẩu' : 'Mật khẩu'}
                      </button>
                      {/*
                        Chỉ hiện với tài khoản đứng riêng chưa phải chủ chuỗi.
                        Máy chủ vẫn từ chối nếu tài khoản đã có dữ liệu — giấu
                        nút không phải là chặn.
                      */}
                      {t.role === 'shop' && (
                        <button
                          onClick={() => thanhChuChuoi(t)}
                          disabled={dangLam === t.id}
                          className="px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          Thành chủ chuỗi
                        </button>
                      )}
                      {t.role !== 'admin' && (
                        <>
                          <button
                            onClick={() => doiKhoa(t)}
                            disabled={dangLam === t.id}
                            className="px-2.5 py-1.5 rounded-lg border border-outline-variant text-on-surface text-xs font-bold hover:border-primary transition-colors disabled:opacity-50"
                          >
                            {t.is_active ? 'Khoá' : 'Mở khoá'}
                          </button>
                          <button
                            onClick={() => xoaTaiKhoan(t)}
                            disabled={dangLam === t.id}
                            className="px-2.5 py-1.5 rounded-lg border border-error/30 bg-error/10 text-error text-xs font-bold hover:bg-error/20 transition-colors disabled:opacity-50"
                          >
                            Xoá
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="tieu-de-muc mb-3">
          Nhật ký quản trị
        </h2>
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 space-y-2">
          {nhatKy.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Chưa có thao tác nào.</p>
          ) : (
            nhatKy.map((n) => (
              <div key={n.id} className="flex items-baseline gap-3 text-sm">
                <span className="text-xs text-on-surface-variant whitespace-nowrap shrink-0">
                  {gioVN(n.created_at)}
                </span>
                <span className="font-bold text-on-surface shrink-0">
                  {TEN_VIEC[n.action] ?? n.action}
                </span>
                <span className="text-on-surface-variant truncate">
                  {n.target_email} {n.admin_email ? `· bởi ${n.admin_email}` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {moTao && (
        <HopThoai
          co="vua"
          bieuTuong="person_add"
          tieuDe="Tạo tài khoản mới"
          phuDe="Tài khoản độc lập, ở trạng thái mặc định để chủ shop tự cài. Mật khẩu tạm hiện đúng một lần cho bạn chép lại."
          onDong={() => setMoTao(false)}
          dongKhiBamNgoai={false}
          chan={
            <>
              <button type="button" onClick={() => setMoTao(false)} className={NUT_PHU}>
                Huỷ
              </button>
              <button type="button" onClick={taoTaiKhoan} disabled={dangTao || !emailMoi.trim()} className={NUT_CHINH}>
                {dangTao ? 'Đang tạo…' : 'Tạo tài khoản'}
              </button>
            </>
          }
        >
          <div className="space-y-6">
            <div>
              <span className={NHAN_O}>Loại tài khoản</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    id: 'admin_con' as const,
                    ten: 'Chủ chuỗi',
                    mo: 'Tự lập các tài khoản trang của mình, mỗi trang một Fanpage. Đây là loại thường dùng.',
                  },
                  {
                    id: 'shop' as const,
                    ten: 'Một trang đứng riêng',
                    mo: 'Gắn được đúng một Fanpage và không lập thêm trang nào. Chỉ dùng cho trường hợp đặc biệt.',
                  },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setVaiTroMoi(o.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-colors ${
                      vaiTroMoi === o.id
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant bg-surface-container-low hover:border-outline'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-base font-bold text-on-surface">
                      <span className={`material-symbols-outlined text-[20px] ${vaiTroMoi === o.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {vaiTroMoi === o.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                      {o.ten}
                    </div>
                    <div className="text-sm text-on-surface-variant mt-1.5 pl-7">{o.mo}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={NHAN_O}>Email đăng nhập</span>
                <input
                  type="email"
                  value={emailMoi}
                  onChange={(e) => setEmailMoi(e.target.value)}
                  placeholder="chushop@email.com"
                  className={O_NHAP}
                />
              </label>
              <label className="block">
                <span className={NHAN_O}>Tên shop</span>
                <input
                  type="text"
                  value={tenMoi}
                  onChange={(e) => setTenMoi(e.target.value)}
                  placeholder="Ví dụ: Chạm Tay Vạn Điều Hay"
                  className={O_NHAP}
                />
              </label>
            </div>
          </div>
        </HopThoai>
      )}

      {dangSua && (
        <HopThoai
          co="vua"
          bieuTuong="edit"
          tieuDe="Sửa tài khoản"
          phuDe={dangSua.email}
          onDong={() => setDangSua(null)}
          chan={
            <>
              <button type="button" onClick={() => setDangSua(null)} className={NUT_PHU}>
                Huỷ
              </button>
              <button type="button" onClick={luuSua} className={NUT_CHINH}>
                Lưu
              </button>
            </>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className={NHAN_O}>Tên shop</span>
              <input type="text" value={suaTen} onChange={(e) => setSuaTen(e.target.value)} className={O_NHAP} />
            </label>
            <label className="block">
              <span className={NHAN_O}>Email đăng nhập</span>
              <input type="email" value={suaEmail} onChange={(e) => setSuaEmail(e.target.value)} className={O_NHAP} />
            </label>
          </div>
        </HopThoai>
      )}
    </main>
  );
}

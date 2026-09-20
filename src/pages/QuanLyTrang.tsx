import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type TrangVanHanh } from '../lib/api';
import { docTinhTrang, mucDoNang, NhanTinhTrang } from '../components/TinhTrangTrang';

/**
 * Bảng điều hành cả chuỗi, dành cho chủ chuỗi (tài khoản 'admin_con').
 *
 * Đây là chỗ điều hành, KHÔNG phải danh sách tài khoản. Chủ chuỗi năm trang mở
 * màn hình này phải biết ngay: cả chuỗi hôm nay bán được bao nhiêu, trang nào
 * đang hỏng, trang nào có khách chờ, trang nào cả tuần không ai nhắn. Muốn xem
 * kỹ một trang thì mới bấm vào trang đó — lúc ấy mới là một tài khoản riêng,
 * độc lập hoàn toàn.
 *
 * Mỗi trang vẫn là một TÀI KHOẢN RIÊNG: hộp thư riêng, đơn hàng riêng, bộ não
 * riêng. Màn hình này không trộn dữ liệu của chúng, chỉ đếm và xếp cạnh nhau.
 */

const tienVN = (so: string | number): string =>
  `${Number(so || 0).toLocaleString('vi-VN')} đ`;

const khiNao = (moc: string | null): string => {
  if (!moc) return 'chưa có hoạt động nào';
  const phut = Math.floor((Date.now() - new Date(moc).getTime()) / 60000);
  if (phut < 1) return 'vừa xong';
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.floor(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  return `${Math.floor(gio / 24)} ngày trước`;
};

function O({ nhan, so, phu, nhanManh }: {
  nhan: string; so: string | number; phu?: string; nhanManh?: boolean;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
      <div className="text-xs text-on-surface-variant uppercase tracking-wide">{nhan}</div>
      <div className={clsx('text-2xl font-bold mt-1', nhanManh ? 'text-amber-500' : 'text-on-surface')}>
        {so}
      </div>
      {phu && <div className="text-xs text-on-surface-variant mt-0.5">{phu}</div>}
    </div>
  );
}

export default function QuanLyTrang() {
  const [ds, setDs] = useState<TrangVanHanh[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');
  const [ban, setBan] = useState(false);

  const [tenMoi, setTenMoi] = useState('');
  /*
   * Mật khẩu tạm chỉ hiện ĐÚNG MỘT LẦN ngay sau khi lập trang. Hệ thống chỉ
   * giữ bản băm nên không đọc lại được — phải nói rõ ngay trên màn hình, không
   * thì chủ chuỗi đóng đi rồi mới biết là mất.
   */
  const [vuaLap, setVuaLap] = useState<
    { name: string; tenDangNhap: string; matKhauTam: string } | null
  >(null);

  const [dangSuaTen, setDangSuaTen] = useState<number | null>(null);
  const [tenSua, setTenSua] = useState('');

  const nap = useCallback(async () => {
    setDangTai(true);
    try {
      const { data } = await api.quanLy.tongQuan();
      setDs(data);
      setLoi('');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được bảng điều hành');
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

  const luuTen = async (trang: TrangVanHanh) => {
    const ten = tenSua.trim();
    if (ten.length < 2) { setLoi('Tên trang phải có ít nhất 2 ký tự'); return; }
    if (ten === trang.name) { setDangSuaTen(null); return; }
    setBan(true);
    try {
      await api.quanLy.doiTen(trang.id, ten);
      setDangSuaTen(null);
      setLoi('');
      await nap();
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không đổi được tên trang');
    } finally {
      setBan(false);
    }
  };

  const moTrang = async (trang: TrangVanHanh) => {
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

  const doiKhoa = async (trang: TrangVanHanh) => {
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

  const capLaiMatKhau = async (trang: TrangVanHanh) => {
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

  // --- Tổng cả chuỗi. Cộng ở đây chứ không bắt máy chủ tính thêm một lượt. ---
  const tong = ds.reduce(
    (a, t) => ({
      donHomNay: a.donHomNay + t.don_hom_nay,
      donThang: a.donThang + t.don_thang,
      doanhThu: a.doanhThu + Number(t.doanh_thu_thang || 0),
      choNguoi: a.choNguoi + t.cho_nguoi,
      aiTraLoi: a.aiTraLoi + t.ai_tra_loi_7_ngay,
      kenhNoi: a.kenhNoi + t.kenh_noi,
      canNoiLai: a.canNoiLai + t.kenh_can_noi_lai,
    }),
    { donHomNay: 0, donThang: 0, doanhThu: 0, choNguoi: 0, aiTraLoi: 0, kenhNoi: 0, canNoiLai: 0 }
  );

  // --- Việc phải xử lý, gom từ mọi trang, nặng trước. ---
  const cangDau = ds
    .map((t) => ({ trang: t, viec: docTinhTrang(t).filter((v) => v.mucDo !== 'on') }))
    .filter((x) => x.viec.length > 0)
    .sort((a, b) => (mucDoNang(b.viec) === 'hong' ? 1 : 0) - (mucDoNang(a.viec) === 'hong' ? 1 : 0));

  return (
    <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full bg-background">
      <div className="mb-6">
        <h1 className="font-headline-sm text-2xl font-bold text-on-surface">Điều hành chuỗi trang</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Toàn bộ {ds.length} trang trên một màn hình. Mỗi trang là một tài khoản riêng, hoàn toàn
          độc lập — bấm Mở trang để vào làm việc bên trong.
        </p>
      </div>

      {loi && (
        <div className="mb-6 text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3">
          {loi}
        </div>
      )}

      {vuaLap && (
        <div className="mb-6 rounded-xl border border-primary/40 bg-primary/10 px-4 py-4">
          <div className="font-bold text-on-surface mb-2">Mật khẩu của trang {vuaLap.name}</div>
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

      {dangTai ? (
        <div className="text-sm text-on-surface-variant">Đang tải bảng điều hành…</div>
      ) : (
        <>
          {/* --- Tầng 1: tổng cả chuỗi --- */}
          {ds.length > 0 && (
            <div className="grid gap-3 mb-6 grid-cols-2 lg:grid-cols-5">
              <O nhan="Đơn hôm nay" so={tong.donHomNay} phu={`${tong.donThang} đơn trong tháng`} />
              <O nhan="Doanh thu tháng" so={tienVN(tong.doanhThu)} phu="cả chuỗi" />
              <O
                nhan="Khách chờ người"
                so={tong.choNguoi}
                phu="cần bạn trả lời"
                nhanManh={tong.choNguoi > 0}
              />
              <O nhan="AI trả lời 7 ngày" so={tong.aiTraLoi} phu="tin nhắn AI đã xử lý" />
              <O
                nhan="Kênh đang nối"
                so={tong.kenhNoi}
                phu={tong.canNoiLai > 0 ? `${tong.canNoiLai} kênh cần nối lại` : 'tất cả bình thường'}
                nhanManh={tong.canNoiLai > 0}
              />
            </div>
          )}

          {/* --- Tầng 2: việc phải xử lý --- */}
          {cangDau.length > 0 && (
            <div className="mb-6 rounded-xl border border-outline-variant bg-surface px-4 py-4">
              <div className="font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-500">
                  priority_high
                </span>
                Cần xử lý ({cangDau.length} trang)
              </div>
              <div className="grid gap-2">
                {cangDau.map(({ trang, viec }) => (
                  <div key={trang.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      onClick={() => moTrang(trang)}
                      disabled={ban || !trang.is_active}
                      className="font-bold text-on-surface hover:text-primary disabled:opacity-50"
                    >
                      {trang.name}
                    </button>
                    {viec.map((v, i) => <NhanTinhTrang key={i} viec={v} />)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Lập trang mới --- */}
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

          {/* --- Tầng 3: từng trang --- */}
          {ds.length === 0 ? (
            <div className="rounded-xl border border-outline-variant bg-surface px-6 py-10 text-center">
              <div className="font-bold text-on-surface mb-1">Chưa có trang nào</div>
              <div className="text-sm text-on-surface-variant">
                Đặt tên trang đầu tiên ở ô bên trên. Mỗi trang lập ra sẽ có tên đăng nhập và mật
                khẩu riêng.
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {ds.map((t) => {
                const viec = docTinhTrang(t);
                const nang = mucDoNang(viec);
                return (
                  <div
                    key={t.id}
                    className={clsx(
                      'rounded-xl border bg-surface px-4 py-4',
                      nang === 'hong' ? 'border-error/40' : 'border-outline-variant'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[220px]">
                        {dangSuaTen === t.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              /*
                               * Bôi sẵn chữ cũ. autoFocus chỉ đặt con trỏ chứ
                               * không chọn chữ, nên gõ tên mới là NỐI THÊM vào
                               * tên cũ — đã thử và ra "botsandayBột Sắn Dây Quê".
                               */
                              onFocus={(e) => e.currentTarget.select()}
                              value={tenSua}
                              onChange={(e) => setTenSua(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') luuTen(t);
                                if (e.key === 'Escape') setDangSuaTen(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-surface-variant/40 border border-primary text-sm font-bold text-on-surface focus:outline-none"
                            />
                            <button
                              onClick={() => luuTen(t)}
                              disabled={ban}
                              className="text-sm font-bold text-primary hover:underline disabled:opacity-50"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setDangSuaTen(null)}
                              className="text-sm text-on-surface-variant hover:underline"
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <div className="font-bold text-on-surface flex items-center gap-2">
                            {t.name}
                            {/* Bấm thẳng vào tên để sửa — chỗ ai cũng thử bấm đầu tiên. */}
                            <button
                              onClick={() => { setDangSuaTen(t.id); setTenSua(t.name); }}
                              title="Đổi tên trang"
                              className="text-on-surface-variant hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          </div>
                        )}

                        <div className="text-xs text-on-surface-variant mt-1">
                          {t.ten_fanpage ? `Fanpage: ${t.ten_fanpage}` : 'Chưa nối Fanpage nào'}
                          {' · '}
                          {khiNao(t.hoat_dong_cuoi)}
                        </div>
                        <div className="text-xs text-on-surface-variant/70 mt-0.5 select-all">
                          {t.email}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {viec.map((v, i) => <NhanTinhTrang key={i} viec={v} />)}
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
                          <div className="text-xs text-on-surface-variant">Tin nhắn 7 ngày</div>
                          <div className="font-bold text-on-surface">
                            {t.tin_7_ngay}
                            <span className="text-xs font-normal text-on-surface-variant">
                              {' '}· AI {t.ai_tra_loi_7_ngay}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant">Bộ não AI</div>
                          <div className="font-bold text-on-surface text-sm">
                            {t.da_day_vai_tro > 0 ? 'Đã dạy' : 'Chưa dạy'}
                            <span className="text-xs font-normal text-on-surface-variant">
                              {' '}· {t.so_tai_lieu} tài liệu
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-on-surface-variant">Tự chốt đơn</div>
                          <div className="font-bold text-on-surface text-sm">
                            {t.ai_tu_chu ? 'Bật' : 'Tắt'}
                            <span className="text-xs font-normal text-on-surface-variant">
                              {' '}· {t.kich_ban_bat} kịch bản
                            </span>
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
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type NguongCanhBao, type SaoKeChiPhi } from '../lib/api';

/**
 * Sao kê chi phí trả cho các bên thứ ba — chỉ quản trị tổng thấy.
 *
 * Số dư AI và tình hình nhà cung cấp kênh đọc SỐNG mỗi lần mở; chi tiết theo
 * việc, theo shop, theo ngày lấy từ sổ của app. Nạp tiền mở thẳng trang thanh
 * toán của từng bên (thẻ chỉ nhập ở trang của họ, app không bao giờ giữ số thẻ).
 */

const TY_GIA = 25_500;
const usd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toFixed(2)} USD`);
const vnd = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : `~${(Math.round((n * TY_GIA) / 1000) * 1000).toLocaleString('vi-VN')}đ`;

export default function ChiPhiHeThong() {
  const [du, setDu] = useState<SaoKeChiPhi | null>(null);
  const [soNgay, setSoNgay] = useState(30);
  const [dangTai, setDangTai] = useState(false);
  const [nguong, setNguong] = useState<NguongCanhBao | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [thongBao, setThongBao] = useState('');
  const [loi, setLoi] = useState('');

  const tai = useCallback(async () => {
    setDangTai(true);
    setLoi('');
    try {
      const { data } = await api.admin.chiPhi(soNgay);
      setDu(data);
      setNguong(data.nguong);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa tải được sao kê chi phí');
    } finally {
      setDangTai(false);
    }
  }, [soNgay]);

  useEffect(() => {
    void tai();
  }, [tai]);

  const luuNguong = async () => {
    if (!nguong || dangLuu) return;
    setDangLuu(true);
    setThongBao('');
    try {
      const { data } = await api.admin.luuNguongChiPhi(nguong);
      setNguong(data);
      setThongBao('Đã lưu ngưỡng cảnh báo.');
      void tai();
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa lưu được ngưỡng');
    } finally {
      setDangLuu(false);
    }
  };

  const guiThu = async () => {
    setThongBao('');
    setLoi('');
    try {
      await api.admin.thuCanhBaoChiPhi();
      setThongBao('Đã gửi thử cảnh báo tới Telegram của bạn.');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa gửi được');
    }
  };

  const ai = du?.ai;
  const kenh = du?.kenh;
  const tbNgay = ai?.tuanNayUsd ? ai.tuanNayUsd / 7 : 0;
  const soNgayCon = ai?.conLaiUsd !== undefined && tbNgay > 0 ? Math.floor(ai.conLaiUsd / tbNgay) : null;
  const maxNgay = Math.max(0.0001, ...(du?.so.theoNgay.map((x) => x.usd) ?? [0]));
  const tongKy = du?.so.theoViec.reduce((t, x) => t + x.usd, 0) ?? 0;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-mono text-[11px] font-bold text-primary tracking-wider uppercase">Chi phí hệ thống</h2>
        <button
          type="button"
          onClick={() => void tai()}
          disabled={dangTai}
          className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary disabled:opacity-50"
        >
          {dangTai ? 'Đang cập nhật…' : 'Cập nhật'}
        </button>
      </div>

      {loi && <div className="mb-3 text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>}
      {thongBao && <div className="mb-3 text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">{thongBao}</div>}

      {/* Cảnh báo */}
      {du && (
        <div className="mb-4 space-y-2">
          {du.canhBao.length === 0 ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-on-surface">
              ✅ Mọi khoản đang ổn — không có gì cần nạp hay trả lúc này.
            </div>
          ) : (
            du.canhBao.map((c) => (
              <div
                key={c.ma}
                className={clsx(
                  'rounded-xl border px-4 py-3 text-sm flex flex-col md:flex-row md:items-center gap-3 justify-between',
                  c.mucDo === 'nguy_cap'
                    ? 'border-error bg-error/10 text-error'
                    : c.mucDo === 'can_lam'
                      ? 'border-tertiary/50 bg-tertiary/10 text-on-surface'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant'
                )}
              >
                <span>{c.mucDo === 'nguy_cap' ? '🔴 ' : c.mucDo === 'can_lam' ? '🟠 ' : 'ℹ️ '}{c.noiDung}</span>
                {c.link && (
                  <a href={c.link} target="_blank" rel="noreferrer" className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">
                    Xử lý ngay
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Từng bên thứ ba */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface">Tiền AI (OpenRouter)</span>
            <span className={clsx('text-[11px] font-bold', ai?.ok ? 'text-primary' : 'text-error')}>{ai?.ok ? 'Đọc sống' : 'Lỗi'}</span>
          </div>
          {ai?.ok ? (
            <>
              <p className="text-2xl font-bold text-on-surface">{usd(ai.conLaiUsd)}</p>
              <p className="text-[11px] text-on-surface-variant">
                còn lại {vnd(ai.conLaiUsd)}{soNgayCon !== null && ` · đủ khoảng ${soNgayCon} ngày`}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-on-surface-variant pt-1">
                <dt>Đã nạp</dt><dd className="text-right text-on-surface">{usd(ai.daNapUsd)}</dd>
                <dt>Đã tiêu</dt><dd className="text-right text-on-surface">{usd(ai.daTieuUsd)}</dd>
                <dt>Hôm nay</dt><dd className="text-right text-on-surface">{usd(ai.homNayUsd)}</dd>
                <dt>7 ngày qua</dt><dd className="text-right text-on-surface">{usd(ai.tuanNayUsd)}</dd>
                <dt>Tháng này</dt><dd className="text-right text-on-surface">{usd(ai.thangNayUsd)}</dd>
              </dl>
            </>
          ) : (
            <p className="text-xs text-error">{ai?.loi}</p>
          )}
          <a href={du?.linkNap.openrouter} target="_blank" rel="noreferrer" className="block text-center px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold">
            Nạp tiền AI
          </a>
        </div>

        <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface">Nhà cung cấp kết nối kênh</span>
            <span className={clsx('text-[11px] font-bold', kenh?.ok && kenh.conHoatDong ? 'text-primary' : 'text-error')}>
              {!kenh?.ok ? 'Lỗi' : kenh.conHoatDong ? 'Đang hoạt động' : 'ĐANG TẠM DỪNG'}
            </span>
          </div>
          {kenh?.ok ? (
            <>
              <p className="text-2xl font-bold text-on-surface">{usd(kenh.tieuKyNayUsd)}</p>
              <p className="text-[11px] text-on-surface-variant">tiêu trong kỳ này {vnd(kenh.tieuKyNayUsd)} · gói {kenh.goi ?? '—'}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-on-surface-variant pt-1">
                <dt>Tín dụng còn</dt><dd className="text-right text-on-surface">{usd(kenh.tinDungConUsd)}</dd>
                <dt>Cần trả</dt><dd className={clsx('text-right', (kenh.canTraUsd ?? 0) > 0 ? 'text-error font-bold' : 'text-on-surface')}>{kenh.canTraUsd ? usd(kenh.canTraUsd) : 'Không'}</dd>
                {kenh.lyDoTuChoiThe && (<><dt>Thẻ bị từ chối</dt><dd className="text-right text-error">{kenh.lyDoTuChoiThe}</dd></>)}
                {kenh.lyDoTamDung && (<><dt>Lý do dừng</dt><dd className="text-right text-error">{kenh.lyDoTamDung}</dd></>)}
              </dl>
            </>
          ) : (
            <p className="text-xs text-error">{kenh?.loi}</p>
          )}
          <a href={kenh?.linkHoaDon ?? du?.linkNap.kenh} target="_blank" rel="noreferrer" className="block text-center px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold">
            {kenh?.linkHoaDon ? 'Trả hoá đơn ngay' : 'Trang thanh toán'}
          </a>
        </div>

        <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant space-y-2">
          <span className="text-xs font-bold text-on-surface">Các bên khác</span>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-on-surface-variant">
            <dt>Database (Neon)</dt><dd className="text-right text-on-surface">Xem trên trang Neon</dd>
            <dt>Gửi email (Gmail)</dt><dd className="text-right text-on-surface">Miễn phí</dd>
            <dt>Telegram</dt><dd className="text-right text-on-surface">Miễn phí</dd>
          </dl>
          <a href={du?.linkNap.database} target="_blank" rel="noreferrer" className="block text-center px-3 py-2 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary">
            Trang thanh toán Neon
          </a>
        </div>
      </div>

      {/* Chi tiết từ sổ của app */}
      <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-on-surface">Tiền AI tiêu vào đâu — {soNgay} ngày qua: {usd(tongKy)} {vnd(tongKy)}</span>
          <div className="flex gap-1">
            {[1, 7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSoNgay(n)}
                className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-bold border', soNgay === n ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant text-on-surface-variant')}
              >
                {n === 1 ? 'Hôm nay' : `${n} ngày`}
              </button>
            ))}
          </div>
        </div>

        {du && du.so.theoNgay.length > 0 && (
          <div className="flex items-end gap-1 h-24 mb-4" aria-label="Chi phí AI theo ngày">
            {du.so.theoNgay.map((d) => (
              <div key={d.ngay} className="flex-1 min-w-[6px] h-full flex flex-col justify-end" title={`${d.ngay}: ${usd(d.usd)}`}>
                <div className="bg-primary/70 rounded-t" style={{ height: `${Math.max(2, (d.usd / maxNgay) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant mb-1.5">Theo việc</p>
            <table className="w-full text-xs">
              <tbody>
                {du?.so.theoViec.map((v) => (
                  <tr key={v.viec} className="border-t border-outline-variant/50">
                    <td className="py-1.5 text-on-surface">{v.ten}</td>
                    <td className="py-1.5 text-right text-on-surface-variant">{v.lan} lượt</td>
                    <td className="py-1.5 text-right text-on-surface font-bold">{usd(v.usd)}</td>
                  </tr>
                ))}
                {du && du.so.theoViec.length === 0 && (
                  <tr><td className="py-2 text-on-surface-variant">Chưa có khoản nào trong khoảng này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant mb-1.5">Theo shop</p>
            <table className="w-full text-xs">
              <tbody>
                {du?.so.theoShop.map((s) => (
                  <tr key={String(s.userId)} className="border-t border-outline-variant/50">
                    <td className="py-1.5 text-on-surface truncate max-w-[180px]">{s.ten}</td>
                    <td className="py-1.5 text-right text-on-surface-variant">{s.lan} lượt</td>
                    <td className="py-1.5 text-right text-on-surface font-bold">{usd(s.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {du?.doiChieu && (
          <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">
            Đối chiếu từ trước tới nay: nhà cung cấp AI đã trừ <b className="text-on-surface">{usd(du.doiChieu.nhaCungCapTruUsd)}</b>, sổ của
            app ghi <b className="text-on-surface">{usd(du.doiChieu.appGhiUsd)}</b>. Khoản chênh gồm tiền tiêu trước khi app có sổ chi phí
            và các lượt dùng khoá AI ngoài app.
          </p>
        )}
      </div>

      {/* Ngưỡng cảnh báo */}
      {nguong && (
        <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant">
          <p className="text-xs font-bold text-on-surface mb-1">Cảnh báo tự động qua Telegram</p>
          <p className="text-[11px] text-on-surface-variant mb-3">
            Hệ thống tự soát mỗi giờ. Gặp một trong các điều dưới đây thì nhắn Telegram cho mọi quản trị tổng (mỗi loại tối đa 12 giờ một lần).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <label className="text-[11px] text-on-surface-variant">
              Tiền AI còn dưới (USD)
              <input type="number" min={0} step={0.5} value={nguong.soDuToiThieuUsd}
                onChange={(e) => setNguong({ ...nguong, soDuToiThieuUsd: Number(e.target.value) })}
                className="mt-1 w-full bg-surface rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface" />
            </label>
            <label className="text-[11px] text-on-surface-variant">
              Hoặc chỉ còn đủ dưới (ngày)
              <input type="number" min={0} step={1} value={nguong.soNgayToiThieu}
                onChange={(e) => setNguong({ ...nguong, soNgayToiThieu: Number(e.target.value) })}
                className="mt-1 w-full bg-surface rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface" />
            </label>
            <label className="text-[11px] text-on-surface-variant">
              Tiêu trong ngày gấp (lần) trung bình
              <input type="number" min={1.1} step={0.5} value={nguong.heSoTieuQua}
                onChange={(e) => setNguong({ ...nguong, heSoTieuQua: Number(e.target.value) })}
                className="mt-1 w-full bg-surface rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface" />
            </label>
          </div>
          <p className="text-[11px] text-on-surface-variant mb-3">Nhà cung cấp kênh tạm dừng hoặc có hoá đơn cần trả thì luôn cảnh báo, không cần ngưỡng.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={luuNguong} disabled={dangLuu} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50">
              {dangLuu ? 'Đang lưu…' : 'Lưu ngưỡng'}
            </button>
            <button type="button" onClick={guiThu} className="px-3 py-2 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary">
              Gửi thử cảnh báo tới Telegram của tôi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type NguongCanhBao, type SaoKeChiPhi } from '../lib/api';
import { chi, daChi, mauChi, so, vnd } from '../lib/tien-chi';

/**
 * Chi phí hệ thống — BẢN MẪU cho cách trình bày chung của cả app.
 *
 * Nguyên tắc (chủ dự án đặt): bên ngoài CHỈ có phần chính, ngắn và nổi bật —
 * mỗi bên thứ ba một dòng số tiền đã chi, cộng một dòng tổng. Chi tiết chỉ hiện
 * khi bấm vào đúng dòng đó; cài đặt cất sau biểu tượng bánh răng. Không bao giờ
 * để phần chính và phần con cùng nằm ngoài.
 */

type Dong = 'ai' | 'kenh';
/** [nhãn, giá trị, màu chữ của giá trị]. Giá trị rỗng = tiêu đề nhóm. */
type Hang = [string, string, string?];

export default function ChiPhiHeThong() {
  const [du, setDu] = useState<SaoKeChiPhi | null>(null);
  const [mo, setMo] = useState<Dong | null>(null);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [xemTheoShop, setXemTheoShop] = useState(false);
  const [nguong, setNguong] = useState<NguongCanhBao | null>(null);
  const [thongBao, setThongBao] = useState('');
  const [loi, setLoi] = useState('');

  const tai = useCallback(async () => {
    try {
      const { data } = await api.admin.chiPhi(0);
      setDu(data);
      setNguong(data.nguong);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa tải được chi phí');
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  const canhBao = (nhom: Dong) =>
    du?.canhBao.filter((c) => c.mucDo !== 'luu_y' && c.ma.startsWith(nhom === 'ai' ? 'ai_' : 'kenh_')) ?? [];

  /*
   * Dòng AI = TỔNG các khoản chi tiết bên trong (sổ của app, tháng theo giờ
   * Việt Nam). Đã thấy: lấy số "tháng này" của nhà cung cấp (tháng theo giờ
   * quốc tế, bắt đầu 7h sáng ngày 1 giờ VN) thì dòng chính ghi 0,04 mà mở ra
   * lại thấy 0,85 — hai con số khác kỳ đặt cạnh nhau là rối.
   */
  const tienAi = du ? du.so.theoViec.reduce((t, v) => t + v.usd, 0) : null;
  const tienKenh = du?.kenh.ok ? du.kenh.tieuKyNayUsd ?? 0 : null;
  const tong = (tienAi ?? 0) + (tienKenh ?? 0);

  const dong = (id: Dong, ten: string, tien: number | null) => {
    const cb = canhBao(id);
    const mucDo = cb.some((c) => c.mucDo === 'nguy_cap') ? 'do' : cb.length ? 'cam' : 'xanh';
    return (
      <button
        type="button"
        onClick={() => setMo(mo === id ? null : id)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-surface-container-high/40 transition-colors"
        aria-expanded={mo === id}
      >
        <span
          className={clsx(
            'w-2.5 h-2.5 rounded-full shrink-0',
            mucDo === 'do' ? 'bg-red-500' : mucDo === 'cam' ? 'bg-amber-400' : 'bg-green-400'
          )}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-on-surface">{ten}</span>
          {cb[0] && (
            <span className={clsx('block text-xs mt-0.5', mucDo === 'do' ? 'text-red-400' : 'text-amber-400')}>
              {cb[0].noiDung.split('.')[0]}
            </span>
          )}
        </span>
        <span className={clsx('text-lg font-bold tabular-nums', mauChi(tien))}>{chi(tien)}</span>
        <span className={clsx('material-symbols-outlined text-on-surface-variant transition-transform', mo === id && 'rotate-90')}>
          chevron_right
        </span>
      </button>
    );
  };

  const chiTiet = (hang: Hang[], nut?: { ten: string; link?: string }) => (
    <div className="px-5 pb-4 pl-[2.6rem] space-y-1.5">
      {hang.map(([k, v, mau]) => (
        <div key={k} className={clsx('flex justify-between gap-4 text-xs', !v && 'pt-2')}>
          <span className={v ? 'text-on-surface-variant' : 'text-[11px] font-bold text-primary'}>{k}</span>
          <span className={clsx('tabular-nums text-right', mau ?? 'text-on-surface')}>{v}</span>
        </div>
      ))}
      {nut?.link && (
        <a href={nut.link} target="_blank" rel="noreferrer" className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">
          {nut.ten}
        </a>
      )}
    </div>
  );

  const ai = du?.ai;
  const kenh = du?.kenh;
  const tbNgay = ai?.tuanNayUsd ? ai.tuanNayUsd / 7 : 0;
  const theoViec = du?.so.theoViec.filter((v) => v.usd >= 0.005) ?? [];
  const theoShop = du?.so.theoShop.slice(0, 5) ?? [];

  return (
    <section className="mb-10 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[11px] font-bold text-primary tracking-wider uppercase">Chi phí tháng này</h2>
        <button
          type="button"
          onClick={() => setMoCaiDat(!moCaiDat)}
          title="Cài đặt cảnh báo"
          className={clsx('material-symbols-outlined text-[20px]', moCaiDat ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface')}
        >
          settings
        </button>
      </div>

      {loi && <p className="mb-3 text-xs text-error">{loi}</p>}

      <div className="rounded-2xl border border-outline-variant bg-surface-container/40 divide-y divide-outline-variant/60 overflow-hidden">
        {dong('ai', 'AI', tienAi)}
        {mo === 'ai' && ai?.ok && (
          <div>
            {chiTiet(
              [
                [
                  'Còn lại',
                  `${so(ai.conLaiUsd ?? 0)} USD${tbNgay > 0 ? ` · đủ ~${Math.floor((ai.conLaiUsd ?? 0) / tbNgay)} ngày` : ''}`,
                  canhBao('ai').length ? 'text-amber-400' : 'text-green-400',
                ],
                ['Đã nạp / đã tiêu từ trước tới nay', `${so(ai.daNapUsd ?? 0)} / ${so(ai.daTieuUsd ?? 0)} USD`],
                [xemTheoShop ? 'Tháng này — theo shop' : 'Tháng này — theo việc', ''],
                ...(xemTheoShop
                  ? theoShop.map((s): Hang => [s.ten, chi(s.usd), mauChi(s.usd)])
                  : theoViec.map((v): Hang => [v.ten, chi(v.usd), mauChi(v.usd)])),
              ],
              { ten: 'Nạp tiền AI', link: du?.linkNap.openrouter }
            )}
            <div className="px-5 pb-4 pl-[2.6rem] -mt-2">
              <button type="button" onClick={() => setXemTheoShop(!xemTheoShop)} className="text-[11px] text-primary hover:underline">
                {xemTheoShop ? '‹ Xem theo việc' : 'Xem theo shop ›'}
              </button>
            </div>
          </div>
        )}

        {dong('kenh', 'Kết nối kênh', tienKenh)}
        {mo === 'kenh' &&
          kenh?.ok &&
          chiTiet(
            [
              [
                'Trạng thái',
                kenh.conHoatDong ? 'Đang hoạt động' : `Tạm dừng — ${kenh.lyDoTamDung ?? 'chưa thanh toán'}`,
                kenh.conHoatDong ? 'text-green-400' : 'text-red-400',
              ],
              ['Cần trả', kenh.canTraUsd ? chi(kenh.canTraUsd) : 'Không', mauChi(kenh.canTraUsd)],
              ['Gói', kenh.goi ?? '—'],
            ],
            { ten: kenh.linkHoaDon ? 'Trả hoá đơn' : 'Trang thanh toán', link: kenh.linkHoaDon ?? du?.linkNap.kenh }
          )}

        <div className="px-5 py-4 flex items-center gap-3 bg-surface-container-high/30">
          <span className="w-2.5 shrink-0" />
          <span className="flex-1 text-sm font-bold text-on-surface">Tổng</span>
          <span className="text-right">
            <span className={clsx('block text-xl font-bold tabular-nums', du ? mauChi(tong) : 'text-on-surface-variant')}>
              {du ? chi(tong) : '—'}
            </span>
            {du && <span className={clsx('block text-[11px] tabular-nums', daChi(tong) ? 'text-red-400/70' : 'text-on-surface-variant')}>{vnd(tong)}</span>}
          </span>
          <span className="w-6 shrink-0" />
        </div>
      </div>

      {moCaiDat && nguong && (
        <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container/40 p-5 space-y-3">
          <p className="text-xs text-on-surface-variant">Nhắn Telegram khi:</p>
          {(
            [
              ['soDuToiThieuUsd', 'Tiền AI còn dưới (USD)', 0.5],
              ['soNgayToiThieu', 'Hoặc chỉ còn đủ dưới (ngày)', 1],
              ['heSoTieuQua', 'Tiêu trong ngày gấp (lần) mức thường', 0.5],
            ] as const
          ).map(([khoa, ten, buoc]) => (
            <label key={khoa} className="flex items-center justify-between gap-3 text-xs text-on-surface">
              {ten}
              <input
                type="number"
                step={buoc}
                value={nguong[khoa]}
                onChange={(e) => setNguong({ ...nguong, [khoa]: Number(e.target.value) })}
                className="w-24 bg-surface rounded-lg border border-outline-variant px-2 py-1 text-right text-on-surface"
              />
            </label>
          ))}
          <p className="text-[11px] text-on-surface-variant">Kết nối kênh bị dừng hoặc có hoá đơn thì luôn nhắn.</p>
          {thongBao && <p className="text-[11px] text-primary">{thongBao}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setNguong((await api.admin.luuNguongChiPhi(nguong)).data);
                  setThongBao('Đã lưu.');
                  void tai();
                } catch (error) {
                  setThongBao(error instanceof ApiError ? error.message : 'Chưa lưu được');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.admin.thuCanhBaoChiPhi();
                  setThongBao('Đã gửi thử tới Telegram của bạn.');
                } catch (error) {
                  setThongBao(error instanceof ApiError ? error.message : 'Chưa gửi được');
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold"
            >
              Gửi thử
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

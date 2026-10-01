import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type LocLuot, type LuotChiPhi } from '../lib/api';
import { chiDu, mauChi } from '../lib/tien-chi';

/**
 * Nhật ký từng lượt AI bị tính tiền — lớp CON của khối chi phí, chỉ mở khi bấm.
 *
 * Mỗi dòng: lúc nào (tới giây), tài khoản nào, việc gì, tốn bao nhiêu, và đã
 * khớp với số nhà cung cấp chốt chưa. Đây là căn cứ tính tiền từng tài khoản.
 */

const NHAN_DOI_CHIEU: Record<LuotChiPhi['doiChieu'], { ky: string; mau: string; giai: string }> = {
  khop: { ky: 'check_circle', mau: 'text-green-400', giai: 'Khớp đúng số nhà cung cấp chốt' },
  cho: { ky: 'schedule', mau: 'text-amber-400', giai: 'Nhà cung cấp chưa chốt số (thường vài phút)' },
  lech: { ky: 'error', mau: 'text-red-400', giai: 'Lệch với số nhà cung cấp chốt' },
  khong_ma: { ky: 'remove', mau: 'text-on-surface-variant', giai: 'Ghi trước khi sổ lưu mã giao dịch — không tra lại được' },
};

/** "01/10 13:08:21" theo giờ Việt Nam — ngày trước, giờ sau, tới giây. */
const gio = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}:${p.second}`;
};

export default function NhatKyChiPhi({ loc, tieuDe, onDong }: { loc: LocLuot; tieuDe: string; onDong: () => void }) {
  const [trang, setTrang] = useState(1);
  const [du, setDu] = useState<{ luot: LuotChiPhi[]; tongLan: number; tongUsd: number; soTrang: number } | null>(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    let huy = false;
    setDu(null);
    api.admin
      .luotChiPhi({ ...loc, trang })
      .then(({ data }) => !huy && setDu(data))
      .catch((error) => !huy && setLoi(error instanceof ApiError ? error.message : 'Chưa tải được nhật ký'));
    return () => {
      huy = true;
    };
  }, [loc, trang]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onDong} />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface-container-high border border-outline-variant rounded-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">{tieuDe}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 tabular-nums">
              {du ? (
                <>
                  {du.tongLan.toLocaleString('vi-VN')} lượt · <span className={mauChi(du.tongUsd)}>{chiDu(du.tongUsd)}</span> · tháng này
                </>
              ) : (
                'Đang tải…'
              )}
            </p>
          </div>
          <button type="button" onClick={onDong} className="material-symbols-outlined text-on-surface-variant hover:text-on-surface">
            close
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-outline-variant/50">
          {loi && <p className="p-5 text-xs text-red-400">{loi}</p>}
          {du && du.luot.length === 0 && <p className="p-5 text-xs text-on-surface-variant">Chưa có lượt nào.</p>}
          {du?.luot.map((l) => {
            const dc = NHAN_DOI_CHIEU[l.doiChieu];
            return (
              <div key={l.id} className="px-5 py-2.5 flex items-start gap-3 text-xs">
                <span className="w-[7.5rem] shrink-0 text-on-surface-variant tabular-nums pt-px">{gio(l.luc)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-on-surface font-medium truncate">{l.tenViec}</span>
                  <span className="block text-on-surface-variant truncate">
                    {l.taiKhoan} · {l.model.split('/').pop()}
                    {l.tokenVao + l.tokenRa > 0 && ` · ${(l.tokenVao + l.tokenRa).toLocaleString('vi-VN')} token`}
                  </span>
                  {l.loi && <span className="block text-amber-400">Bị tính tiền nhưng hỏng: {l.loi}</span>}
                  {l.doiChieu === 'lech' && (
                    <span className="block text-red-400">Lúc gọi báo {chiDu(l.usdLucGoi)}, nhà cung cấp chốt {chiDu(l.usdNhaCungCap)}</span>
                  )}
                </span>
                <span className={clsx('shrink-0 font-bold tabular-nums', mauChi(l.usd))}>{chiDu(l.usd)}</span>
                <span title={dc.giai} className={clsx('material-symbols-outlined text-[16px] shrink-0', dc.mau)}>
                  {dc.ky}
                </span>
              </div>
            );
          })}
        </div>

        {du && du.soTrang > 1 && (
          <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-between text-xs shrink-0">
            <button type="button" disabled={trang <= 1} onClick={() => setTrang(trang - 1)} className="text-primary disabled:text-on-surface-variant/40">
              ‹ Mới hơn
            </button>
            <span className="text-on-surface-variant tabular-nums">
              Trang {trang}/{du.soTrang}
            </span>
            <button type="button" disabled={du.soTrang <= trang} onClick={() => setTrang(trang + 1)} className="text-primary disabled:text-on-surface-variant/40">
              Cũ hơn ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

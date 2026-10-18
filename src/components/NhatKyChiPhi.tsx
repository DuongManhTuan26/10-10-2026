import { useEffect, useState, type Key } from 'react';
import HopThoai from './HopThoai';
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
  khong_ma: { ky: 'remove', mau: 'text-on-surface-variant', giai: 'Không có mã giao dịch nên không tra lại từng lượt được (dòng ghi trước 01/10 hoặc dòng ghi bù)' },
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

export default function NhatKyChiPhi({
  loc,
  tieuDe,
  onDong,
}: {
  loc: LocLuot;
  tieuDe: string;
  onDong: () => void;
}) {
  const [trang, setTrang] = useState(1);
  const [du, setDu] = useState<{ luot: LuotChiPhi[]; tongLan: number; tongUsd: number; soTrang: number } | null>(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    let huy = false;
    setDu(null);
    api.admin.luotChiPhi({ ...loc, trang })
      .then(({ data }) => !huy && setDu(data))
      .catch((error) => !huy && setLoi(error instanceof ApiError ? error.message : 'Chưa tải được nhật ký'));
    return () => {
      huy = true;
    };
  }, [loc, trang]);

  return (
    <HopThoai
      bieuTuong="receipt_long"
      tieuDe={tieuDe}
      phuDe={
        du ? (
          <span className="tabular-nums">
            {du.tongLan.toLocaleString('vi-VN')} lượt · <span className={mauChi(du.tongUsd)}>{chiDu(du.tongUsd)}</span> · tháng này
          </span>
        ) : (
          'Đang tải…'
        )
      }
      onDong={onDong}
      chan={du && du.soTrang > 1 ? (
          <div className="w-full flex items-center justify-between text-sm">
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
      ) : undefined}
    >
        <div className="-mx-6 sm:-mx-8 -my-6 divide-y divide-outline-variant/60">
          {loi && <p className="px-8 py-5 text-sm text-red-400">{loi}</p>}
          {du && du.luot.length === 0 && <p className="px-8 py-5 text-sm text-on-surface-variant">Chưa có lượt nào.</p>}
          {du?.luot.map((l) => (
            <DongLuot key={l.id} l={l} className="px-6 sm:px-8" />
          ))}
        </div>
    </HopThoai>
  );
}

/** Một lượt bị tính tiền — DÙNG CHUNG cho nhật ký chi phí và sao kê từng trang (màn hình quản lý). */
export function DongLuot({ l, className }: { l: LuotChiPhi; className?: string; key?: Key }) {
  const dc = NHAN_DOI_CHIEU[l.doiChieu];
  return (
    <div className={clsx('py-3 flex items-start gap-3 sm:gap-4 text-sm', className)}>
      {/* Điện thoại: giờ nằm trên tên việc cho đủ chỗ số tiền. */}
      <span className="hidden sm:block w-[9.5rem] shrink-0 text-on-surface-variant tabular-nums pt-px">{gio(l.luc)}</span>
      <span className="flex-1 min-w-0">
        <span className="sm:hidden block text-xs text-on-surface-variant tabular-nums">{gio(l.luc)}</span>
        <span className="block text-on-surface font-medium break-words sm:truncate">{l.tenViec}</span>
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
      <span title={dc.giai} className={clsx('material-symbols-outlined text-[20px] shrink-0', dc.mau)}>
        {dc.ky}
      </span>
    </div>
  );
}

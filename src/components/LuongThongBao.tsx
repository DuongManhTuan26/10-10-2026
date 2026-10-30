/**
 * Sơ đồ "Luồng thông báo" — sợi nối phát sáng kiểu Tổng quan (chủ dự án 23/10/2026), dữ liệu từ luongThongBao (đúng loại
 * tin máy chủ gửi thật). Đường CHẠY (dong-chay) = loại tin đó đang được gửi; đường đứt mờ tĩnh = đang không gửi. Quầng
 * sáng chỉ báo trạng thái, không trang trí (luật .dong-chay trong index.css).
 */
import { clsx } from 'clsx';
import type { DongThongBao } from '../lib/luong-thong-bao';
import { bienThe } from '../lib/bon-ai';

export default function LuongThongBao({ dong, noiNhan }: { dong: DongThongBao[]; noiNhan: string | null }) {
  const coChay = dong.some((d) => d.chay);
  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-0">
      <ul className="flex-1 min-w-0 space-y-2">
        {dong.map((d) => (
          <li key={d.ma} className="flex items-center gap-2 sm:gap-0 min-w-0">
            <div
              className="o-trong flex items-center gap-2.5 px-3 py-2 min-w-0 sm:w-[260px] flex-1 sm:flex-none"
              style={bienThe(d.mau)}
            >
              <span
                className="w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-black font-mono shrink-0"
                style={{ color: d.mau, borderColor: d.mau }}
              >
                {d.so ?? '•'}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold truncate" style={{ color: d.mau }}>{d.nguon}</span>
                <span className="block text-sm font-bold text-on-surface truncate">{d.ten}</span>
              </span>
            </div>
            <svg className="hidden sm:block flex-1 h-3 min-w-[24px]" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M0 3 H100"
                className={d.chay ? 'dong-chay' : 'duong-nen'}
                stroke={d.mau}
                strokeDasharray={d.chay ? undefined : '3 7'}
                vectorEffect="non-scaling-stroke"
                style={d.chay ? { filter: `drop-shadow(0 0 4px ${d.mau})` } : undefined}
              />
            </svg>
            <span
              className={clsx('sm:hidden w-2.5 h-2.5 rounded-full shrink-0', !d.chay && 'opacity-30')}
              style={{ background: d.mau, boxShadow: d.chay ? `0 0 8px ${d.mau}` : undefined }}
              title={d.chay ? 'Đang gửi' : 'Đang không gửi'}
            />
          </li>
        ))}
      </ul>
      {/* Nơi nhận: thanh dọc gom mọi sợi nối + ô Telegram. */}
      <div className="flex sm:items-center">
        <div className={clsx('hidden sm:block w-[3px] self-stretch rounded-full', coChay ? 'bg-primary' : 'bg-outline-variant')}
          style={coChay ? { boxShadow: '0 0 12px var(--color-primary)' } : undefined} />
        <div className="the flex-1 sm:flex-none sm:w-[220px] sm:ml-4 p-4 flex items-center gap-3" style={{ ['--nhan' as string]: '#2AABEE' }}>
          <span className="o-bieu-tuong shrink-0"><span className="material-symbols-outlined text-[20px]">send</span></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-on-surface">Telegram</span>
            <span className="block text-xs text-on-surface-variant truncate">
              {noiNhan ? `Gửi tới: ${noiNhan}` : 'Chưa kết nối — chưa gửi được tin nào'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

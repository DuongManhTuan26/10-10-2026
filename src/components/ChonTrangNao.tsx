/**
 * Ô CHỌN TRANG = chọn BỘ NÃO AI (chủ dự án 10/10/2026). Đặt ở đầu khối "Bộ não AI" trong menu chính — bản cũ nằm sát
 * chữ LOGO, nhỏ, chủ dự án tưởng là dòng chữ trang trí, không biết là tính năng quan trọng.
 *
 * Liệt kê theo TRANG (mỗi trang ghi các kênh của nó): Fanpage, Instagram, TikTok của cùng một trang dùng CHUNG một bộ
 * não. "Tất cả trang" chỉ dành cho màn hình chung (Bảng điều khiển, Hộp thư, Đơn hàng); 4 mục AI bắt chọn một trang.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useActivePage, PLATFORM_BADGE } from '../lib/ActivePage';

export default function ChonTrangNao() {
  const { trangs, trangDangChon, chonTrang } = useActivePage();
  const [mo, setMo] = useState(false);
  const khung = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Bấm ra ngoài thì đóng.
  useEffect(() => {
    if (!mo) return;
    const dong = (e: MouseEvent) => { if (khung.current && !khung.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', dong);
    return () => document.removeEventListener('mousedown', dong);
  }, [mo]);

  const soKenh = (t: (typeof trangs)[number]) => t.kenh.filter((k) => k.connected).length;

  return (
    <div ref={khung} className="relative">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-300',
          trangDangChon
            ? 'border-[#00e5ff]/40 bg-[#00e5ff]/10 shadow-[0_0_18px_rgba(0,229,255,0.12)]'
            : 'border-amber-400/50 bg-amber-400/10'
        )}
      >
        <span className={clsx('material-symbols-outlined text-[22px] shrink-0', trangDangChon ? 'text-[#00e5ff]' : 'text-amber-400')}>storefront</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#E8EDF2]/60">Trang đang làm việc</span>
          <span className="block text-[15px] font-bold text-white truncate">
            {trangDangChon ? trangDangChon.ten : trangs.length ? 'Tất cả trang — chọn một trang' : 'Chưa có trang nào'}
          </span>
          {trangDangChon && (
            <span className="block text-[11px] text-[#E8EDF2]/60 truncate">{soKenh(trangDangChon)} kênh · bộ não riêng của trang</span>
          )}
        </span>
        <span className="material-symbols-outlined text-[#E8EDF2] text-[20px] shrink-0">{mo ? 'expand_less' : 'expand_more'}</span>
      </button>

      {mo && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-outline-variant bg-noi backdrop-blur-xl shadow-[0_0_24px_rgba(0,229,255,0.15)] overflow-hidden max-h-[60vh] overflow-y-auto">
          {trangs.length > 1 && (
            <button
              type="button"
              onClick={() => { chonTrang(null); setMo(false); }}
              className={clsx('w-full px-3 py-2.5 text-left transition-colors hover:bg-[#00e5ff]/10 border-b border-white/5', !trangDangChon && 'bg-[#00e5ff]/10')}
            >
              <span className={clsx('block text-[13px] font-semibold', !trangDangChon ? 'text-[#00e5ff]' : 'text-[#E8EDF2]')}>Tất cả trang</span>
              <span className="block text-[11px] text-[#E8EDF2]/50">Chỉ cho Bảng điều khiển, Hộp thư, Đơn hàng — 4 mục AI cần chọn một trang</span>
            </button>
          )}
          {trangs.map((t) => {
            const dangChon = trangDangChon?.khoa === t.khoa;
            return (
              <button
                key={t.khoa}
                type="button"
                onClick={() => { chonTrang(t.khoa); setMo(false); }}
                className={clsx('w-full px-3 py-2.5 text-left transition-colors hover:bg-[#00e5ff]/10 border-b border-white/5 last:border-b-0', dangChon && 'bg-[#00e5ff]/10')}
              >
                <span className={clsx('block text-[14px] font-bold truncate', dangChon ? 'text-[#00e5ff]' : 'text-white')}>{t.ten}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {t.kenh.map((k) => (
                    <span key={k.id} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-[#E8EDF2]/80">
                      <span className="font-mono text-[9px] text-white/70">{PLATFORM_BADGE[k.platform] ?? '?'}</span>
                      <span className="truncate max-w-[110px]">{k.display_name || k.username}</span>
                      {!k.connected && <span className="text-[9px] font-bold text-[#ef4444]">MẤT KẾT NỐI</span>}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
          {trangs.length === 0 && (
            <button type="button" onClick={() => { setMo(false); navigate('/connections'); }}
              className="w-full px-3 py-3 text-left text-[13px] text-[#00e5ff] font-semibold hover:bg-[#00e5ff]/10 transition-colors">
              + Kết nối trang đầu tiên
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Chốt "bộ não của MỘT trang" cho 4 mục AI (chủ dự án 10/10/2026): đang "Tất cả trang" mà có nhiều trang thì KHÔNG
 * mở màn hình AI (làm trộn nhiều bộ não) — hiện danh sách trang để chọn một. Chỉ một trang thì luôn là trang đó.
 */
import type { ReactNode } from 'react';
import { useActivePage, PLATFORM_BADGE } from '../lib/ActivePage';

export default function CanTrangNao({ ten, children }: { ten: string; children: ReactNode }) {
  const { trangs, canChonTrang, chonTrang } = useActivePage();
  if (!canChonTrang) return <>{children}</>;
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-high p-6">
        <div className="flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-primary">psychology</span>
          <h2 className="text-lg font-bold">{ten} làm việc theo bộ não của MỘT cửa hàng</h2>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Mỗi cửa hàng có bộ não AI riêng (viết bài, quảng cáo, bán hàng, điều hành). Chọn cửa hàng muốn làm việc:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {trangs.map((t) => (
            <button key={t.khoa} type="button" onClick={() => chonTrang(t.khoa)}
              className="text-left rounded-xl border border-outline-variant bg-surface-container px-4 py-3 hover:border-primary transition-colors">
              <span className="block font-bold text-on-surface truncate">{t.ten}</span>
              <span className="mt-1.5 flex flex-wrap gap-1">
                {t.kenh.map((k) => (
                  <span key={k.id} className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                    <span className="font-mono text-[9px]">{PLATFORM_BADGE[k.platform] ?? '?'}</span>
                    <span className="truncate max-w-[140px]">{k.display_name || k.username}</span>
                    {!k.connected && <span className="text-[9px] font-bold text-red-400">MẤT KẾT NỐI</span>}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/**
 * Gom việc QUẢN LÝ TÀI KHOẢN vào một nút.
 *
 * Vì sao tách: thẻ mỗi trang phải đọc được tình trạng VẬN HÀNH trong một cái
 * liếc — đơn hôm nay, khách đang chờ, AI dạy chưa, tuần qua có chạy không.
 * Bày thêm bốn nút đổi tên / mật khẩu / khoá / xoá ngay cạnh đó thì mắt phải
 * lọc qua đống nút mới thấy được số, mà bốn việc ấy mỗi tháng dùng một lần.
 *
 * Nay chỉ còn "Mở trang" đứng ngoài — việc làm hàng ngày — còn lại nằm sau dấu
 * ba chấm, bấm mới hiện.
 */

export interface MucMenu {
  ten: string;
  onChon: () => void;
  /** Việc không lấy lại được thì tô đỏ và tách xuống dưới cùng. */
  nguyHiem?: boolean;
}

/** Bề ngang menu. Dùng cả khi dựng khung lẫn khi tính còn chỗ hay không. */
const RONG_MENU = 208;

export default function MenuQuanLyTrang({ muc, tat, tieuDe = 'Quản lý tài khoản', nhan = 'Quản lý tài khoản cửa hàng' }: {
  muc: MucMenu[];
  tat?: boolean;
  /** Dòng đầu menu (mặc định cho thẻ trang ở Quản lý). */
  tieuDe?: string;
  /** Chữ đọc cho nút ⋯ (title + aria-label). */
  nhan?: string;
}) {
  const [mo, setMo] = useState(false);
  /*
   * Thả sang trái hay sang phải của nút — quyết định lúc MỞ, bằng cách đo.
   *
   * Thử bằng breakpoint trước rồi và sai: vấn đề không phải bề rộng màn hình
   * mà là VỊ TRÍ CỦA NÚT trên màn. Cụm nút xuống dòng về sát mép trái thì dù
   * màn rộng bao nhiêu, menu neo bên phải vẫn tràn ra ngoài và bị cắt mất chữ
   * — đã nhìn thấy đúng như vậy.
   */
  const [thaSangPhai, setThaSangPhai] = useState(true);
  const khung = useRef<HTMLDivElement>(null);

  /*
   * Bấm ra ngoài hoặc bấm Escape là đóng. Không có thì mở menu của trang này
   * rồi bấm sang trang khác là hai menu cùng mở, không biết đang thao tác lên
   * trang nào — đúng kiểu nhầm nguy hiểm nhất ở màn hình nhiều trang.
   */
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (khung.current && !khung.current.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('keydown', phim);
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('keydown', phim);
    };
  }, [mo]);

  return (
    <div className="relative" ref={khung}>
      <button
        onClick={() => {
          const o = khung.current?.getBoundingClientRect();
          // Không đủ chỗ bên trái thì thả sang phải, và ngược lại.
          if (o) setThaSangPhai(o.right - RONG_MENU >= 8);
          setMo((m) => !m);
        }}
        disabled={tat}
        title={nhan}
        aria-label={nhan}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-primary transition-colors disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[20px]">more_vert</span>
      </button>

      {mo && (
        <div
          style={{ width: RONG_MENU }}
          className={clsx(
            'absolute top-11 z-20 rounded-xl border border-outline-variant bg-noi shadow-xl py-1',
            thaSangPhai ? 'right-0' : 'left-0'
          )}
        >
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            {tieuDe}
          </div>
          {muc.map((m) => (
            <button
              key={m.ten}
              onClick={() => { setMo(false); m.onChon(); }}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                m.nguyHiem
                  ? 'text-error hover:bg-error/10 border-t border-outline-variant mt-1'
                  : 'text-on-surface hover:bg-surface-variant'
              )}
            >
              {m.ten}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

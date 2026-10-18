import { useState } from 'react';
import { clsx } from 'clsx';
import { MAU_THUONG_HIEU } from '../lib/bon-ai';

export interface TrangChon {
  id: number;
  ten: string;
  soKenh: number;
  /** Nền tảng cửa hàng đã có (ngăn đã đầy) — mỗi cửa hàng một tài khoản mỗi nền tảng. */
  nenTang: string[];
  /** Có hộp (hồ sơ) riêng — cửa hàng cũ dùng chung hộp thì không nhận kênh. */
  hopRieng: boolean;
}

/**
 * CHỌN TRANG BÁN HÀNG cho một kênh — dùng chung cho "Kết nối kênh mới" và "Chuyển sang trang bán hàng khác".
 *
 * Chủ dự án 17/10/2026: kênh vào trang nào do chủ shop TỰ CHỌN, không có mặc định; không có trang hợp thì tạo trang
 * mới với tên tự gõ (như Sprout Social bắt chọn "In Group" lúc nối kênh). Vì vậy KHÔNG chọn sẵn ô nào.
 * Cửa hàng đã có cùng nền tảng thì vẫn hiện nhưng khoá, kèm lý do (mỗi cửa hàng một hộp, mỗi nền tảng một ngăn —
 * chủ dự án chốt 17/10/2026) — không để bấm rồi mới bị từ chối.
 */
export default function ChonTrangBanHang({
  ds,
  platformKey,
  tenNenTang,
  giaTri,
  onChon,
  onTaoMoi,
  boQua,
}: {
  ds: TrangChon[];
  platformKey: string;
  tenNenTang: string;
  giaTri: number | null;
  onChon: (id: number) => void;
  /** Tạo trang mới rồi trả về để chọn luôn; ném lỗi thì hiện lỗi ngay dưới ô nhập. */
  onTaoMoi: (ten: string) => Promise<void>;
  /** Trang kênh đang ở (khi chuyển kênh) — không liệt kê. */
  boQua?: number | null;
}) {
  const [moTao, setMoTao] = useState(false);
  const [ten, setTen] = useState('');
  const [dangTao, setDangTao] = useState(false);
  const [loi, setLoi] = useState('');

  const tao = async () => {
    const t = ten.trim();
    if (!t) return;
    setDangTao(true);
    setLoi('');
    try {
      await onTaoMoi(t);
      setMoTao(false);
      setTen('');
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Không tạo được cửa hàng');
    } finally {
      setDangTao(false);
    }
  };

  const hien = ds.filter((t) => t.id !== boQua);

  return (
    <div className="space-y-2.5">
      {hien.map((t) => {
        const lyDo = !t.hopRieng ? 'Cửa hàng cũ dùng chung hộp với cửa hàng khác — nên xoá và tạo cửa hàng mới.'
          : t.nenTang.includes(platformKey) ? `Đã có ${tenNenTang} — mỗi cửa hàng chỉ có một ${tenNenTang}.` : '';
        const chon = giaTri === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={!!lyDo}
            onClick={() => onChon(t.id)}
            aria-pressed={chon}
            className={clsx('w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors',
              lyDo ? 'border-outline-variant opacity-60 cursor-not-allowed'
                : chon ? 'border-primary bg-primary/[0.08]' : 'border-outline-variant hover:border-primary/60 hover:bg-white/[0.03]')}
          >
            <span className={clsx('w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center', chon ? 'border-primary' : 'border-outline')}>
              {chon && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </span>
            <span className="o-bieu-tuong !w-9 !h-9 shrink-0" style={{ ['--nhan' as string]: chon ? MAU_THUONG_HIEU : '#94a3b8' }}>
              <span className="material-symbols-outlined text-[20px]">storefront</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-on-surface break-words">{t.ten}</span>
              <span className="block text-xs text-on-surface-variant">Cửa hàng · {t.soKenh} kênh</span>
              {lyDo && <span className="block text-xs text-canh-bao mt-0.5">⚠ {lyDo}</span>}
            </span>
          </button>
        );
      })}

      {moTao ? (
        <div className="p-3.5 rounded-xl border border-primary/60 space-y-2">
          <label className="block text-sm font-bold text-on-surface" htmlFor="ten-trang-moi">Tên cửa hàng mới</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="ten-trang-moi"
              autoFocus
              value={ten}
              maxLength={80}
              onChange={(e) => setTen(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') tao(); }}
              placeholder="Ví dụ: Shop mỹ phẩm Hà Nội"
              className="w-full sm:flex-1 h-10 shrink-0 px-3 rounded-lg bg-surface-container-high border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button type="button" onClick={tao} disabled={dangTao || !ten.trim()}
                className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-bold disabled:opacity-50">
                {dangTao ? 'Đang tạo…' : 'Tạo cửa hàng'}
              </button>
              <button type="button" onClick={() => { setMoTao(false); setLoi(''); }}
                className="h-10 px-4 rounded-lg border border-outline-variant text-sm font-bold text-on-surface">
                Huỷ
              </button>
            </div>
          </div>
          {loi && <p className="text-xs text-loi">Lỗi: {loi}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMoTao(true)}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-outline-variant text-left text-sm font-bold text-on-surface hover:border-primary/60 hover:bg-white/[0.03] transition-colors"
        >
          <span className="material-symbols-outlined text-[22px] text-primary">add_business</span>
          Tạo cửa hàng mới
        </button>
      )}
    </div>
  );
}

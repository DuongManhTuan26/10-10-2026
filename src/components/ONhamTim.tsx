import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type KetQuaTimNham } from '../lib/api';

/**
 * Ô TÌM TỈNH / SỞ THÍCH để nhắm khi đẩy bài (H9, TD-25). Gõ ≥ 2 ký tự, ngừng gõ 400 ms thì hỏi máy chủ (GET
 * /api/ads/tim-nham — máy chủ gọi bằng kênh quảng cáo của cửa hàng đang chọn và chỉ trả đúng loại). Chọn → thành chip, bấm ×
 * để bỏ. Chỉ chọn được từ kết quả tìm: mã tỉnh / sở thích là mã của Meta, gõ tay không gửi được.
 */
export const SO_KY_TU_TIM = 2;
export const CHO_GO_MS = 400;

export interface MucNham {
  ma: string;
  ten: string;
}

export default function ONhamTim({ loai, nhan, goiY, chon, doiChon, toiDa }: {
  loai: 'tinh' | 'so_thich';
  nhan: string;
  goiY: string;
  chon: MucNham[];
  doiChon: (ds: MucNham[]) => void;
  toiDa: number;
}) {
  const [q, setQ] = useState('');
  const [ketQua, setKetQua] = useState<KetQuaTimNham[]>([]);
  const [dangTim, setDangTim] = useState(false);
  const [loi, setLoi] = useState('');
  /** Lượt tìm mới nhất — kết quả của lượt cũ về muộn thì bỏ. */
  const luot = useRef(0);

  useEffect(() => {
    const tu = q.trim();
    setLoi('');
    if (tu.length < SO_KY_TU_TIM) {
      setKetQua([]);
      setDangTim(false);
      return;
    }
    const day = ++luot.current;
    setDangTim(true);
    const hen = setTimeout(() => {
      api.ads.timNham(loai, tu)
        .then(({ data }) => { if (day === luot.current) setKetQua(data.ketQua); })
        .catch((e) => { if (day === luot.current) { setKetQua([]); setLoi(e instanceof ApiError ? e.message : 'Không tìm được, vui lòng thử lại'); } })
        .finally(() => { if (day === luot.current) setDangTim(false); });
    }, CHO_GO_MS);
    return () => clearTimeout(hen);
  }, [q, loai]);

  const daDu = chon.length >= toiDa;
  const them = (k: KetQuaTimNham) => {
    if (daDu || chon.some((c) => c.ma === k.id)) return;
    doiChon([...chon, { ma: k.id, ten: k.name }]);
    setQ('');
    setKetQua([]);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">{nhan}</label>
      {chon.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {chon.map((c) => (
            <span key={c.ma} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-primary/15 border border-primary/40 text-sm font-bold text-primary">
              {c.ten}
              <button
                type="button"
                aria-label={`Bỏ ${c.ten}`}
                onClick={() => doiChon(chon.filter((x) => x.ma !== c.ma))}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/20"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={q}
          disabled={daDu}
          onChange={(e) => setQ(e.target.value)}
          placeholder={daDu ? `Đã chọn đủ ${toiDa}` : goiY}
          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary disabled:opacity-60"
        />
        {q.trim().length >= SO_KY_TU_TIM && (
          <div className="mt-1 bg-surface-container-high border border-outline-variant rounded-lg overflow-hidden">
            {dangTim ? (
              <p className="px-3 py-2 text-sm text-on-surface-variant">Đang tìm…</p>
            ) : loi ? (
              <p className="px-3 py-2 text-sm text-error">{loi}</p>
            ) : ketQua.length === 0 ? (
              <p className="px-3 py-2 text-sm text-on-surface-variant">Không thấy kết quả phù hợp</p>
            ) : (
              ketQua.map((k) => {
                const daChon = chon.some((c) => c.ma === k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    disabled={daChon}
                    onClick={() => them(k)}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 border-b border-outline-variant/40 last:border-b-0',
                      daChon ? 'text-on-surface-variant' : 'text-on-surface hover:bg-primary/10'
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-bold">{k.name}</span>
                      {k.path.length > 1 && <span className="text-on-surface-variant"> · {k.path.slice(0, -1).join(' › ')}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {daChon ? 'Đã chọn' : k.audienceSize !== null ? `≈ ${k.audienceSize.toLocaleString('vi-VN')} người` : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

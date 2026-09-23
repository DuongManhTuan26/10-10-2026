import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type BaoCaoTrang } from '../lib/api';

/**
 * Báo cáo chi tiết của một trang, mở ngay trong bảng điều hành.
 *
 * Chủ sản phẩm hỏi: không vào trang con vẫn xem được số liệu, thống kê, báo
 * cáo chứ? Trước đó là chưa — muốn xem kỹ phải bấm Mở trang, tức là rời khỏi
 * tài khoản quản lý, rồi lại phải quay ra.
 *
 * Đây là đúng những con số mà chính trang đó nhìn thấy ở bảng điều khiển và
 * trang thống kê của nó, cùng một cách tính. Khác ở chỗ CHỈ ĐỌC: muốn trả lời
 * khách hay sửa gì thì mới cần Mở trang.
 */

const soVN = (v: string | number | undefined): string =>
  Number(v ?? 0).toLocaleString('vi-VN');
const tienVN = (v: string | number | undefined): string => `${soVN(v)} đ`;

/** Tăng giảm so với kỳ trước. Kỳ trước bằng 0 thì không có gốc để so. */
function chenhLech(nay: string | undefined, truoc: string | undefined): number | null {
  const a = Number(nay ?? 0);
  const b = Number(truoc ?? 0);
  if (!b) return null;
  return Math.round(((a - b) / b) * 100);
}

function O({ nhan, gia, lech, phu }: {
  nhan: string; gia: string; lech?: number | null; phu?: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2.5">
      <div className="text-[11px] text-on-surface-variant uppercase tracking-wide">{nhan}</div>
      <div className="text-lg font-bold text-on-surface mt-0.5">{gia}</div>
      <div className="text-[11px] mt-0.5">
        {lech === null || lech === undefined ? (
          <span className="text-on-surface-variant">{phu ?? 'chưa có kỳ trước để so'}</span>
        ) : (
          <span className={clsx(lech >= 0 ? 'text-green-500' : 'text-error')}>
            {lech >= 0 ? '+' : ''}{lech}% so với kỳ trước
          </span>
        )}
      </div>
    </div>
  );
}

const KHOANG = [
  { ngay: 7, ten: '7 ngày' },
  { ngay: 30, ten: '30 ngày' },
  { ngay: 90, ten: '90 ngày' },
];

export default function BaoCaoTrangCon({ trangId, onDong }: {
  trangId: number;
  onDong: () => void;
}) {
  const [ngay, setNgay] = useState(7);
  const [bc, setBc] = useState<BaoCaoTrang | null>(null);
  const [loi, setLoi] = useState('');
  const [dangTai, setDangTai] = useState(true);

  const nap = useCallback(async () => {
    setDangTai(true);
    try {
      const { data } = await api.quanLy.baoCao(trangId, ngay);
      setBc(data);
      setLoi('');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được báo cáo');
    } finally {
      setDangTai(false);
    }
  }, [trangId, ngay]);

  useEffect(() => { nap(); }, [nap]);

  const s = bc?.so ?? {};
  const t = bc?.truoc ?? {};
  const hoiThoai = Number(s.hoi_thoai ?? 0);
  const don = Number(s.don ?? 0);
  // Tỷ lệ chốt: bao nhiêu phần trăm cuộc trò chuyện ra được đơn.
  const tyLeChot = hoiThoai > 0 ? Math.round((don / hoiThoai) * 100) : null;

  return (
    <div className="mt-4 border-t border-outline-variant pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          {KHOANG.map((k) => (
            <button
              key={k.ngay}
              onClick={() => setNgay(k.ngay)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                ngay === k.ngay
                  ? 'bg-primary/15 text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {k.ten}
            </button>
          ))}
        </div>
        <button onClick={onDong} className="text-sm text-on-surface-variant hover:text-on-surface">
          Thu gọn
        </button>
      </div>

      {loi && <div className="text-sm text-error mb-3">{loi}</div>}
      {dangTai && !bc ? (
        <div className="text-sm text-on-surface-variant">Đang tải báo cáo…</div>
      ) : (
        <>
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 mb-4">
            <O nhan="Doanh thu" gia={tienVN(s.doanh_thu)} lech={chenhLech(s.doanh_thu, t.doanh_thu)} />
            <O nhan="Đơn hàng" gia={soVN(s.don)} lech={chenhLech(s.don, t.don)} />
            <O
              nhan="Tỷ lệ chốt"
              gia={tyLeChot === null ? '—' : `${tyLeChot}%`}
              lech={null}
              phu={`${soVN(s.don)} đơn / ${soVN(s.hoi_thoai)} hội thoại`}
            />
            <O
              nhan="Đơn do AI chốt"
              gia={soVN(s.don_ai_chot)}
              lech={null}
              phu={`trên tổng ${soVN(s.don)} đơn`}
            />
            <O nhan="Hội thoại" gia={soVN(s.hoi_thoai)} lech={chenhLech(s.hoi_thoai, t.hoi_thoai)} />
            <O nhan="AI đã trả lời" gia={soVN(s.tin_ai)} lech={null} phu="tin nhắn" />
            <O
              nhan="Nhường người thật"
              gia={soVN(s.nhuong_nguoi)}
              lech={null}
              phu="lần AI giao lại cho người"
            />
            <O
              nhan="Khách mới"
              gia={soVN(s.khach_moi)}
              lech={null}
              phu={`${soVN(s.khach_co_sdt)} khách để lại số`}
            />
          </div>

          {(bc?.canGap.length ?? 0) > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">
                Khách đang chờ người ({bc!.canGap.length})
              </div>
              <div className="grid gap-1.5">
                {bc!.canGap.map((k) => (
                  <div key={k.id} className="text-sm text-on-surface flex flex-wrap gap-2">
                    <span className="font-medium">{k.customer_name || 'Khách chưa có tên'}</span>
                    <span className="text-on-surface-variant">
                      {k.handoff_reason || 'không rõ lý do'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">
              Đơn gần đây
            </div>
            {(bc?.donGanDay.length ?? 0) === 0 ? (
              <div className="text-sm text-on-surface-variant">Chưa có đơn hàng nào.</div>
            ) : (
              <div className="grid gap-1.5">
                {bc!.donGanDay.map((d) => (
                  <div key={d.code} className="text-sm flex flex-wrap gap-2 items-baseline">
                    <span className="font-mono text-xs text-on-surface-variant">{d.code}</span>
                    <span className="text-on-surface font-medium">
                      {d.customer_name || 'Khách chưa có tên'}
                    </span>
                    <span className="text-on-surface-variant">{d.product} ×{d.quantity}</span>
                    <span className="font-bold text-on-surface">{tienVN(d.total)}</span>
                    <span className="text-xs text-on-surface-variant">
                      {d.closed_by === 'ai' ? 'AI chốt' : 'người chốt'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Ba thẻ DÙNG CHUNG của khuôn 4 thẻ (KhuonAi): Kết quả · Hướng dẫn AI · Nhật ký. Một bản cho cả 4 AI — chỉ khác AI nào.
 * Thẻ "Đang làm" là phần riêng của từng AI (bài đăng, chiến dịch, hộp thư & đơn, chẩn đoán điều hành).
 *
 * Mọi số đọc theo TRANG ĐANG CHỌN (bộ não của trang đó) — máy chủ suy trang từ kênh đang chọn.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type MaAi, type NhatKyAi as DuLieuNhatKy, type SucKhoeTrang as DuLieuSucKhoe } from '../lib/api';
import { useActivePage } from '../lib/ActivePage';
import { aiTheoMa } from '../lib/bon-ai';
import SucKhoeTrang from './SucKhoeTrang';
import AITrainingModal from './AITrainingModal';

/** Kết quả: số liệu khâu của AI này do CODE THỐNG KÊ chấm (7 ngày gần so với 28 ngày trước của chính trang). */
export function KetQuaAi({ ai, them }: { ai: Exclude<MaAi, 'analytics'>; them?: ReactNode }) {
  const { activeTrangId } = useActivePage();
  const motAi = aiTheoMa(ai);
  const [du, setDu] = useState<DuLieuSucKhoe | null>(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    let huy = false;
    setDu(null);
    setLoi('');
    api.dieuHanh
      .sucKhoe()
      .then(({ data }) => !huy && setDu(data))
      .catch((e) => !huy && setLoi(e instanceof ApiError ? e.message : 'Chưa tải được số liệu'));
    return () => { huy = true; };
  }, [activeTrangId]);

  return (
    <div className="space-y-6">
      <div className={clsx('khung-muc', motAi.mau)}>
        <h3 className="tieu-de-muc dau-muc">Hiệu suất {motAi.ten}</h3>
        {loi ? (
          <p className="text-sm text-loi">{loi}</p>
        ) : !du ? (
          <p className="text-sm text-on-surface-variant">Đang chấm…</p>
        ) : (
          <SucKhoeTrang du={du} khau={motAi.khau as 'noi_dung' | 'quang_cao' | 'ban_hang'} />
        )}
      </div>
      {them}
    </div>
  );
}

/** Hướng dẫn AI: vai trò + tài liệu riêng của AI này trong bộ não trang này — thứ chủ shop đổi để điều hướng AI. */
export function HuongDanAi({ ai, them }: { ai: MaAi; them?: ReactNode }) {
  const motAi = aiTheoMa(ai);
  const { activeTrangId } = useActivePage();
  return (
    <div className="space-y-6">
      <div className={clsx('khung-muc', motAi.mau)}>
        <h3 className="tieu-de-muc dau-muc">Vai trò & tài liệu của {motAi.ten}</h3>
        {/* key: đổi trang là nạp lại đúng vai trò của bộ não trang mới. */}
        <div key={activeTrangId ?? 'chua-chon'}>
          <AITrainingModal kind={ai} aiName={motAi.ten} isOpen onClose={() => {}} noiTuyen />
        </div>
      </div>
      {them}
    </div>
  );
}

const TEN_BANG: Record<string, string> = {
  ai_configs: 'Cài đặt AI', ai_documents: 'Tài liệu', handoff_rules: 'Luật nhường người', guardrail_configs: 'Hàng rào an toàn',
  auto_scripts: 'Kịch bản bình luận', social_accounts: 'Kênh',
};
const TEN_NGUON: Record<string, string> = { nguoi_dung: 'Người dùng', he_thong: 'Hệ thống', ai_dieu_hanh: 'AI điều hành' };
const TEN_HANH_DONG = { them: 'Thêm', sua: 'Sửa', xoa: 'Xoá' } as const;

function tomTat(v: Record<string, unknown> | null): string {
  if (!v) return '';
  return Object.entries(v)
    .filter(([k]) => !['id', 'user_id', 'trang_id', 'created_at', 'updated_at'].includes(k))
    .map(([k, x]) => `${k}: ${typeof x === 'string' ? x : JSON.stringify(x)}`)
    .join(' · ')
    .slice(0, 300);
}

/** Nhật ký: việc AI đã tự làm + mọi thay đổi cài đặt / tài liệu / luật của AI này (ai đổi, lúc nào, từ gì sang gì). */
export function NhatKyAi({ ai }: { ai: MaAi }) {
  const { activeTrangId } = useActivePage();
  const [du, setDu] = useState<DuLieuNhatKy | null>(null);
  const [loi, setLoi] = useState('');
  const [moDong, setMoDong] = useState<number | null>(null);

  useEffect(() => {
    let huy = false;
    setDu(null);
    setLoi('');
    setMoDong(null);
    api.dieuHanh
      .nhatKy(ai)
      .then(({ data }) => !huy && setDu(data))
      .catch((e) => !huy && setLoi(e instanceof ApiError ? e.message : 'Chưa tải được nhật ký'));
    return () => { huy = true; };
  }, [ai, activeTrangId]);

  if (loi) return <p className="text-sm text-loi">{loi}</p>;
  if (!du) return <p className="text-sm text-on-surface-variant">Đang tải nhật ký…</p>;
  const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      {(ai === 'content' || ai === 'analytics') && (
        <div className="khung-muc mau-xam">
          <h3 className="tieu-de-muc dau-muc">{ai === 'content' ? 'Việc AI đã tự làm theo lịch' : 'Các lần AI điều hành chẩn đoán'}</h3>
          {ai === 'content' && (
            <p className="text-[12px] text-on-surface-variant mb-2">Lịch tự đăng ghi theo tài khoản — gồm mọi cửa hàng của tài khoản này.</p>
          )}
          {du.viec.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Chưa có việc nào.</p>
          ) : (
            <div className="divide-y divide-outline-variant/60 rounded-xl border border-outline-variant bg-surface text-sm">
              {du.viec.map((v, i) => (
                <div key={i} className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="w-32 shrink-0 tabular-nums text-on-surface-variant">{gio(v.luc)}</span>
                  <span className="flex-1 min-w-[12rem] text-on-surface">{v.noi_dung || '—'}</span>
                  <span className={clsx('text-[11px] font-bold rounded px-1.5 py-px',
                    /ok|duyet|thuc_hien/.test(v.trang_thai) ? 'bg-green-500/15 text-green-400'
                      : /failed|loi|bac/.test(v.trang_thai) ? 'bg-red-500/15 text-red-400'
                        : 'bg-surface-container-highest text-on-surface-variant')}>{v.trang_thai}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="khung-muc mau-lam">
        <h3 className="tieu-de-muc dau-muc">Thay đổi cài đặt, tài liệu, luật</h3>
        {du.thayDoi.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Chưa có thay đổi nào được ghi.</p>
        ) : (
          <div className="divide-y divide-outline-variant/60 rounded-xl border border-outline-variant bg-surface text-sm">
            {du.thayDoi.map((d, i) => (
              <button key={i} type="button" onClick={() => setMoDong(moDong === i ? null : i)} className="w-full text-left px-4 py-2 hover:bg-surface-container">
                <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                  <span className="w-32 shrink-0 tabular-nums text-on-surface-variant">{gio(d.luc)}</span>
                  <span className="flex-1 min-w-[12rem] text-on-surface">
                    {TEN_HANH_DONG[d.hanh_dong]} · {TEN_BANG[d.bang] ?? d.bang}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">{d.nguon ? TEN_NGUON[d.nguon] ?? d.nguon : 'Chưa rõ ai đổi'}</span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{moDong === i ? 'expand_less' : 'expand_more'}</span>
                </div>
                {moDong === i && (
                  <div className="mt-2 pl-0 md:pl-[8.75rem] space-y-1 text-[12px] break-words">
                    {d.truoc && <div><span className="text-red-400 font-bold">Trước:</span> <span className="text-on-surface-variant">{tomTat(d.truoc)}</span></div>}
                    {d.sau && <div><span className="text-green-400 font-bold">Sau:</span> <span className="text-on-surface-variant">{tomTat(d.sau)}</span></div>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

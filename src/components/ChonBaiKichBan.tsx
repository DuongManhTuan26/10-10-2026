import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError } from '../lib/api';
import { useActivePage } from '../lib/ActivePage';
import { NUT_PHU } from './HopThoai';

type Kenh = { id: string; ten: string; platform: string; chonDuoc: boolean };
type Bai = { id: string; noiDung: string; anh: string | null; link: string | null; ngay: string | null; soBinhLuan: number };

/** Khớp TOI_DA_BAI của máy chủ (server/services/kich-ban-ap-dung.ts). */
const TOI_DA = 100;

/**
 * Chọn bài THẬT cho kịch bản "Chỉ một số bài cụ thể" (062). Bản cũ chỉ có chữ "Chọn bài đăng..." mà kịch bản vẫn chạy
 * ở mọi bài. Chỉ Facebook chọn được; Instagram và bài quảng cáo ghi rõ là chưa chọn được ở đây.
 */
export default function ChonBaiKichBan({ chon, doiChon }: { chon: string[]; doiChon: (ds: string[]) => void }) {
  const { activeTrangId } = useActivePage();
  const [dsKenh, setDsKenh] = useState<Kenh[]>([]);
  const [kenh, setKenh] = useState<string | null>(null);
  const [bai, setBai] = useState<Bai[]>([]);
  const [tiepTheo, setTiepTheo] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');

  const tai = async (maKenh: string | null, cursor?: string) => {
    setDangTai(true);
    setLoi('');
    try {
      const { data } = await api.settings.baiDeChon(maKenh ?? undefined, cursor);
      setDsKenh(data.kenh);
      setKenh(data.kenhDangXem);
      setBai((truoc) => (cursor ? [...truoc, ...data.bai.filter((b) => !truoc.some((t) => t.id === b.id))] : data.bai));
      setTiepTheo(data.tiepTheo);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa tải được danh sách bài');
    } finally {
      setDangTai(false);
    }
  };

  useEffect(() => {
    setBai([]);
    setTiepTheo(null);
    void tai(null);
  }, [activeTrangId]);

  const bat = (id: string) => {
    if (chon.includes(id)) doiChon(chon.filter((x) => x !== id));
    else if (chon.length < TOI_DA) doiChon([...chon, id]);
  };
  const ngoaiDanhSach = chon.filter((id) => !bai.some((b) => b.id === id)).length;

  return (
    <div className="space-y-3">
      {dsKenh.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {dsKenh.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={!k.chonDuoc || dangTai}
              onClick={() => { setBai([]); setTiepTheo(null); void tai(k.id); }}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                kenh === k.id ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant',
                !k.chonDuoc && 'opacity-60 cursor-not-allowed'
              )}
            >
              {k.ten}{k.chonDuoc ? '' : ' · Instagram: sắp có'}
            </button>
          ))}
        </div>
      )}

      {loi && <p className="text-xs text-loi">{loi}</p>}
      {!loi && !dangTai && dsKenh.every((k) => !k.chonDuoc) && (
        <p className="text-xs text-on-surface-variant">
          Cửa hàng này chưa có Fanpage nào để chọn bài. Chọn bài cụ thể hiện làm được cho Facebook; Instagram sắp có.
        </p>
      )}

      {bai.length > 0 && (
        <div className="max-h-72 overflow-y-auto divide-y divide-outline-variant/60 rounded-lg border border-outline-variant bg-surface-container-high">
          {bai.map((b) => (
            <label key={b.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-surface-container">
              <input type="checkbox" checked={chon.includes(b.id)} onChange={() => bat(b.id)} className="mt-1 accent-primary" />
              {b.anh ? (
                <img src={b.anh} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              ) : (
                <span className="material-symbols-outlined w-10 h-10 shrink-0 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center text-[20px]">article</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-on-surface line-clamp-2">{b.noiDung || '(Bài không có chữ)'}</span>
                <span className="block text-[11px] text-on-surface-variant">
                  {b.ngay ? new Date(b.ngay).toLocaleDateString('vi-VN') : ''} · {b.soBinhLuan} bình luận
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={clsx('text-xs font-bold', chon.length ? 'text-primary' : 'text-on-surface-variant')}>
          Đã chọn {chon.length} bài{chon.length >= TOI_DA ? ` (tối đa ${TOI_DA})` : ''}
          {ngoaiDanhSach > 0 ? ` · ${ngoaiDanhSach} bài chọn trước chưa hiện trong danh sách đang xem` : ''}
        </span>
        {tiepTheo && (
          <button type="button" disabled={dangTai} onClick={() => void tai(kenh, tiepTheo)} className={NUT_PHU}>
            {dangTai ? 'Đang tải…' : 'Xem thêm bài'}
          </button>
        )}
      </div>
      {dangTai && bai.length === 0 && <p className="text-xs text-on-surface-variant">Đang tải bài…</p>}
      <p className="text-[11px] text-on-surface-variant">Bài quảng cáo chưa chọn được ở đây.</p>
    </div>
  );
}

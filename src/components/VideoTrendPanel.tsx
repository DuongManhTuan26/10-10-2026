import { useRef, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type MediaItem } from '../lib/api';
import VideoDaiPanel from './VideoDaiPanel';

/**
 * Trend → video: tải lên một video đang thịnh hành, AI rút ra công thức (cách
 * mở đầu, bố cục, nhịp, kiểu quay), rồi làm video MỚI cho sản phẩm của shop
 * theo công thức đó — không sao chép hình ảnh hay người trong video gốc.
 */
export default function VideoTrendPanel({
  noiDung,
  anhCoSan,
  doNet,
  khung,
  coTieng,
  onGanVaoBai,
}: {
  noiDung: string;
  anhCoSan: string[];
  doNet: string;
  khung: string;
  coTieng: boolean;
  onGanVaoBai: (item: MediaItem) => void;
}) {
  const [nguon, setNguon] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [dangPhanTich, setDangPhanTich] = useState(false);
  const [ketQua, setKetQua] = useState<{ congThuc: string; tomTat: string[] } | null>(null);
  const [loi, setLoi] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const taiLen = async (f: File) => {
    setDangTai(true);
    setLoi('');
    setKetQua(null);
    try {
      const item = await api.posts.uploadMedia(f);
      if (item.type !== 'video') throw new ApiError('Tệp này không phải video', 400);
      setNguon(item.url);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được video lên');
    } finally {
      setDangTai(false);
    }
  };

  const phanTich = async () => {
    if (!nguon || dangPhanTich) return;
    setDangPhanTich(true);
    setLoi('');
    try {
      const { data } = await api.ai.phanTichTrend(nguon);
      setKetQua(data);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'AI chưa phân tích được video này');
    } finally {
      setDangPhanTich(false);
    }
  };

  return (
    <div className="space-y-3">
      {loi && <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>}

      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
        <label className="block text-xs font-bold text-on-surface">Bước 1 · Video trend muốn học theo</label>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Tải video trend về máy (từ TikTok, Reels, YouTube Shorts…) rồi đưa lên đây. AI chỉ học CÔNG THỨC — cách mở
          đầu, bố cục, nhịp, kiểu quay — rồi làm video hoàn toàn mới cho sản phẩm của bạn, không dùng lại hình ảnh
          hay người trong video gốc.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void taiLen(f);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={dangTai}
            className="px-3 py-1.5 rounded-lg border border-dashed border-outline-variant text-xs font-bold text-on-surface-variant hover:border-primary/50 disabled:opacity-50"
          >
            {dangTai ? 'Đang tải video lên…' : nguon ? 'Đổi video khác' : '+ Tải video trend lên'}
          </button>
          {nguon && (
            <button
              type="button"
              onClick={phanTich}
              disabled={dangPhanTich}
              className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/20 disabled:opacity-50"
            >
              <span className={clsx('material-symbols-outlined text-[16px]', dangPhanTich && 'animate-spin')}>
                {dangPhanTich ? 'progress_activity' : 'insights'}
              </span>
              {dangPhanTich ? 'AI đang xem video…' : 'AI phân tích trend'}
            </button>
          )}
        </div>
        {nguon && <video src={nguon} controls playsInline className="w-full max-h-64 rounded-lg bg-black" />}
      </div>

      {ketQua && (
        <>
          <div className="bg-surface-container rounded-xl p-4 border border-primary/40 space-y-2">
            <label className="block text-xs font-bold text-primary">Vì sao video này hút người xem</label>
            <ul className="list-disc pl-5 space-y-1">
              {ketQua.tomTat.map((y) => (
                <li key={y} className="text-xs text-on-surface leading-relaxed">{y}</li>
              ))}
            </ul>
          </div>
          <label className="block text-xs font-bold text-on-surface">Bước 2 · Làm video của bạn theo công thức này</label>
          <VideoDaiPanel
            loai="trend"
            noiDung={noiDung}
            anhCoSan={anhCoSan}
            doNet={doNet}
            khung={khung}
            coTieng={coTieng}
            congThucTrend={ketQua.congThuc}
            onGanVaoBai={onGanVaoBai}
          />
        </>
      )}
    </div>
  );
}

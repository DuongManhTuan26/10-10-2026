import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type MediaItem, type ModelSuaVideo, type ViecVideo } from '../lib/api';

/**
 * Video → video: sửa video chủ shop đã có — đổi bối cảnh, thêm bớt đồ vật, đổi
 * phong cách, làm nét. Model tính tiền theo giây đầu ra (bằng độ dài video
 * nguồn), nên đọc độ dài video ngay trên trình duyệt để báo giá trước.
 */

const TY_GIA = 25_500;
const GOI_Y = [
  'Đổi bối cảnh thành quán cà phê sang trọng, giữ nguyên người và sản phẩm',
  'Chuyển sang phong cách phim điện ảnh, màu ấm',
  'Thêm hoa tươi trên bàn, giữ nguyên mọi thứ khác',
  'Chuyển thành ban đêm với ánh đèn vàng ấm cúng',
];

function tien(usd: number): string {
  const vnd = Math.round((usd * TY_GIA) / 500) * 500;
  return `~${vnd.toLocaleString('vi-VN')}đ (${usd.toFixed(2)} USD)`;
}

export default function VideoSuaPanel({
  videoCoSan,
  onGanVaoBai,
}: {
  /** Video đang có trong bài, để chọn làm video nguồn. */
  videoCoSan: string[];
  onGanVaoBai: (item: MediaItem) => void;
}) {
  const [models, setModels] = useState<ModelSuaVideo[]>([]);
  const [modelChon, setModelChon] = useState('');
  const [nguon, setNguon] = useState('');
  const [soGiayNguon, setSoGiayNguon] = useState<number | null>(null);
  const [yeuCau, setYeuCau] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [viec, setViec] = useState<ViecVideo[]>([]);
  const [loi, setLoi] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const daGan = useRef(new Set<number>());

  useEffect(() => {
    api.ai
      .modelSuaVideo()
      .then(({ data }) => {
        setModels(data);
        setModelChon((cu) => cu || data[0]?.id || '');
      })
      .catch((error) => setLoi(error instanceof ApiError ? error.message : 'Chưa tải được model sửa video'));
  }, []);

  const conDangTao = viec.some((v) => v.trang_thai === 'dang_tao');
  useEffect(() => {
    let huy = false;
    const tai = async () => {
      try {
        const { data } = await api.ai.videoViec();
        if (!huy) setViec(data.filter((v) => v.la_sua_video));
      } catch {
        /* Lượt sau thử lại. */
      }
    };
    void tai();
    if (!conDangTao) return () => { huy = true; };
    const nhip = setInterval(tai, 10_000);
    return () => {
      huy = true;
      clearInterval(nhip);
    };
  }, [conDangTao]);

  const taiLen = async (f: File) => {
    setDangTai(true);
    setLoi('');
    try {
      const item = await api.posts.uploadMedia(f);
      if (item.type !== 'video') throw new ApiError('Tệp này không phải video', 400);
      setNguon(item.url);
      setSoGiayNguon(null);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được video lên');
    } finally {
      setDangTai(false);
    }
  };

  const model = models.find((m) => m.id === modelChon);
  const gia = model && soGiayNguon !== null ? Math.max(model.toiThieu, model.giaMoiGiay * soGiayNguon) : null;

  const gui = async () => {
    if (dangGui || !model || !nguon) return;
    if (!yeuCau.trim()) return setLoi('Viết muốn sửa video thế nào.');
    if (!confirm(`Sửa video bằng ${model.ten}?\n\nChi phí ước tính: ${gia === null ? 'đang đo độ dài video' : tien(gia)}.\nTiền bị trừ kể cả khi bạn không dùng video.`)) return;
    setDangGui(true);
    setLoi('');
    try {
      const { data } = await api.ai.suaVideo({ model: model.id, videoNguon: nguon, yeuCau });
      setViec((truoc) => [data, ...truoc]);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa gửi được yêu cầu sửa video');
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="space-y-3">
      {loi && <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>}

      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
        <label className="block text-xs font-bold text-on-surface">Video nguồn (tối đa 60 giây)</label>
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
          {videoCoSan.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setNguon(u);
                setSoGiayNguon(null);
              }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold border',
                nguon === u ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant text-on-surface-variant'
              )}
            >
              Video trong bài
            </button>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={dangTai}
            className="px-3 py-1.5 rounded-lg border border-dashed border-outline-variant text-xs font-bold text-on-surface-variant hover:border-primary/50 disabled:opacity-50"
          >
            {dangTai ? 'Đang tải video lên…' : '+ Tải video lên'}
          </button>
        </div>
        {nguon && (
          <video
            src={nguon}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setSoGiayNguon(e.currentTarget.duration)}
            className="w-full max-h-64 rounded-lg bg-black"
          />
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
        <label className="block text-xs font-bold text-on-surface">Muốn sửa thế nào</label>
        <div className="flex flex-wrap gap-2">
          {GOI_Y.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setYeuCau(g)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50"
            >
              {g}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={yeuCau}
          onChange={(e) => setYeuCau(e.target.value)}
          placeholder="Ví dụ: đổi nền thành bãi biển lúc hoàng hôn, giữ nguyên người và sản phẩm…"
          className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-3 text-sm text-on-surface focus:border-primary focus:outline-none resize-none"
        />
      </div>

      <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
        <label className="block text-xs font-bold text-on-surface">Model sửa video — xếp rẻ tới đắt</label>
        {models.map((m) => (
          <label
            key={m.id}
            className={clsx(
              'flex items-start gap-3 rounded-lg border px-3 py-2 text-xs cursor-pointer',
              modelChon === m.id ? 'border-primary bg-primary/10' : 'border-outline-variant hover:border-primary/50'
            )}
          >
            <input type="radio" name="model-sua" className="mt-0.5" checked={modelChon === m.id} onChange={() => setModelChon(m.id)} />
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-on-surface">{m.ten}</span>
              <span className="block text-on-surface-variant">
                {soGiayNguon !== null
                  ? tien(Math.max(m.toiThieu, m.giaMoiGiay * soGiayNguon))
                  : `${(m.giaMoiGiay * TY_GIA).toLocaleString('vi-VN')}đ mỗi giây`}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={gui}
        disabled={dangGui || !model || !nguon || !yeuCau.trim()}
        className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
      >
        <span className={clsx('material-symbols-outlined text-[18px]', dangGui && 'animate-spin')}>
          {dangGui ? 'progress_activity' : 'movie_edit'}
        </span>
        {dangGui ? 'Đang gửi…' : gia !== null ? `Sửa video — ${tien(gia)}` : 'Sửa video'}
      </button>

      {viec.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface">Video đã sửa</label>
          {viec.map((v) => (
            <div key={v.id} className="bg-surface-container rounded-xl p-3 border border-outline-variant space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-on-surface-variant truncate">{v.loi_mo_ta}</span>
                <span className={clsx('shrink-0 font-bold', v.trang_thai === 'xong' ? 'text-primary' : v.trang_thai === 'loi' ? 'text-error' : 'text-on-surface')}>
                  {v.trang_thai === 'xong' ? 'Xong' : v.trang_thai === 'loi' ? 'Lỗi' : 'Đang sửa…'}
                </span>
              </div>
              {v.trang_thai === 'xong' && v.url && (
                <>
                  <video src={v.url} controls playsInline className="w-full max-h-80 rounded-lg bg-black" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (daGan.current.has(v.id)) return;
                        daGan.current.add(v.id);
                        onGanVaoBai({ url: v.url!, type: 'video' });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
                    >
                      Gắn vào bài
                    </button>
                    <a href={v.url} download={`video-sua-${v.id}.mp4`} className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary">
                      Tải về máy
                    </a>
                  </div>
                </>
              )}
              {v.trang_thai === 'loi' && <p className="text-xs text-error">{v.loi}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

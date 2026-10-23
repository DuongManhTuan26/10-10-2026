import { useEffect, useRef, useState } from 'react';
import { LuatNoiDungChon, type LuatNoiDungGiaTri } from './LuatNoiDungChon';
import clsx from 'clsx';
import { useDangKyHanhDong, useXuong } from '../lib/xuong';
import { api, ApiError, type MediaItem, type ModelSuaVideo, type ViecVideo } from '../lib/api';
import { hoiXacNhan } from './HopHoi';
import { TY_GIA } from '../lib/tien-chi';

/**
 * Video → video: sửa video chủ shop đã có — đổi bối cảnh, thêm bớt đồ vật, đổi
 * phong cách, làm nét. Model tính tiền theo giây đầu ra (bằng độ dài video
 * nguồn), nên đọc độ dài video ngay trên trình duyệt để báo giá trước.
 */

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
  // Trong Xưởng AI: yêu cầu sửa = ô mô tả của ô soạn chung (không có ô riêng).
  const xuong = useXuong();
  const [yeuCauRieng, setYeuCauRieng] = useState('');
  const yeuCau = xuong ? xuong.moTa : yeuCauRieng;
  const setYeuCau = xuong ? xuong.setMoTa : setYeuCauRieng;
  const [luatNoiDung, setLuatNoiDung] = useState<LuatNoiDungGiaTri>({ chanNhanHieuGia: false, chanNguoiThat: false });
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
  // Theo số giây BỊ TÍNH (giây tối thiểu của mô hình), đúng như máy chủ báo giá.
  const gia = model && soGiayNguon !== null ? Math.max(model.toiThieu, model.giaMoiGiay * Math.max(soGiayNguon, model.giayToiThieu ?? 0)) : null;

  const gui = async () => {
    if (dangGui || !model || !nguon) return;
    if (!yeuCau.trim()) return setLoi('Viết muốn sửa video thế nào.');
    if (
      !(await hoiXacNhan({
        tieuDe: `Sửa video bằng ${model.ten}?`,
        noiDung: `Chi phí ước tính: ${gia === null ? 'đang đo độ dài video' : tien(gia)}.\nTiền bị trừ kể cả khi bạn không dùng video.`,
        nutDongY: 'Sửa video',
        bieuTuong: 'movie_edit',
      }))
    ) return;
    setDangGui(true);
    setLoi('');
    try {
      const { data } = await api.ai.suaVideo({ model: model.id, videoNguon: nguon, yeuCau, ...luatNoiDung });
      setViec((truoc) => [data, ...truoc]);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa gửi được yêu cầu sửa video');
    } finally {
      setDangGui(false);
    }
  };

  const khoaGui = dangGui || !model || !nguon || !yeuCau.trim();
  const nhanGui = dangGui ? 'Đang gửi…' : gia !== null ? `Sửa video — ${tien(gia)}` : 'Sửa video';
  // Trong Xưởng AI: nút tạo ở ô soạn chung chạy "Sửa video".
  useDangKyHanhDong('sua', { nhan: nhanGui, khoa: khoaGui, dangChay: dangGui }, () => void gui());

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
        {xuong ? (
          <p className="text-[11px] text-on-surface-variant">
            Viết muốn sửa thế nào ở ô mô tả của ô soạn phía trên (hoặc bấm một gợi ý). {yeuCau.trim() ? `Đang dùng: “${yeuCau.trim().slice(0, 120)}”` : ''}
          </p>
        ) : (
        <textarea
          rows={3}
          value={yeuCau}
          onChange={(e) => setYeuCau(e.target.value)}
          placeholder="Ví dụ: đổi nền thành bãi biển lúc hoàng hôn, giữ nguyên người và sản phẩm…"
          className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-3 text-sm text-on-surface focus:border-primary focus:outline-none resize-none"
        />
        )}
        <LuatNoiDungChon giaTri={luatNoiDung} onDoi={setLuatNoiDung} />
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
              {m.phanKhuc && (
                <span className="block text-primary">
                  {m.phanKhuc} · {m.xepHang}
                </span>
              )}
              <span className="block text-on-surface-variant">
                {/* Theo số giây BỊ TÍNH: H3 tính tối thiểu 5 giây (đã đo: nguồn 4 giây trừ 0,65 USD). */}
                {soGiayNguon !== null
                  ? tien(Math.max(m.toiThieu, m.giaMoiGiay * Math.max(soGiayNguon, m.giayToiThieu ?? 0)))
                  : `${(m.giaMoiGiay * TY_GIA).toLocaleString('vi-VN')}đ mỗi giây`}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={gui}
        disabled={khoaGui}
        className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
      >
        <span className={clsx('material-symbols-outlined text-[18px]', dangGui && 'animate-spin')}>
          {dangGui ? 'progress_activity' : 'movie_edit'}
        </span>
        {nhanGui}
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

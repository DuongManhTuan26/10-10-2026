import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type LuaChonVideo, type MediaItem, type ModelVideo, type ViecVideo } from '../lib/api';
import VideoDaiPanel from './VideoDaiPanel';
import VideoSuaPanel from './VideoSuaPanel';
import VideoTrendPanel from './VideoTrendPanel';

/**
 * Khối "AI tạo video" trong khung soạn bài.
 *
 * Video đắt hơn ảnh nhiều lần và tiền trừ vào tài khoản AI của hệ thống, nên:
 * mặc định TẮT, luôn hiện giá trước khi tạo, danh sách model xếp rẻ tới đắt.
 * Tạo video mất từ 30 giây tới vài phút — máy chủ tự theo dõi, đóng trang giữa
 * chừng cũng không mất video.
 */

/** Tỷ giá chỉ để chủ shop hình dung, số tiền thật tính bằng USD. */
const TY_GIA = 25_500;

const KHUNG: { id: string; ten: string }[] = [
  { id: '9:16', ten: 'Dọc 9:16 (Reels)' },
  { id: '16:9', ten: 'Ngang 16:9' },
  { id: '1:1', ten: 'Vuông 1:1' },
];
const DO_NET = ['480p', '720p', '1080p'];
const GIAY_NHANH = [5, 8, 10, 15, 30];

type CheDo = 'mot_canh' | 'kich_ban' | 'tham_chieu' | 'sua_video' | 'trend';
const CHE_DO: { id: CheDo; ten: string; moTa: string }[] = [
  { id: 'mot_canh', ten: 'Một cảnh', moTa: 'Video ngắn một cảnh, nhanh và rẻ' },
  { id: 'kich_ban', ten: 'Video dài theo kịch bản', moTa: 'AI chia ý tưởng thành nhiều cảnh nối liền, ghép thành video dài' },
  { id: 'tham_chieu', ten: 'Từ ảnh tham chiếu', moTa: 'Giữ đúng nhân vật, sản phẩm trong ảnh xuyên suốt nhiều cảnh' },
  { id: 'sua_video', ten: 'Sửa video có sẵn', moTa: 'Đổi bối cảnh, thêm bớt đồ vật, đổi phong cách cho video bạn đã có' },
  { id: 'trend', ten: 'Theo trend', moTa: 'AI học công thức của một video trend rồi làm video mới cho sản phẩm của bạn' },
];

function tien(usd: number | null): string {
  if (usd === null) return 'chưa rõ giá';
  const vnd = Math.round((usd * TY_GIA) / 500) * 500;
  return `~${vnd.toLocaleString('vi-VN')}đ (${usd.toFixed(2)} USD)`;
}

export default function VideoAiPanel({
  noiDung,
  anhCoSan,
  videoCoSan,
  onGanVaoBai,
}: {
  noiDung: string;
  /** Ảnh đang có trong bài, để chọn làm khung hình mở đầu. */
  anhCoSan: string[];
  /** Video đang có trong bài, để chọn làm video nguồn khi sửa video. */
  videoCoSan: string[];
  onGanVaoBai: (item: MediaItem) => void;
}) {
  const [bat, setBat] = useState<boolean | null>(null);
  const [cheDo, setCheDo] = useState<CheDo>('mot_canh');
  const [dangDoiBat, setDangDoiBat] = useState(false);
  const [mucDichDs, setMucDichDs] = useState<Record<string, string>>({});
  const [mucDich, setMucDich] = useState('khoe_san_pham');
  const [soGiay, setSoGiay] = useState(8);
  const [doNet, setDoNet] = useState('720p');
  const [khung, setKhung] = useState('9:16');
  const [coTieng, setCoTieng] = useState(false);
  const [anhMoDau, setAnhMoDau] = useState('');
  const [loiMoTa, setLoiMoTa] = useState('');
  const [tomTat, setTomTat] = useState('');
  const [dangViet, setDangViet] = useState(false);
  const [models, setModels] = useState<ModelVideo[]>([]);
  const [dangTaiModel, setDangTaiModel] = useState(false);
  const [modelChon, setModelChon] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [viec, setViec] = useState<ViecVideo[]>([]);
  const [loi, setLoi] = useState('');
  const daGan = useRef(new Set<number>());

  const lc: LuaChonVideo = useMemo(
    () => ({ soGiay, doNet, khung, coTieng, coAnhMoDau: Boolean(anhMoDau) }),
    [soGiay, doNet, khung, coTieng, anhMoDau]
  );

  // Danh sách model và giá theo đúng lựa chọn đang chọn.
  useEffect(() => {
    let huy = false;
    const hen = setTimeout(async () => {
      setDangTaiModel(true);
      try {
        const { data } = await api.ai.videoModels(lc);
        if (huy) return;
        setBat(data.bat);
        setMucDichDs(data.mucDich);
        setModels(data.models);
        // Giữ model đang chọn nếu vẫn làm được; không thì chọn cái rẻ nhất.
        setModelChon((cu) => {
          const conHop = data.models.find((m) => m.id === cu && !m.lyDo);
          return conHop ? cu : (data.models.find((m) => !m.lyDo)?.id ?? '');
        });
      } catch (error) {
        if (!huy) setLoi(error instanceof ApiError ? error.message : 'Chưa tải được danh sách model video');
      } finally {
        if (!huy) setDangTaiModel(false);
      }
    }, 300);
    return () => {
      huy = true;
      clearTimeout(hen);
    };
  }, [lc]);

  // Theo dõi video đang tạo.
  const conDangTao = viec.some((v) => v.trang_thai === 'dang_tao');
  useEffect(() => {
    if (!bat) return;
    let huy = false;
    const tai = async () => {
      try {
        const { data } = await api.ai.videoViec();
        if (!huy) setViec(data.filter((v) => !v.la_sua_video));
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
  }, [bat, conDangTao]);

  const doiBat = async () => {
    if (dangDoiBat || bat === null) return;
    setDangDoiBat(true);
    setLoi('');
    try {
      await api.ai.batVideo(!bat);
      setBat(!bat);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa đổi được chế độ video');
    } finally {
      setDangDoiBat(false);
    }
  };

  const nhoAiViet = async () => {
    if (dangViet) return;
    if (!noiDung.trim()) {
      setLoi('Viết nội dung bài trước để AI biết video nói về gì.');
      return;
    }
    setLoi('');
    setDangViet(true);
    try {
      const { data } = await api.ai.videoLoiMoTa({ noiDung, mucDich, soGiay, coAnhMoDau: Boolean(anhMoDau) });
      setLoiMoTa(data.loiMoTa);
      setTomTat(data.tomTat);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'AI chưa viết được lời mô tả');
    } finally {
      setDangViet(false);
    }
  };

  const model = models.find((m) => m.id === modelChon);

  const taoVideo = async () => {
    if (dangGui || !model || model.lyDo) return;
    if (!loiMoTa.trim()) {
      setLoi('Cần lời mô tả video. Bấm "AI viết lời mô tả" hoặc tự viết.');
      return;
    }
    if (!confirm(`Tạo video ${soGiay} giây bằng ${model.ten}?\n\nChi phí ước tính: ${tien(model.giaUocTinh)}.\nTiền bị trừ kể cả khi bạn không dùng video.`)) {
      return;
    }
    setLoi('');
    setDangGui(true);
    try {
      const { data } = await api.ai.taoVideo({ ...lc, model: model.id, loiMoTa, anhMoDau: anhMoDau || undefined });
      setViec((truoc) => [data, ...truoc]);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa gửi được yêu cầu tạo video');
    } finally {
      setDangGui(false);
    }
  };

  const ganVaoBai = (v: ViecVideo) => {
    if (!v.url || daGan.current.has(v.id)) return;
    daGan.current.add(v.id);
    onGanVaoBai({ url: v.url, type: 'video' });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="tieu-de-muc">AI TẠO VIDEO</h3>
        <button
          type="button"
          onClick={doiBat}
          disabled={bat === null || dangDoiBat}
          className={clsx(
            'relative w-14 h-8 rounded-full transition-colors shrink-0 border disabled:opacity-50',
            bat
              ? 'bg-primary border-primary shadow-[0_0_16px_rgba(0,229,255,0.5)]'
              : 'bg-surface-container border-primary/40 hover:border-primary/70'
          )}
          title={bat ? 'Tắt tạo video AI' : 'Bật tạo video AI'}
        >
          <span
            className={clsx(
              'absolute top-1 w-6 h-6 rounded-full transition-all',
              bat ? 'left-7 bg-white' : 'left-1 bg-on-surface-variant'
            )}
          />
        </button>
      </div>

      {loi && (
        <div className="mb-3 text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>
      )}

      {!bat ? (
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Đang tắt. Bật lên để AI tạo video đăng kèm bài hoặc tải về máy. Mỗi video tốn tiền AI —
          giá luôn hiện trước khi tạo.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Chế độ */}
          <div className="flex flex-wrap gap-2">
            {CHE_DO.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCheDo(c.id)}
                title={c.moTa}
                className={clsx(
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-colors',
                  cheDo === c.id
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/50'
                )}
              >
                {c.ten}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant">{CHE_DO.find((c) => c.id === cheDo)?.moTa}</p>

          {/* Mục đích */}
          {cheDo === 'mot_canh' && (
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            <label className="block text-xs font-bold text-on-surface">Video để làm gì</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(mucDichDs) as [string, string][]).map(([id, moTa]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMucDich(id)}
                  title={moTa}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                    mucDich === id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                  )}
                >
                  {moTa.split(':')[0].replace(/^./, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Thông số — sửa video giữ nguyên khung và độ nét của video nguồn */}
          {cheDo !== 'sua_video' && (
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-3">
            {cheDo === 'mot_canh' && (
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Độ dài (giây)</label>
              <div className="flex flex-wrap items-center gap-2">
                {GIAY_NHANH.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSoGiay(g)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                      soGiay === g
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                    )}
                  >
                    {g}s
                  </button>
                ))}
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={soGiay}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n)) setSoGiay(Math.min(30, Math.max(2, n)));
                  }}
                  className="bg-surface-container-high w-20 rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  aria-label="Số giây tuỳ chọn"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1.5">
                Reels và video bán hàng thường hiệu quả nhất ở 6–8 giây. Chỉ vài model làm được trên 15 giây.
              </p>
            </div>
            )}
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">Độ nét</label>
                <div className="flex gap-2">
                  {DO_NET.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDoNet(d)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                        doNet === d
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-2">Khung hình</label>
                <div className="flex flex-wrap gap-2">
                  {KHUNG.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setKhung(k.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                        khung === k.id
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                      )}
                    >
                      {k.ten}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
              <input type="checkbox" checked={coTieng} onChange={(e) => setCoTieng(e.target.checked)} />
              Có âm thanh do AI tạo (thường đắt hơn; tắt đi rồi ghép nhạc khi đăng sẽ rẻ hơn)
            </label>
          </div>

          )}

          {cheDo === 'sua_video' && <VideoSuaPanel videoCoSan={videoCoSan} onGanVaoBai={onGanVaoBai} />}
          {cheDo === 'trend' && (
            <VideoTrendPanel
              noiDung={noiDung}
              anhCoSan={anhCoSan}
              doNet={doNet}
              khung={khung}
              coTieng={coTieng}
              onGanVaoBai={onGanVaoBai}
            />
          )}

          {(cheDo === 'kich_ban' || cheDo === 'tham_chieu') && (
            <div key={cheDo}>
            <VideoDaiPanel
              loai={cheDo}
              noiDung={noiDung}
              anhCoSan={anhCoSan}
              doNet={doNet}
              khung={khung}
              coTieng={coTieng}
              onGanVaoBai={onGanVaoBai}
            />
            </div>
          )}

          {cheDo === 'mot_canh' && (<>
          {/* Ảnh mở đầu */}
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            <label className="block text-xs font-bold text-on-surface">
              Ảnh sản phẩm làm khung mở đầu — video sẽ bám đúng sản phẩm thật
            </label>
            {/*
              Đã đo: ảnh mở đầu vuông + chọn khung 9:16 → Seedance trả video vuông
              640×640. Model giữ tỷ lệ của ảnh, nên phải nói trước với chủ shop.
            */}
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Nhiều model giữ đúng tỷ lệ của ảnh mở đầu: ảnh vuông ra video vuông. Muốn video dọc cho
              Reels thì chọn ảnh dọc.
            </p>
            {anhCoSan.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Chưa có ảnh trong bài. Thêm ảnh sản phẩm ở phần ảnh phía trên để chọn làm khung mở đầu.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAnhMoDau('')}
                  className={clsx(
                    'w-16 h-16 rounded-lg border-2 text-[11px] font-bold',
                    !anhMoDau ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'
                  )}
                >
                  Không dùng
                </button>
                {anhCoSan.map((u) => (
                  <button key={u} type="button" onClick={() => setAnhMoDau(u)} className="shrink-0">
                    <img
                      src={u}
                      alt=""
                      className={clsx(
                        'w-16 h-16 rounded-lg object-cover border-2',
                        anhMoDau === u ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lời mô tả */}
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-xs font-bold text-on-surface">Lời mô tả video</label>
              <button
                type="button"
                onClick={nhoAiViet}
                disabled={dangViet || !noiDung.trim()}
                title={!noiDung.trim() ? 'Cần nội dung bài viết' : undefined}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={clsx('material-symbols-outlined text-[16px]', dangViet && 'animate-spin')}>
                  {dangViet ? 'progress_activity' : 'edit_note'}
                </span>
                {dangViet ? 'Đang viết…' : 'AI viết lời mô tả'}
              </button>
            </div>
            {tomTat && <p className="text-xs text-primary leading-relaxed">Video sẽ là: {tomTat}</p>}
            <textarea
              rows={4}
              value={loiMoTa}
              onChange={(e) => setLoiMoTa(e.target.value)}
              placeholder="Bấm 'AI viết lời mô tả' để AI viết từ nội dung bài, hoặc tự mô tả cảnh bạn muốn…"
              className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-3 text-sm text-on-surface leading-relaxed focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
            />
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              AI viết bằng tiếng Anh vì các model video hiểu tiếng Anh chính xác nhất. Video sẽ không có
              chữ, logo hay tên thương hiệu — chữ tiếng Việt do AI video viết thường sai dấu.
            </p>
          </div>

          {/* Chọn model */}
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            <label className="block text-xs font-bold text-on-surface">
              Chọn model — xếp từ rẻ tới đắt cho video {soGiay} giây, {doNet}
              {dangTaiModel && <span className="text-on-surface-variant font-normal"> (đang tính giá…)</span>}
            </label>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {models.map((m) => (
                <label
                  key={m.id}
                  className={clsx(
                    'flex items-start gap-3 rounded-lg border px-3 py-2 text-xs',
                    m.lyDo
                      ? 'border-outline-variant/50 opacity-50 cursor-not-allowed'
                      : modelChon === m.id
                        ? 'border-primary bg-primary/10 cursor-pointer'
                        : 'border-outline-variant hover:border-primary/50 cursor-pointer'
                  )}
                >
                  <input
                    type="radio"
                    name="model-video"
                    className="mt-0.5"
                    disabled={Boolean(m.lyDo)}
                    checked={modelChon === m.id}
                    onChange={() => setModelChon(m.id)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-on-surface">{m.ten}</span>
                    <span className="block text-on-surface-variant">
                      {m.lyDo ? `Không chọn được: ${m.lyDo}` : tien(m.giaUocTinh)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={taoVideo}
            disabled={dangGui || !model || Boolean(model?.lyDo) || !loiMoTa.trim()}
            className="w-full py-3 rounded-lg bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={clsx('material-symbols-outlined text-[18px]', dangGui && 'animate-spin')}>
              {dangGui ? 'progress_activity' : 'movie'}
            </span>
            {dangGui ? 'Đang gửi…' : model ? `Tạo video — ${tien(model.giaUocTinh)}` : 'Chọn model để tạo video'}
          </button>

          {/* Video đã tạo */}
          {viec.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface">Video của trang này</label>
              {/*
                Meta tự nhận ra video AI qua dấu hiệu nhúng trong tệp và gắn nhãn
                "Thông tin AI". Máy chủ giữ nguyên tệp gốc, không nén lại, nên dấu
                hiệu đó còn nguyên — đúng quy định minh bạch của nền tảng.
              */}
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Facebook có thể tự gắn nhãn "Thông tin AI" cho video này — nhãn chỉ để minh bạch, không
                làm giảm tiếp cận. Đừng dùng video AI để giả người thật hay đánh lừa khách.
              </p>
              {viec.map((v) => (
                <div key={v.id} className="bg-surface-container rounded-xl p-3 border border-outline-variant space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-on-surface-variant truncate">
                      {v.model.split('/').pop()} · {v.so_giay}s · {v.do_net} · {v.khung}
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 font-bold',
                        v.trang_thai === 'xong' ? 'text-primary' : v.trang_thai === 'loi' ? 'text-error' : 'text-on-surface'
                      )}
                    >
                      {v.trang_thai === 'xong' ? 'Xong' : v.trang_thai === 'loi' ? 'Lỗi' : 'Đang tạo… (30 giây – vài phút)'}
                    </span>
                  </div>
                  {v.trang_thai === 'xong' && v.url && (
                    <>
                      <video src={v.url} controls playsInline className="w-full max-h-80 rounded-lg bg-black" />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ganVaoBai(v)}
                          className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                        >
                          Gắn vào bài
                        </button>
                        <a
                          href={v.url}
                          download={`video-ai-${v.id}.mp4`}
                          className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary transition-colors"
                        >
                          Tải về máy
                        </a>
                        {v.gia_thuc !== null && (
                          <span className="text-[11px] text-on-surface-variant">
                            Đã tốn {tien(Number(v.gia_thuc))}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {v.trang_thai === 'loi' && <p className="text-xs text-error">{v.loi}</p>}
                </div>
              ))}
            </div>
          )}
          </>)}
        </div>
      )}
    </div>
  );
}

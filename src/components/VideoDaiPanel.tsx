import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { api, ApiError, type CanhVideo, type DuAnVideo, type MediaItem, type ModelVideo } from '../lib/api';

/**
 * Video dài nhiều cảnh: kịch bản → video, ảnh tham chiếu → video, trend → video.
 *
 * Hai bước có chủ đích: AI chia cảnh và báo giá TRƯỚC (rẻ, chỉ tốn AI chữ), chủ
 * shop đọc, sửa từng cảnh rồi mới bấm tạo — từ đó mới tốn tiền video.
 */

const TY_GIA = 25_500;
const TONG_GIAY = [10, 15, 20, 30, 45, 60];

function tien(usd: number | null): string {
  if (usd === null) return 'chưa rõ giá';
  const vnd = Math.round((usd * TY_GIA) / 500) * 500;
  return `~${vnd.toLocaleString('vi-VN')}đ (${usd.toFixed(2)} USD)`;
}

const TEN_TRANG_THAI: Record<DuAnVideo['trang_thai'], string> = {
  nhap: 'Chờ bạn duyệt',
  dang_tao: 'Đang tạo từng cảnh',
  dang_ghep: 'Đang ghép thành một video',
  xong: 'Xong',
  loi: 'Lỗi',
};

export default function VideoDaiPanel({
  loai,
  noiDung,
  anhCoSan,
  doNet,
  khung,
  coTieng,
  congThucTrend,
  onGanVaoBai,
}: {
  loai: DuAnVideo['loai'];
  noiDung: string;
  anhCoSan: string[];
  doNet: string;
  khung: string;
  coTieng: boolean;
  /** Công thức rút ra từ video trend (chỉ dùng khi loai = 'trend'). */
  congThucTrend?: string;
  onGanVaoBai: (item: MediaItem) => void;
}) {
  const [yTuong, setYTuong] = useState(noiDung);
  const [tongGiay, setTongGiay] = useState(20);
  const [anhThamChieu, setAnhThamChieu] = useState<string[]>([]);
  const [dangTaiAnh, setDangTaiAnh] = useState(false);
  const [models, setModels] = useState<ModelVideo[]>([]);
  const [modelChon, setModelChon] = useState('');
  const [nhap, setNhap] = useState<DuAnVideo | null>(null);
  const [dangChia, setDangChia] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangBatDau, setDangBatDau] = useState(false);
  const [duAn, setDuAn] = useState<DuAnVideo[]>([]);
  const [loi, setLoi] = useState('');
  const inputAnhRef = useRef<HTMLInputElement>(null);
  const daGan = useRef(new Set<number>());

  // Chỉ model nhận khung mở đầu mới nối cảnh liền mạch được.
  useEffect(() => {
    let huy = false;
    api.ai
      .videoModels({ soGiay: 8, doNet, khung, coTieng, coAnhMoDau: true })
      .then(({ data }) => {
        if (huy) return;
        const noiDuoc = data.models.filter((m) => m.anhMoDau && !m.lyDo?.includes('độ nét') && !m.lyDo?.includes('khung') && !m.lyDo?.includes('tiếng'));
        setModels(noiDuoc);
        setModelChon((cu) => (noiDuoc.some((m) => m.id === cu) ? cu : noiDuoc[0]?.id ?? ''));
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, [doNet, khung, coTieng]);

  const conDangChay = duAn.some((d) => d.trang_thai === 'dang_tao' || d.trang_thai === 'dang_ghep');
  useEffect(() => {
    let huy = false;
    const tai = async () => {
      try {
        const { data } = await api.ai.duAnVideo();
        if (!huy) setDuAn(data.filter((d) => d.loai === loai && d.trang_thai !== 'nhap'));
      } catch {
        /* Lượt sau thử lại. */
      }
    };
    void tai();
    if (!conDangChay) return () => { huy = true; };
    const nhip = setInterval(tai, 15_000);
    return () => {
      huy = true;
      clearInterval(nhip);
    };
  }, [loai, conDangChay]);

  const taiAnhLen = async (f: File) => {
    setDangTaiAnh(true);
    setLoi('');
    try {
      const item = await api.posts.uploadMedia(f);
      setAnhThamChieu((truoc) => [...truoc, item.url].slice(0, 4));
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được ảnh lên');
    } finally {
      setDangTaiAnh(false);
    }
  };

  const chiaCanh = async () => {
    if (dangChia) return;
    if (!yTuong.trim()) return setLoi('Cần ý tưởng hoặc kịch bản.');
    if (!modelChon) return setLoi('Chưa có model nào nối cảnh được với lựa chọn này.');
    if (loai === 'tham_chieu' && anhThamChieu.length === 0) return setLoi('Chọn ít nhất một ảnh tham chiếu.');
    if (loai === 'trend' && !congThucTrend) return setLoi('Phân tích video trend trước.');
    setLoi('');
    setDangChia(true);
    try {
      const { data } = await api.ai.taoDuAnVideo({
        loai, yTuong, tongGiay, model: modelChon, doNet, khung, coTieng, anhThamChieu, congThucTrend,
      });
      setNhap(data);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'AI chưa chia được cảnh');
    } finally {
      setDangChia(false);
    }
  };

  const suaCanh = (i: number, sua: Partial<CanhVideo>) => {
    if (!nhap) return;
    setNhap({ ...nhap, phan_canh: nhap.phan_canh.map((c, j) => (j === i ? { ...c, ...sua } : c)) });
  };

  const luuThayDoi = async () => {
    if (!nhap || dangLuu) return;
    setDangLuu(true);
    setLoi('');
    try {
      const { data } = await api.ai.suaDuAnVideo(nhap.id, { nhatQuan: nhap.nhat_quan, phanCanh: nhap.phan_canh });
      setNhap(data);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa lưu được phân cảnh');
    } finally {
      setDangLuu(false);
    }
  };

  const batDau = async () => {
    if (!nhap || dangBatDau) return;
    const gia = nhap.gia_uoc_tinh === null ? null : Number(nhap.gia_uoc_tinh);
    if (!confirm(`Tạo video ${nhap.phan_canh.reduce((t, c) => t + c.soGiay, 0)} giây, ${nhap.phan_canh.length} cảnh?\n\nChi phí ước tính: ${tien(gia)}.\nMất khoảng ${nhap.phan_canh.length * 2}–${nhap.phan_canh.length * 5} phút. Tiền bị trừ kể cả khi bạn không dùng video.`)) return;
    setDangBatDau(true);
    setLoi('');
    try {
      await luuThayDoi();
      const { data } = await api.ai.batDauDuAnVideo(nhap.id);
      setDuAn((truoc) => [{ ...data, canh_xong: 0 }, ...truoc]);
      setNhap(null);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa bắt đầu được');
    } finally {
      setDangBatDau(false);
    }
  };

  const model = models.find((m) => m.id === modelChon);
  const giaMoiGiay = model?.giaUocTinh != null ? model.giaUocTinh / 8 : null;

  return (
    <div className="space-y-3">
      {loi && <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>}

      {!nhap && (
        <>
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            <label className="block text-xs font-bold text-on-surface">
              {loai === 'trend' ? 'Sản phẩm / nội dung muốn làm theo trend' : 'Ý tưởng hoặc kịch bản'}
            </label>
            <textarea
              rows={4}
              value={yTuong}
              onChange={(e) => setYTuong(e.target.value)}
              placeholder="Ví dụ: mở đầu cận cảnh giọt mật, rồi rót mật vào hũ, kết bằng hũ mật trên bàn gỗ trong nắng sớm…"
              className="w-full bg-surface rounded-lg border border-outline-variant p-3 text-sm text-on-surface leading-relaxed focus:border-primary focus:outline-none resize-none"
            />
            <p className="text-[11px] text-on-surface-variant">
              Viết tiếng Việt thoải mái. AI sẽ tự chia thành từng cảnh và giữ nhân vật, bối cảnh nhất quán xuyên suốt.
            </p>
          </div>

          {loai === 'tham_chieu' && (
            <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
              <label className="block text-xs font-bold text-on-surface">
                Ảnh tham chiếu — nhân vật, sản phẩm, bối cảnh (tối đa 4)
              </label>
              <input
                ref={inputAnhRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void taiAnhLen(f);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2">
                {[...new Set([...anhCoSan, ...anhThamChieu])].map((u) => {
                  const chon = anhThamChieu.includes(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        setAnhThamChieu((truoc) =>
                          chon ? truoc.filter((x) => x !== u) : [...truoc, u].slice(0, 4)
                        )
                      }
                      className="shrink-0"
                    >
                      <img
                        src={u}
                        alt=""
                        className={clsx(
                          'w-16 h-16 rounded-lg object-cover border-2',
                          chon ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                      />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => inputAnhRef.current?.click()}
                  disabled={dangTaiAnh || anhThamChieu.length >= 4}
                  className="w-16 h-16 rounded-lg border border-dashed border-outline-variant text-[11px] font-bold text-on-surface-variant hover:border-primary/50 disabled:opacity-50"
                >
                  {dangTaiAnh ? 'Đang tải…' : '+ Ảnh'}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Ảnh rõ mặt, rõ trang phục, rõ sản phẩm thì các cảnh giữ giống nhau tốt hơn. Chỉ dùng ảnh người đã
                đồng ý xuất hiện trong quảng cáo của bạn.
              </p>
            </div>
          )}

          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Tổng độ dài (giây)</label>
              <div className="flex flex-wrap items-center gap-2">
                {TONG_GIAY.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTongGiay(g)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                      tongGiay === g
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                    )}
                  >
                    {g}s
                  </button>
                ))}
                <input
                  type="number"
                  min={4}
                  max={120}
                  value={tongGiay}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n)) setTongGiay(Math.min(120, Math.max(4, n)));
                  }}
                  className="w-20 bg-surface rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  aria-label="Tổng số giây tuỳ chọn"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">
                Model (chỉ hiện model nối cảnh liền mạch được), xếp rẻ tới đắt
              </label>
              <select
                value={modelChon}
                onChange={(e) => setModelChon(e.target.value)}
                className="w-full bg-surface rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ten} — {m.giaUocTinh === null ? 'chưa rõ giá' : `~${(Math.round(((m.giaUocTinh / 8) * tongGiay * TY_GIA) / 500) * 500).toLocaleString('vi-VN')}đ cho ${tongGiay}s`}
                  </option>
                ))}
              </select>
              {giaMoiGiay !== null && (
                <p className="text-[11px] text-on-surface-variant mt-1.5">
                  Ước tính cả video: {tien(giaMoiGiay * tongGiay)}. Giá chính xác hiện sau khi AI chia cảnh.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={chiaCanh}
            disabled={dangChia || !modelChon}
            className="w-full py-3 rounded-lg border border-primary/50 bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <span className={clsx('material-symbols-outlined text-[18px]', dangChia && 'animate-spin')}>
              {dangChia ? 'progress_activity' : 'view_timeline'}
            </span>
            {dangChia ? 'AI đang chia cảnh…' : 'AI chia cảnh và báo giá (chưa tạo video)'}
          </button>
        </>
      )}

      {nhap && (
        <div className="bg-surface-container rounded-xl p-4 border border-primary/40 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-on-surface">
              {nhap.phan_canh.length} cảnh · {nhap.phan_canh.reduce((t, c) => t + c.soGiay, 0)} giây ·{' '}
              {tien(nhap.gia_uoc_tinh === null ? null : Number(nhap.gia_uoc_tinh))}
            </label>
            <button type="button" onClick={() => setNhap(null)} className="text-xs text-on-surface-variant hover:text-on-surface">
              Làm lại
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Mô tả nhất quán — dùng chung cho mọi cảnh để giữ nhân vật, bối cảnh giống nhau
            </label>
            <textarea
              rows={3}
              value={nhap.nhat_quan}
              onChange={(e) => setNhap({ ...nhap, nhat_quan: e.target.value })}
              className="w-full bg-surface rounded-lg border border-outline-variant p-2 text-xs text-on-surface leading-relaxed focus:border-primary focus:outline-none resize-none"
            />
          </div>
          {nhap.phan_canh.map((c, i) => (
            <div key={i} className="rounded-lg border border-outline-variant p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary">Cảnh {i + 1}</span>
                <select
                  value={c.soGiay}
                  onChange={(e) => suaCanh(i, { soGiay: Number(e.target.value) })}
                  className="bg-surface rounded border border-outline-variant px-2 py-0.5 text-xs text-on-surface"
                >
                  {(model?.soGiay ?? [c.soGiay]).map((g) => (
                    <option key={g} value={g}>{g} giây</option>
                  ))}
                </select>
              </div>
              {c.tomTat && <p className="text-xs text-on-surface">{c.tomTat}</p>}
              <textarea
                rows={3}
                value={c.moTa}
                onChange={(e) => suaCanh(i, { moTa: e.target.value })}
                className="w-full bg-surface rounded-lg border border-outline-variant p-2 text-[11px] text-on-surface-variant leading-relaxed focus:border-primary focus:outline-none resize-none"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={luuThayDoi}
              disabled={dangLuu}
              className="px-3 py-2 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary disabled:opacity-50"
            >
              {dangLuu ? 'Đang tính lại giá…' : 'Lưu và tính lại giá'}
            </button>
            <button
              type="button"
              onClick={batDau}
              disabled={dangBatDau}
              className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold hover:brightness-110 disabled:opacity-50"
            >
              {dangBatDau ? 'Đang gửi…' : 'Duyệt và tạo video'}
            </button>
          </div>
        </div>
      )}

      {duAn.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface">Video dài của trang này</label>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Video ghép nhiều cảnh đã được mã hoá lại nên Facebook có thể không tự nhận ra là video AI. Nếu video trông
            như thật, hãy tự bật nhãn "Nội dung AI" khi đăng để đúng quy định của nền tảng.
          </p>
          {duAn.map((d) => (
            <div key={d.id} className="bg-surface-container rounded-xl p-3 border border-outline-variant space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-on-surface-variant truncate">
                  {d.phan_canh.length} cảnh · {d.phan_canh.reduce((t, c) => t + c.soGiay, 0)}s · {d.model.split('/').pop()}
                </span>
                <span
                  className={clsx(
                    'shrink-0 font-bold',
                    d.trang_thai === 'xong' ? 'text-primary' : d.trang_thai === 'loi' ? 'text-error' : 'text-on-surface'
                  )}
                >
                  {TEN_TRANG_THAI[d.trang_thai]}
                  {d.trang_thai === 'dang_tao' && ` (${d.canh_xong ?? 0}/${d.phan_canh.length})`}
                </span>
              </div>
              {d.trang_thai === 'xong' && d.url && (
                <>
                  <video src={d.url} controls playsInline className="w-full max-h-80 rounded-lg bg-black" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (daGan.current.has(d.id)) return;
                        daGan.current.add(d.id);
                        onGanVaoBai({ url: d.url!, type: 'video' });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
                    >
                      Gắn vào bài
                    </button>
                    <a
                      href={d.url}
                      download={`video-dai-${d.id}.mp4`}
                      className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary"
                    >
                      Tải về máy
                    </a>
                    {d.gia_thuc !== null && (
                      <span className="text-[11px] text-on-surface-variant">Đã tốn {tien(Number(d.gia_thuc))}</span>
                    )}
                  </div>
                </>
              )}
              {d.trang_thai === 'loi' && <p className="text-xs text-error">{d.loi}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

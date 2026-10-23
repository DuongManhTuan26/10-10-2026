import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, type ModelVideo, type VideoTuDong } from '../lib/api';
import { LuatNoiDungChon } from './LuatNoiDungChon';
import { TY_GIA } from '../lib/tien-chi';

/**
 * Video đăng kèm bài trong lịch tự đăng — cùng cơ chế công tắc như ảnh (chủ dự án 03/10/2026).
 * Video đắt hơn ảnh nhiều lần nên bắt buộc đặt TRẦN TIỀN MỖI THÁNG; chạm trần, video lỗi hoặc quá lâu thì
 * lịch đăng kèm ảnh thay thế.
 */

const GIAY = [5, 8, 10, 15];
const DO_NET = ['480p', '720p', '1080p'];
const KHUNG = [
  { id: '9:16', ten: 'Dọc 9:16' },
  { id: '16:9', ten: 'Ngang 16:9' },
  { id: '1:1', ten: 'Vuông 1:1' },
];
const CHU = [
  { id: 'theo_noi_dung', ten: 'Có chữ theo nội dung' },
  { id: 'khong', ten: 'Không có chữ' },
] as const;

const vnd = (usd: number) => `~${(Math.round((usd * TY_GIA) / 500) * 500).toLocaleString('vi-VN')}đ`;

export function VideoTuDongChon({
  giaTri,
  onDoi,
  soBaiMoiTuan,
  tienThang,
  coAnhMoDau,
}: {
  giaTri: VideoTuDong;
  onDoi: (moi: VideoTuDong) => void;
  soBaiMoiTuan: number;
  /** Tiền video tự động đã dùng tháng này (USD). */
  tienThang: number;
  /** Lịch có bật tự vẽ ảnh → ảnh dùng làm khung mở đầu video (bám đúng sản phẩm). */
  coAnhMoDau: boolean;
}) {
  const [models, setModels] = useState<ModelVideo[]>([]);
  const [mucDich, setMucDich] = useState<Record<string, string>>({});
  const v = giaTri;
  const doi = (phan: Partial<VideoTuDong>) => onDoi({ ...v, ...phan });

  useEffect(() => {
    let huy = false;
    api.ai
      .videoModels({ soGiay: v.soGiay, doNet: v.doNet, khung: v.khung, coTieng: v.coTieng, coAnhMoDau })
      .then(({ data }) => {
        if (huy) return;
        setModels(data.models);
        setMucDich(data.mucDich);
        // Chưa chọn hoặc mô hình cũ không làm được thông số mới → mô hình rẻ nhất làm được (đổi lúc nào cũng được).
        const dung = data.models.filter((m) => !m.lyDo);
        if (!dung.some((m) => m.id === v.model) && dung[0]) onDoi({ ...v, model: dung[0].id });
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.soGiay, v.doNet, v.khung, v.coTieng, coAnhMoDau]);

  const model = models.find((m) => m.id === v.model);
  const giaMot = model?.giaUocTinh ?? null;
  const giaThang = giaMot !== null ? giaMot * soBaiMoiTuan * 4.3 : null;
  const nut = (chon: boolean) =>
    clsx(
      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
      chon ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-on-surface-variant">Độ dài:</span>
        {GIAY.map((g) => (
          <button key={g} type="button" onClick={() => doi({ soGiay: g })} className={nut(v.soGiay === g)}>
            {g}s
          </button>
        ))}
        <span className="text-xs text-on-surface-variant ml-2">Độ nét:</span>
        {DO_NET.map((d) => (
          <button key={d} type="button" onClick={() => doi({ doNet: d })} className={nut(v.doNet === d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-on-surface-variant">Khung:</span>
        {KHUNG.map((k) => (
          <button key={k.id} type="button" onClick={() => doi({ khung: k.id })} className={nut(v.khung === k.id)}>
            {k.ten}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer ml-2">
          <input type="checkbox" checked={v.coTieng} onChange={(e) => doi({ coTieng: e.target.checked })} />
          Có âm thanh AI (đắt hơn)
        </label>
      </div>
      <div>
        <label className="block text-xs font-bold text-on-surface mb-1">Mô hình video — xếp rẻ tới đắt</label>
        <select
          value={v.model}
          onChange={(e) => doi({ model: e.target.value })}
          className="bg-surface-container-high w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={Boolean(m.lyDo)}>
              {m.ten}
              {m.phanKhuc ? ` (${m.phanKhuc})` : ''} — {m.lyDo ? `không chọn được: ${m.lyDo}` : m.giaUocTinh !== null ? `${vnd(m.giaUocTinh)}/video` : 'chưa rõ giá'}
            </option>
          ))}
        </select>
        {model?.ghiChu && <p className="text-[11px] text-orange-400 mt-1">{model.ten}: {model.ghiChu}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-on-surface-variant">Video để làm gì:</span>
        {(Object.entries(mucDich) as [string, string][]).map(([id, moTa]) => (
          <button key={id} type="button" title={moTa} onClick={() => doi({ mucDich: id })} className={nut(v.mucDich === id)}>
            {moTa.split(':')[0].replace(/^./, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-on-surface">Trần tiền video mỗi tháng:</label>
        <input
          type="number"
          min={0}
          step={10000}
          value={v.tranThangUsd > 0 ? Math.round(v.tranThangUsd * TY_GIA) : ''}
          onChange={(e) => {
            const dong = Math.max(0, Number(e.target.value) || 0);
            doi({ tranThangUsd: Math.round((dong / TY_GIA) * 100) / 100 });
          }}
          placeholder="vd. 100000"
          className="bg-surface-container-high w-32 rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-on-surface-variant">đồng · tháng này đã dùng {vnd(tienThang)}</span>
      </div>
      {giaMot !== null && (
        <p className={clsx('text-xs', v.tranThangUsd > 0 && giaThang !== null && giaThang > v.tranThangUsd ? 'text-orange-400' : 'text-on-surface-variant')}>
          Mỗi video <b className="text-primary">{vnd(giaMot)}</b> · {soBaiMoiTuan} bài/tuần → khoảng {vnd(giaThang ?? 0)}/tháng.
          {v.tranThangUsd > 0 && giaThang !== null && giaThang > v.tranThangUsd && ' Vượt trần: các bài sau khi chạm trần sẽ đăng kèm ảnh thay video.'}
          {!(v.tranThangUsd > 0) && ' Cần đặt trần tiền mỗi tháng mới lưu được.'}
        </p>
      )}
      <details className="rounded-lg border border-outline-variant px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-on-surface">
          Tuỳ chỉnh thêm <span className="font-normal text-on-surface-variant">— chữ trong video, giới hạn nội dung</span>
        </summary>
        <div className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-on-surface">Chữ trong video:</span>
            {CHU.map((c) => (
              <button key={c.id} type="button" onClick={() => doi({ chuTrongVideo: c.id })} className={nut(v.chuTrongVideo === c.id)}>
                {c.ten}
              </button>
            ))}
          </div>
          <LuatNoiDungChon
            giaTri={{ chanNhanHieuGia: v.chanNhanHieuGia, chanNguoiThat: v.chanNguoiThat }}
            onDoi={(l) => doi({ chanNhanHieuGia: l.chanNhanHieuGia, chanNguoiThat: l.chanNguoiThat })}
          />
        </div>
      </details>
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        Video mất 1–5 phút: bài chờ video xong mới đăng theo chế độ bạn chọn. Video lỗi, quá 25 phút hoặc chạm trần tiền thì
        bài đăng kèm ảnh thay thế. {coAnhMoDau ? 'Ảnh AI vẽ cho bài được dùng làm khung mở đầu để video bám đúng sản phẩm.' : ''}
        {' '}Cần bật "Tạo video AI" trong Xưởng AI.
      </p>
    </div>
  );
}

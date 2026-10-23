import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, type LuaChonVeAnh, type ModelAnh } from '../lib/api';
import { TY_GIA } from '../lib/tien-chi';

/**
 * Chọn mô hình vẽ ảnh, xếp rẻ tới đắt, kèm GIÁ MỘT ẢNH theo đúng lựa chọn (chủ dự án 03/10/2026:
 * "có các mô hình từ rẻ lên đắt để lựa chọn và biết giá tiền khi tạo xong 1 ảnh").
 * Dùng chung cho vẽ ảnh bằng tay và ảnh tự tạo theo lịch đăng bài.
 */


export function vndAnh(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return 'chưa rõ giá';
  const vnd = usd * TY_GIA;
  // Ảnh rẻ chỉ vài chục đồng: làm tròn tới 10đ thay vì 500đ để không ra "0đ".
  const tron = vnd < 2_000 ? Math.max(10, Math.round(vnd / 10) * 10) : Math.round(vnd / 100) * 100;
  return `~${tron.toLocaleString('vi-VN')}đ`;
}

/** Giá một ảnh theo đúng độ nét / chất lượng đang chọn. */
export function giaMotAnh(m: ModelAnh | undefined, lc: LuaChonVeAnh): number | null {
  if (!m) return null;
  const d = lc.doNet && m.doNet.includes(lc.doNet) ? lc.doNet : (m.doNet[0] ?? '');
  const c = lc.chatLuong && m.chatLuong.includes(lc.chatLuong) ? lc.chatLuong : (m.chatLuong[0] ?? '');
  return m.giaTheoMuc[`${d}|${c}`] ?? m.gia;
}

const TEN_CHAT_LUONG: Record<string, string> = { low: 'Thấp', medium: 'Vừa', high: 'Cao' };
/** Khung hay dùng cho bài đăng; mô hình không có khung nào thì ẩn. */
const KHUNG_BAI = ['1:1', '4:5', '3:4', '9:16', '16:9'];

export function ChonMoHinhAnh({
  giaTri,
  onDoi,
  coAnhMau = false,
  onGia,
  tieuDe = 'Mô hình vẽ ảnh — xếp rẻ tới đắt',
}: {
  tieuDe?: string;
  giaTri: LuaChonVeAnh;
  onDoi: (moi: LuaChonVeAnh) => void;
  /** Báo giá một ảnh (USD) mỗi khi lựa chọn đổi — để màn hình cha tính tiền theo tuần. */
  onGia?: (usd: number | null) => void;
  /** Đang vẽ lại từ ảnh mẫu: mô hình không nhận ảnh xếp cuối, không chọn được. */
  coAnhMau?: boolean;
}) {
  const [models, setModels] = useState<ModelAnh[]>([]);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    let huy = false;
    api.ai
      .imageModels(coAnhMau)
      .then(({ data }) => {
        if (huy) return;
        setModels(data.models);
        // Chưa chọn (hoặc mô hình cũ đã bị gỡ) → mô hình rẻ nhất dùng được, người dùng đổi lúc nào cũng được.
        const dung = data.models.filter((m) => !m.lyDo);
        if (!dung.some((m) => m.id === giaTri.model) && dung[0]) onDoi({ model: dung[0].id });
      })
      .catch(() => setLoi('Chưa tải được danh sách mô hình vẽ ảnh.'));
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coAnhMau]);

  const m = models.find((x) => x.id === giaTri.model);
  const giaHienTai = giaMotAnh(m, giaTri);
  useEffect(() => {
    onGia?.(giaHienTai);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giaHienTai]);
  const khung = m ? KHUNG_BAI.filter((k) => m.khung.includes(k)) : [];
  const nut = (chon: boolean) =>
    clsx(
      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
      chon ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
    );

  if (loi) return <p className="text-xs text-error">{loi}</p>;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-on-surface">{tieuDe}</label>
      <select
        value={giaTri.model}
        onChange={(e) => onDoi({ model: e.target.value })}
        className="bg-surface-container-high w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
      >
        {models.map((x) => (
          <option key={x.id} value={x.id} disabled={Boolean(x.lyDo)}>
            {x.ten}
            {x.phanKhuc ? ` (${x.phanKhuc})` : ''} · {x.xepHang} — {x.lyDo ? `không chọn được: ${x.lyDo}` : `${vndAnh(x.gia)}/ảnh`}
          </option>
        ))}
      </select>
      {m && m.doNet.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-on-surface-variant">Độ nét:</span>
          {m.doNet.map((d) => (
            <button key={d} type="button" onClick={() => onDoi({ ...giaTri, doNet: d })} className={nut((giaTri.doNet ?? m.doNet[0]) === d)}>
              {d} · {vndAnh(m.giaTheoMuc[`${d}|${giaTri.chatLuong ?? m.chatLuong[0] ?? ''}`])}
            </button>
          ))}
        </div>
      )}
      {m && m.chatLuong.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-on-surface-variant">Chất lượng:</span>
          {m.chatLuong.map((c) => (
            <button key={c} type="button" onClick={() => onDoi({ ...giaTri, chatLuong: c })} className={nut((giaTri.chatLuong ?? m.chatLuong[0]) === c)}>
              {TEN_CHAT_LUONG[c] ?? c} · {vndAnh(m.giaTheoMuc[`${giaTri.doNet ?? m.doNet[0] ?? ''}|${c}`])}
            </button>
          ))}
        </div>
      )}
      {khung.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-on-surface-variant">Khung:</span>
          <button type="button" onClick={() => onDoi({ ...giaTri, khung: undefined })} className={nut(!giaTri.khung)}>
            Tự động
          </button>
          {khung.map((k) => (
            <button key={k} type="button" onClick={() => onDoi({ ...giaTri, khung: k })} className={nut(giaTri.khung === k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      {m && (
        <p className="text-xs text-on-surface">
          Giá mỗi ảnh: <b className="text-primary">{vndAnh(giaMotAnh(m, giaTri))}</b>
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useActivePage } from '../lib/ActivePage';
import { api, ApiError, type LoaiThuVien, type MucThuVien } from '../lib/api';
import { hoiXacNhan } from './HopHoi';

/**
 * Thư viện ảnh SẢN PHẨM / NHÂN VẬT của Trang — lưu một lần, dùng lại cho ảnh và video AI
 * (chủ dự án 03/10/2026, học từ Pippit / Dreamina). Dòng chính gọn; mở ra mới thấy ảnh.
 */

const TEN_LOAI: Record<LoaiThuVien, string> = { san_pham: 'Sản phẩm', nhan_vat: 'Nhân vật' };

export function ThuVienAnh({
  onDung,
  tieuDe = 'Thư viện sản phẩm & nhân vật',
}: {
  /** Bấm một ảnh → app đưa ảnh lên kho rồi trả địa chỉ dùng được ngay. */
  onDung: (url: string, ten: string) => void;
  tieuDe?: string;
}) {
  const [ds, setDs] = useState<MucThuVien[]>([]);
  const [loi, setLoi] = useState('');
  const [dangDung, setDangDung] = useState<number | null>(null);
  const [anhMoi, setAnhMoi] = useState<string>('');
  const [tenMoi, setTenMoi] = useState('');
  const [loaiMoi, setLoaiMoi] = useState<LoaiThuVien>('san_pham');
  const [dangLuu, setDangLuu] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const oTep = useRef<HTMLInputElement>(null);

  // Thư viện là CỦA CỬA HÀNG đang chọn — đổi cửa hàng thì tải lại (bản cũ tải một lần, đổi cửa hàng vẫn hiện ảnh cũ).
  const { activeTrangId } = useActivePage();
  useEffect(() => {
    let huy = false;
    setDs([]);
    setLoi('');
    api.ai
      .thuVien()
      .then(({ data }) => !huy && setDs(data))
      .catch(() => !huy && setLoi('Chưa tải được thư viện.'));
    return () => { huy = true; };
  }, [activeTrangId]);

  const dung = async (m: MucThuVien) => {
    if (dangDung) return;
    setDangDung(m.id);
    setLoi('');
    try {
      const { data } = await api.ai.dungThuVien(m.id);
      onDung(data.url, m.ten);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa dùng được ảnh này');
    } finally {
      setDangDung(null);
    }
  };

  const taiLen = async (f: File) => {
    setDangTai(true);
    setLoi('');
    try {
      const item = await api.posts.uploadMedia(f);
      setAnhMoi(item.url);
      setTenMoi(f.name.replace(/\.[^.]+$/, '').slice(0, 80));
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được ảnh lên');
    } finally {
      setDangTai(false);
    }
  };

  const luu = async () => {
    if (!anhMoi || dangLuu) return;
    setDangLuu(true);
    setLoi('');
    try {
      const { data } = await api.ai.themThuVien({ loai: loaiMoi, ten: tenMoi, url: anhMoi });
      setDs((cu) => [data, ...cu]);
      setAnhMoi('');
      setTenMoi('');
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa lưu được vào thư viện');
    } finally {
      setDangLuu(false);
    }
  };

  const xoa = async (m: MucThuVien) => {
    if (!(await hoiXacNhan({ tieuDe: `Xoá "${m.ten}" khỏi thư viện?`, nutDongY: 'Xoá', nguyHiem: true }))) return;
    try {
      await api.ai.xoaThuVien(m.id);
      setDs((cu) => cu.filter((x) => x.id !== m.id));
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa xoá được');
    }
  };

  const nut = (chon: boolean) =>
    clsx(
      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
      chon ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
    );

  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-xs">
      <summary className="cursor-pointer font-bold text-on-surface">
        {tieuDe} ({ds.length}) <span className="font-normal text-on-surface-variant">— bấm ảnh để dùng</span>
      </summary>
      <div className="mt-3 space-y-3">
        {loi && <p className="text-error">{loi}</p>}
        {(['san_pham', 'nhan_vat'] as const).map((loai) => {
          const nhom = ds.filter((m) => m.loai === loai);
          if (!nhom.length) return null;
          return (
            <div key={loai}>
              <span className="block text-on-surface-variant mb-1.5">{TEN_LOAI[loai]}</span>
              <div className="flex flex-wrap gap-2">
                {nhom.map((m) => (
                  <div key={m.id} className="relative w-20">
                    <button type="button" onClick={() => dung(m)} disabled={dangDung !== null} title={`Dùng "${m.ten}"`} className="block w-20">
                      <img
                        src={`/api/ai/thu-vien/${m.id}/anh`}
                        alt={m.ten}
                        className={clsx(
                          'w-20 h-20 rounded-lg object-cover border-2',
                          dangDung === m.id ? 'border-primary animate-pulse' : 'border-transparent hover:border-primary/60'
                        )}
                      />
                      <span className="block truncate text-[11px] text-on-surface mt-0.5">{m.ten}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => xoa(m)}
                      title="Xoá khỏi thư viện"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {ds.length === 0 && <p className="text-on-surface-variant">Chưa có ảnh nào. Lưu ảnh sản phẩm, nhân vật một lần để dùng lại mãi.</p>}

        <input
          ref={oTep}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void taiLen(f);
            e.target.value = '';
          }}
        />
        {anhMoi ? (
          <div className="flex flex-wrap items-center gap-2">
            <img src={anhMoi} alt="" className="w-12 h-12 rounded-lg object-cover border border-outline-variant" />
            {(['san_pham', 'nhan_vat'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLoaiMoi(l)} className={nut(loaiMoi === l)}>
                {TEN_LOAI[l]}
              </button>
            ))}
            <input
              value={tenMoi}
              onChange={(e) => setTenMoi(e.target.value)}
              placeholder="Tên, vd. Cà phê túi 500g"
              className="bg-surface-container-high flex-1 min-w-[140px] rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            <button type="button" onClick={luu} disabled={dangLuu || !tenMoi.trim()} className={clsx(nut(true), 'disabled:opacity-50')}>
              {dangLuu ? 'Đang lưu…' : 'Lưu vào thư viện'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => oTep.current?.click()}
            disabled={dangTai}
            className="w-full py-2 rounded-lg border border-dashed border-outline-variant text-on-surface-variant font-bold hover:border-primary/50 disabled:opacity-60"
          >
            {dangTai ? 'Đang tải ảnh…' : '+ Thêm ảnh vào thư viện'}
          </button>
        )}
      </div>
    </details>
  );
}

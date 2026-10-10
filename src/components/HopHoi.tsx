import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import HopThoai, { NHAN_O, NUT_CHINH, NUT_PHU, O_NHAP } from './HopThoai';

/**
 * Hộp hỏi lại / hộp nhập DÙNG CHUNG của app — thay hẳn confirm() / prompt() / alert() của trình duyệt.
 *
 * Vì sao: chủ dự án 04/10/2026 — "thay cái thông báo này bằng chính lệnh mô hình chúng ta, không được sử dụng
 * thông báo qua trang kiểu này nữa". Hộp của trình duyệt hiện "localhost:3000 says", lệch hẳn giao diện app, lộ địa
 * chỉ máy chủ. Mọi chỗ hỏi lại / nhập nhanh đi qua đây; bộ kiểm tra cấm gọi lại hộp của trình duyệt.
 *
 * Cách dùng (giống hộp cũ, chỉ thêm await):
 *   if (!(await hoiXacNhan({ tieuDe: 'Xoá bài này?', nutDongY: 'Xoá', nguyHiem: true }))) return;
 *   const ten = await hoiNhap({ tieuDe: 'Đổi tên', macDinh: cu });   // null = bấm Huỷ
 *   await baoTin({ tieuDe: 'Đã đổi', noiDung: '…' });
 */

export interface TuyChonHoi {
  tieuDe: string;
  /** Nội dung giải thích. Chuỗi có xuống dòng (\n) được giữ nguyên. */
  noiDung?: ReactNode;
  /** Chữ trên nút đồng ý (mặc định "Đồng ý"). */
  nutDongY?: string;
  /** Chữ trên nút huỷ (mặc định "Huỷ"). */
  nutHuy?: string;
  /** Việc không lấy lại được (xoá, kết thúc…) — nút đồng ý màu đỏ. */
  nguyHiem?: boolean;
  /** Tên biểu tượng Material Symbols (mặc định theo loại hộp). */
  bieuTuong?: string;
}

export interface TuyChonNhap extends TuyChonHoi {
  /** Nhãn ô nhập. */
  nhan?: string;
  macDinh?: string;
  /** Chữ mờ gợi ý trong ô nhập. */
  goiY?: string;
  /** Trả về câu báo lỗi nếu giá trị chưa hợp lệ (nút đồng ý bị khoá); null nếu hợp lệ. */
  kiemTra?: (giaTri: string) => string | null;
}

type Yeu = { id: number } & (
  | { loai: 'hoi'; tuyChon: TuyChonHoi; tra: (v: boolean) => void }
  | { loai: 'nhap'; tuyChon: TuyChonNhap; tra: (v: string | null) => void }
  | { loai: 'bao'; tuyChon: TuyChonHoi; tra: () => void }
);

// Hàng đợi ở mức mô-đun: gọi được từ bất cứ hàm nào, không cần hook; mỗi lúc chỉ hiện một hộp.
let hangDoi: Yeu[] = [];
let veLai: (() => void) | null = null;
let soThuTu = 0;
type KhongId<T> = T extends unknown ? Omit<T, 'id'> : never;
const them = (y: KhongId<Yeu>) => {
  hangDoi = [...hangDoi, { ...y, id: ++soThuTu } as Yeu];
  veLai?.();
};

/** Hỏi lại trước khi làm. true = đồng ý, false = huỷ / đóng. */
export const hoiXacNhan = (tuyChon: TuyChonHoi) =>
  new Promise<boolean>((tra) => them({ loai: 'hoi', tuyChon, tra }));

/** Hỏi nhập một dòng chữ. Trả về chữ đã nhập (chưa cắt khoảng trắng), null = huỷ / đóng. */
export const hoiNhap = (tuyChon: TuyChonNhap) =>
  new Promise<string | null>((tra) => them({ loai: 'nhap', tuyChon, tra }));

/** Báo một tin, chỉ có nút đóng. */
export const baoTin = (tuyChon: TuyChonHoi) => new Promise<void>((tra) => them({ loai: 'bao', tuyChon, tra }));

/** Gắn MỘT lần ở gốc ứng dụng (main.tsx). */
export function NoiHopHoi() {
  const [, setDem] = useState(0);
  useEffect(() => {
    veLai = () => setDem((d) => d + 1);
    return () => {
      veLai = null;
    };
  }, []);
  const yeu = hangDoi[0];
  // Mỗi lượt hỏi một hộp mới (ô nhập không giữ chữ của lượt trước).
  return yeu ? <Fragment key={yeu.id}><MotHop yeu={yeu} /></Fragment> : null;
}

function MotHop({ yeu }: { yeu: Yeu }) {
  const t = yeu.tuyChon;
  const [giaTri, setGiaTri] = useState(yeu.loai === 'nhap' ? (yeu.tuyChon.macDinh ?? '') : '');
  const o = useRef<HTMLInputElement>(null);
  const loi = yeu.loai === 'nhap' ? (yeu.tuyChon.kiemTra?.(giaTri) ?? null) : null;

  const xong = (dongY: boolean) => {
    hangDoi = hangDoi.slice(1);
    if (yeu.loai === 'hoi') yeu.tra(dongY);
    else if (yeu.loai === 'nhap') yeu.tra(dongY ? giaTri : null);
    else yeu.tra();
    veLai?.();
  };

  /*
   * Esc chỉ đóng HỘP NÀY. Hộp hỏi thường mở chồng lên một hộp thoại khác (vd. hỏi giá video trong ô Soạn bài) —
   * hộp đó cũng nghe Esc nên phải chặn từ pha bắt sự kiện, không thì một lần Esc đóng luôn cả ô đang soạn.
   */
  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      xong(false);
    };
    window.addEventListener('keydown', phim, true);
    return () => window.removeEventListener('keydown', phim, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (yeu.loai === 'nhap') {
      o.current?.focus();
      o.current?.select();
    }
  }, [yeu.loai]);

  const nutChinh = t.nguyHiem
    ? NUT_CHINH.replace('bg-primary text-on-primary', 'bg-error text-on-error')
    : NUT_CHINH;

  return (
    // Nằm trên mọi hộp thoại khác (gắn sau App trong cây, cùng lớp z).
    <div className="relative z-[110]">
      <HopThoai
        co="vua"
        bieuTuong={t.bieuTuong ?? (t.nguyHiem ? 'warning' : yeu.loai === 'nhap' ? 'edit' : yeu.loai === 'bao' ? 'info' : 'help')}
        tieuDe={t.tieuDe}
        onDong={() => xong(false)}
        dongKhiBamNgoai={false}
        chan={
          yeu.loai === 'bao' ? (
            <button type="button" onClick={() => xong(true)} className={NUT_CHINH}>
              {t.nutDongY ?? 'Đã hiểu'}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => xong(false)} className={NUT_PHU}>
                {t.nutHuy ?? 'Huỷ'}
              </button>
              <button type="button" onClick={() => xong(true)} disabled={Boolean(loi)} className={nutChinh}>
                {t.nutDongY ?? 'Đồng ý'}
              </button>
            </>
          )
        }
      >
        {t.noiDung && (
          <div className="text-base text-on-surface-variant leading-relaxed whitespace-pre-line">{t.noiDung}</div>
        )}
        {yeu.loai === 'nhap' && (
          <label className="block mt-5">
            {yeu.tuyChon.nhan && <span className={NHAN_O}>{yeu.tuyChon.nhan}</span>}
            <input
              ref={o}
              type="text"
              value={giaTri}
              onChange={(e) => setGiaTri(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loi) xong(true);
              }}
              placeholder={yeu.tuyChon.goiY}
              className={O_NHAP}
            />
            {loi && giaTri && <span className="block text-sm text-error mt-1.5">{loi}</span>}
          </label>
        )}
      </HopThoai>
    </div>
  );
}

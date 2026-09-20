import type React from 'react';
import { clsx } from 'clsx';
import type { TrangVanHanh } from '../lib/api';

/**
 * Đọc tình trạng vận hành của một trang thành việc-phải-làm.
 *
 * Người điều hành không cần biết "tin_7_ngay = 0"; họ cần biết "trang này im
 * cả tuần, đi xem tại sao". Chỗ này dịch số thành câu như vậy, và dùng chung
 * cho cả dải cảnh báo lẫn thẻ từng trang để hai nơi không nói khác nhau.
 */

export type MucDo = 'hong' | 'canXem' | 'on';

export interface Viec {
  mucDo: MucDo;
  chu: string;
}

export function docTinhTrang(t: TrangVanHanh): Viec[] {
  const viec: Viec[] = [];

  // Nặng nhất: kênh đứt thì mọi thứ khác không còn ý nghĩa.
  if (t.kenh_can_noi_lai > 0) {
    viec.push({ mucDo: 'hong', chu: `${t.kenh_can_noi_lai} kênh cần nối lại` });
  } else if (t.kenh_noi === 0) {
    viec.push({ mucDo: 'canXem', chu: 'Chưa nối Fanpage nào' });
  }

  /*
   * Đã nối kênh mà chưa dạy AI là trường hợp nguy hiểm nhất mà nhìn qua không
   * thấy: khách vẫn nhắn tới, AI vẫn trả lời, nhưng trả lời bằng bộ não trống.
   */
  if (t.kenh_noi > 0 && t.da_day_vai_tro === 0) {
    viec.push({ mucDo: 'hong', chu: 'Đã nối kênh nhưng chưa dạy AI bán hàng' });
  } else if (t.kenh_noi > 0 && t.so_tai_lieu === 0) {
    viec.push({ mucDo: 'canXem', chu: 'Chưa có tài liệu, AI không biết giá' });
  }

  if (t.cho_nguoi > 0) {
    viec.push({ mucDo: 'hong', chu: `${t.cho_nguoi} khách đang chờ người trả lời` });
  }

  // Có kênh, đã dạy, mà cả tuần không một tin nhắn nào — thường là webhook chết.
  if (t.kenh_noi > 0 && t.tin_7_ngay === 0) {
    viec.push({ mucDo: 'canXem', chu: 'Cả tuần không có tin nhắn nào' });
  }

  if (!t.is_active) viec.push({ mucDo: 'hong', chu: 'Trang đang bị khoá' });

  if (viec.length === 0) viec.push({ mucDo: 'on', chu: 'Đang chạy bình thường' });
  return viec;
}

/** Mức nặng nhất trong danh sách việc, để tô màu cả thẻ. */
export function mucDoNang(viec: Viec[]): MucDo {
  if (viec.some((v) => v.mucDo === 'hong')) return 'hong';
  if (viec.some((v) => v.mucDo === 'canXem')) return 'canXem';
  return 'on';
}

export function NhanTinhTrang({ viec }: { viec: Viec; key?: React.Key }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        viec.mucDo === 'hong' && 'bg-error/15 text-error',
        viec.mucDo === 'canXem' && 'bg-amber-500/15 text-amber-500',
        viec.mucDo === 'on' && 'bg-green-500/15 text-green-500'
      )}
    >
      <span className="material-symbols-outlined text-[14px]">
        {viec.mucDo === 'hong' ? 'error' : viec.mucDo === 'canXem' ? 'warning' : 'check_circle'}
      </span>
      {viec.chu}
    </span>
  );
}

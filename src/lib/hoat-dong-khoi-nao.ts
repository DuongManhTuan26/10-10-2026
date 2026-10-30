import type { MaNhanVien, SuKienKhoiNao } from './api';

/*
 * TRẠNG THÁI NHÂN VIÊN KHỐI NÃO (31/10/2026) — suy THUẦN từ việc thật (api.dieuHanh.hoatDong), không bịa: chưa có việc thì
 * "chờ việc". Không có "đang xử lý" (chủ dự án: báo xong là đủ). Dùng ở KhoiNaoVanPhong.tsx; phép kiểm gọi thẳng.
 */

/** Việc thật gần đây + lúc máy khách nhận (tuổi sự kiện = tuoi máy chủ + thời gian từ lúc nhận). */
export interface HoatDongKhoiNao {
  suKien: SuKienKhoiNao[];
  nhanLuc: number;
}
export type TrangThaiNv = 'cho' | SuKienKhoiNao['loai'];

/** Việc mới giữ trạng thái 90 giây; cảnh báo giữ suốt cửa sổ 10 phút của máy chủ (trừ khi có việc mới hơn). */
export const GIU_VIEC_S = 90;
export const GIU_CANH_BAO_S = 600;

const tuoiNay = (hd: HoatDongKhoiNao, e: SuKienKhoiNao, bayGio: number) => e.tuoi + (bayGio - hd.nhanLuc) / 1000;

/** Trạng thái MỘT nhân viên: việc mới nhất ≤ 90 giây → trạng thái đó; không thì cảnh báo ≤ 10 phút; không thì chờ việc. */
export function trangThaiNv(hd: HoatDongKhoiNao | null, ai: MaNhanVien, bayGio: number): { tt: TrangThaiNv; su: SuKienKhoiNao | null; giay: number } {
  if (!hd) return { tt: 'cho', su: null, giay: 0 };
  const cua = hd.suKien.filter((e) => e.ai === ai).sort((a, b) => a.tuoi - b.tuoi);
  const moi = cua[0];
  if (moi && tuoiNay(hd, moi, bayGio) <= GIU_VIEC_S) return { tt: moi.loai, su: moi, giay: tuoiNay(hd, moi, bayGio) };
  const canh = cua.find((e) => e.loai === 'canh_bao');
  if (canh && tuoiNay(hd, canh, bayGio) <= GIU_CANH_BAO_S) return { tt: 'canh_bao', su: canh, giay: tuoiNay(hd, canh, bayGio) };
  return { tt: 'cho', su: null, giay: 0 };
}

/** Dòng chảy đang diễn ra (≤ 90 giây) giữa các văn phòng: "noi_dung>quang_cao", "ban_hang>dieu_hanh"… */
export function luongDang(hd: HoatDongKhoiNao | null, bayGio: number): Set<string> {
  const ra = new Set<string>();
  for (const e of hd?.suKien ?? []) {
    if (!e.luong_tu || !e.luong_den || e.luong_tu === e.luong_den || tuoiNay(hd!, e, bayGio) > GIU_VIEC_S) continue;
    for (const tu of e.luong_tu === 'ba_ai' ? (['noi_dung', 'quang_cao', 'ban_hang'] as const) : [e.luong_tu]) ra.add(`${tu}>${e.luong_den}`);
  }
  return ra;
}

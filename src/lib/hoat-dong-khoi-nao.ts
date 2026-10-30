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

/*
 * XEM THỬ CHUYỂN ĐỘNG (31/10/2026, chủ dự án: "cho công tắc lúc nào muốn chuyển động thử thì bật lên, tắt đi thì chỉ chạy theo
 * việc thật"). Chuỗi việc MẪU một vòng làm việc liền mạch của 4 AI — chỉ dùng khi công tắc bật (mặc định tắt, không lưu),
 * nhãn ghi rõ "Thử". Không gọi máy chủ, không ghi gì.
 */
export const BUOC_THU_MS = 3500;
const GIAN_CACH_THU_S = 31;
const KICH_BAN_THU: Omit<SuKienKhoiNao, 'tuoi'>[] = [
  { ai: 'ban_hang', loai: 'nhan', chu: 'Khách nhắn tin', luong_tu: null, luong_den: null },
  { ai: 'ban_hang', loai: 'xong', chu: 'Đã trả lời khách', luong_tu: null, luong_den: null },
  { ai: 'noi_dung', loai: 'xong', chu: 'Viết xong nội dung', luong_tu: null, luong_den: null },
  { ai: 'noi_dung', loai: 'ban_giao', chu: 'Đã đăng bài', luong_tu: 'noi_dung', luong_den: 'quang_cao' },
  { ai: 'quang_cao', loai: 'xong', chu: 'Đã đẩy bài quảng cáo', luong_tu: null, luong_den: null },
  { ai: 'quang_cao', loai: 'ban_giao', chu: 'Khách từ quảng cáo', luong_tu: 'quang_cao', luong_den: 'ban_hang' },
  { ai: 'ban_hang', loai: 'bao_cao', chu: 'Chốt đơn mới', luong_tu: 'ban_hang', luong_den: 'dieu_hanh' },
  { ai: 'dieu_hanh', loai: 'xong', chu: 'Chấm điểm 3 AI xong', luong_tu: 'ba_ai', luong_den: 'dieu_hanh' },
  { ai: 'ban_hang', loai: 'canh_bao', chu: 'Cần người tiếp khách', luong_tu: null, luong_den: null },
  { ai: 'dieu_hanh', loai: 'bao_cao', chu: 'Có đề xuất chờ duyệt', luong_tu: null, luong_den: null },
];

/** Bước thứ `buoc` của vòng thử: việc của bước đó vừa xảy ra (0 giây), các bước trước lùi mỗi bước 31 giây. */
export function kichBanThu(buoc: number, bayGio: number): HoatDongKhoiNao {
  const suKien: SuKienKhoiNao[] = [];
  for (let lui = 0; lui < KICH_BAN_THU.length; lui++) {
    const i = (((buoc - lui) % KICH_BAN_THU.length) + KICH_BAN_THU.length) % KICH_BAN_THU.length;
    suKien.push({ ...KICH_BAN_THU[i], tuoi: lui * GIAN_CACH_THU_S });
  }
  return { suKien, nhanLuc: bayGio };
}

/**
 * Ý ĐỊNH ĐẨY BÀI — mã chống trừ tiền hai lần gắn với Ý ĐỊNH, không gắn với lần bấm (phiên kiểm duyệt bắt 22/10/2026).
 *
 * Tài liệu POST /v1/ads/boost: "same key and body replays the original 201, and distinct keys always create distinct
 * ads"; "same key + different body → 422". Lần bấm đầu hết giờ chờ (máy chủ báo "Chưa rõ kết quả") mà quảng cáo thật ra
 * đã tạo: bấm lại với MÃ MỚI là quảng cáo thứ hai. Nên:
 *  - cùng cấu hình (bài, ngân sách, số ngày, mục tiêu, nhắm chọn) → GIỮ mã + mốc bắt đầu (thân lệnh giống hệt → nhà
 *    cung cấp trả lại quảng cáo cũ);
 *  - đổi bất kỳ trường nào → mã + mốc mới; đẩy thành công → bỏ ý định (lần sau là quảng cáo mới, có chủ đích).
 * Mốc bắt đầu (batDau) đi cùng mã: máy chủ dựng tên + ngày kết thúc từ mốc này, không từ "bây giờ".
 */
export const HAN_Y_DINH_MS = 20 * 3_600_000;

export interface YDinhDayBai {
  khoa: string;
  batDau: string;
  dauVet: string;
}

export function yDinhDayBai(
  truoc: YDinhDayBai | null,
  cauHinh: { postId: number; dailyBudget: number; durationDays: number; mucTieu: string; nhamChon: unknown },
  bayGio: string,
  taoMa: () => string
): YDinhDayBai {
  const dauVet = JSON.stringify([cauHinh.postId, cauHinh.dailyBudget, cauHinh.durationDays, cauHinh.mucTieu, cauHinh.nhamChon]);
  // Ý định quá 20 giờ thì làm mới: máy chủ chỉ nhận mốc trong 24 giờ (docMocDayBai) — giữ mãi là kẹt ở "phiên đã cũ".
  const conHan = truoc ? Date.parse(bayGio) - Date.parse(truoc.batDau) < HAN_Y_DINH_MS : false;
  if (truoc && conHan && truoc.dauVet === dauVet) return truoc;
  return { khoa: taoMa(), batDau: bayGio, dauVet };
}

/*
 * Ý định sống qua TẢI LẠI TRANG (phiên kiểm duyệt dặn 22/10/2026): bấm "chạy" → "Chưa rõ kết quả" → tải lại trang → bấm
 * lại vẫn phải là CÙNG mã. Lưu ở sessionStorage (cùng tab). Trình duyệt chặn lưu trữ thì vẫn chạy, chỉ mất lớp này.
 */
const KHOA_LUU = 'zn_y_dinh_day_bai';

type KhoLuu = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function kho(k?: KhoLuu): KhoLuu | null {
  try {
    return k ?? globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function docYDinhLuu(k?: KhoLuu): YDinhDayBai | null {
  try {
    const raw = kho(k)?.getItem(KHOA_LUU);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<YDinhDayBai>;
    return typeof o.khoa === 'string' && typeof o.batDau === 'string' && typeof o.dauVet === 'string'
      ? { khoa: o.khoa, batDau: o.batDau, dauVet: o.dauVet }
      : null;
  } catch {
    return null;
  }
}

export function luuYDinh(y: YDinhDayBai | null, k?: KhoLuu): void {
  try {
    const n = kho(k);
    if (!n) return;
    if (y) n.setItem(KHOA_LUU, JSON.stringify(y));
    else n.removeItem(KHOA_LUU);
  } catch {
    /* Chặn lưu trữ: bỏ qua — chỉ mất lớp chống trùng qua tải lại trang. */
  }
}

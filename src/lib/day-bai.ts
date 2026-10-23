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

/**
 * Khoảng ngày THẬT theo giờ Việt Nam — hàm thuần, dùng chung máy chủ (tham số gửi nhà cung cấp) và giao diện (chữ
 * hiện cho chủ shop), để hai bên luôn nói cùng một khoảng ngày. Bộ kiểm tra thử bằng mốc giờ giả.
 *
 * B1-b (18/10/2026): số liệu chiến dịch phải gửi fromDate/toDate (tài liệu GET /v1/ads/campaigns/{id}/analytics), không
 * có tham số "datePreset"; và lịch chạy quảng cáo hiện ngày thật từ hôm nay, không ghi cứng "Từ 15/08".
 */

const NGAY_MS = 86_400_000;
const LECH_VN_MS = 7 * 3_600_000;

/** Ngày lịch Việt Nam (YYYY-MM-DD) của một thời điểm. */
export function ngayVN(luc: Date): string {
  return new Date(luc.getTime() + LECH_VN_MS).toISOString().slice(0, 10);
}

/** Cộng số ngày vào một ngày dạng YYYY-MM-DD. */
export function congNgay(ngay: string, soNgay: number): string {
  return new Date(Date.parse(`${ngay}T00:00:00Z`) + soNgay * NGAY_MS).toISOString().slice(0, 10);
}

/** Thời điểm → "05/10/2026" theo giờ Việt Nam (có số 0 đứng đầu, thống nhất với dd/MM ở chỗ khác). */
export function ngayDayDu(iso: string): string {
  const n = ngayVN(new Date(iso));
  return `${n.slice(8, 10)}/${n.slice(5, 7)}/${n.slice(0, 4)}`;
}

/** "2026-10-18" → "18/10". */
export function ngayNgan(ngay: string): string {
  return `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;
}

/** Kỳ số liệu của màn Quảng cáo → khoảng ngày gồm cả hai đầu. Kỳ lạ rơi về 7 ngày qua. */
export function khoangTheoKy(ky: string, luc: Date = new Date()): { fromDate: string; toDate: string } {
  const homNay = ngayVN(luc);
  if (ky === 'last_30d') return { fromDate: congNgay(homNay, -29), toDate: homNay };
  if (ky === 'this_month') return { fromDate: `${homNay.slice(0, 7)}-01`, toDate: homNay };
  return { fromDate: congNgay(homNay, -6), toDate: homNay };
}

/** Lịch chạy quảng cáo: bắt đầu hôm nay, chạy đủ `soNgay` ngày (ngày cuối = hôm nay + soNgay − 1). */
export function lichChay(soNgay: number, luc: Date = new Date()): { tu: string; den: string } {
  const homNay = ngayVN(luc);
  return { tu: homNay, den: congNgay(homNay, Math.max(1, Math.floor(soNgay)) - 1) };
}

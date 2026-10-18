/**
 * Đọc MỘT chiến dịch quảng cáo theo ĐÚNG dạng tài liệu nhà cung cấp — hàm thuần, bộ kiểm tra thử bằng mẫu chép từ tài liệu.
 *
 * Tài liệu "## AdCampaign" (docs/zernio-api-reference.txt:27312): platformCampaignId, platform, campaignName, status (dẫn
 * xuất từ quảng cáo con: active > pending_review > paused > error > completed > cancelled > rejected), budget /
 * campaignBudget ({ amount, type: daily | lifetime }), currency, metrics (AdMetrics: spend, reach, conversions, actions…),
 * earliestAd. KHÔNG có id / name / dailyBudget / spend / startTime.
 *
 * Phiên kiểm duyệt bắt được 18/10/2026: bản cũ đọc c.id / c.name / c.dailyBudget… nên với chiến dịch thật thẻ hiện
 * "Chiến dịch không tên", mọi nút thao tác gửi mã "undefined". Thiếu trường nào thì để null — giao diện hiện "—", không bịa.
 */

export interface ChienDich {
  /** Mã chiến dịch của nền tảng — mọi lệnh thao tác dùng mã này. */
  id: string | null;
  ten: string | null;
  nenTang: string | null;
  /** Trạng thái thô của nhà cung cấp (chữ thường). */
  trangThai: string;
  nganSach: { soTien: number; loai: 'daily' | 'lifetime' } | null;
  tienTe: string | null;
  daChi: number | null;
  tiepCan: number | null;
  binhLuan: number | null;
  chuyenDoi: number | null;
  /** Quảng cáo sớm nhất trong chiến dịch — gần nhất với "ngày bắt đầu" mà tài liệu có. */
  quangCaoDauTien: string | null;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const so = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const chu = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export function docChienDich(tho: unknown): ChienDich {
  const c = rec(tho);
  const m = rec(c.metrics);
  const ns = rec(c.campaignBudget ?? c.budget);
  const loai = ns.type === 'daily' || ns.type === 'lifetime' ? ns.type : null;
  return {
    id: chu(c.platformCampaignId),
    ten: chu(c.campaignName),
    nenTang: chu(c.platform),
    trangThai: typeof c.status === 'string' ? c.status.toLowerCase() : '',
    nganSach: so(ns.amount) !== null && loai ? { soTien: so(ns.amount) as number, loai } : null,
    tienTe: chu(c.currency),
    daChi: so(m.spend),
    tiepCan: so(m.reach),
    // Meta: số bình luận nằm trong metrics.actions dưới khoá "comment" (raw Insights action_type).
    binhLuan: so(rec(m.actions).comment),
    chuyenDoi: so(m.conversions),
    quangCaoDauTien: chu(c.earliestAd),
  };
}

/** Trạng thái dẫn xuất của nhà cung cấp → nhãn tiếng Việt. Không gộp trạng thái lạ vào "Đã kết thúc". */
export function nhanTrangThaiChienDich(trangThai: string): string {
  switch (trangThai.toLowerCase()) {
    case 'active': return 'Đang chạy';
    case 'paused': return 'Tạm dừng';
    case 'pending_review': return 'Chờ duyệt';
    case 'error': return 'Lỗi';
    case 'completed': return 'Đã kết thúc';
    case 'cancelled': return 'Đã huỷ';
    case 'rejected': return 'Bị từ chối';
    default: return trangThai ? `Khác (${trangThai})` : 'Chưa rõ';
  }
}

import { env } from "../env.js";
import { kiemPhamVi } from "./pham-vi-goi.js";
import { AppError } from "../http.js";
import { giauNhaCungCap } from "./text.js";

/**
 * Cổng gọi phần quảng cáo của Zernio.
 *
 * Có hai loại định danh dễ lẫn, đã xác minh sống ngày 17/08/2026:
 *   accountId   — _id tài khoản metaads phía Zernio (ví dụ 6a8016...)
 *   adAccountId — id tài khoản quảng cáo phía Meta  (ví dụ act_1357505662010463)
 *
 * Hầu hết endpoint cần adAccountId, lấy được bằng
 * GET /ads/accounts?accountId={accountId}. Gửi lẫn hai giá trị này là nguyên
 * nhân của lỗi "adAccountId is required".
 */

export class AdsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "AdsError";
  }
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    /** Header thêm (vd. Idempotency-Key của lệnh nhân bản). */
    headers?: Record<string, string>;
    /** Hạn chờ riêng (ms). Đẩy bài có thể mất vài phút (tài liệu /v1/ads/boost "Retries"). */
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = "GET", query, body, headers, timeoutMs = 30_000 } = options;
  kiemPhamVi(method, path, query, undefined);
  const url = new URL(env.zernio.baseUrl + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.zernio.apiKey}`,
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Hết giờ chờ / đứt mạng: KHÔNG biết nhà cung cấp đã làm hay chưa — mã CHUA_RO để chỗ gọi nói thật, không thử lại.
    throw new AdsError(`Không nhận được trả lời cho ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`, 0, "CHUA_RO");
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new AdsError(
        `Zernio trả về nội dung không phải JSON cho ${method} ${path}`,
        response.status
      );
    }
  }

  if (!response.ok) {
    const parsed = data as { error?: string; code?: string } | null;
    throw new AdsError(
      parsed?.error ?? `Zernio trả lỗi ${response.status}`,
      response.status,
      parsed?.code
    );
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Tài khoản quảng cáo
// ---------------------------------------------------------------------------

export interface AdAccount {
  /** Id phía Meta, dạng act_xxx. Dùng làm adAccountId cho mọi lời gọi khác. */
  id: string;
  name: string;
  currency: string;
  /** 1 = đang hoạt động. Khác 1 nghĩa là bị vô hiệu hoặc chờ thanh toán. */
  accountStatus: number;
  businessName?: string;
  timezoneName?: string;
  minDailyBudget?: number;
  amountSpent?: string | number;
  balance?: string | number;
  [key: string]: unknown;
}

export async function listAdAccounts(accountId: string): Promise<AdAccount[]> {
  const data = await request<{ accounts?: AdAccount[] }>("/ads/accounts", {
    query: { accountId },
  });
  return data.accounts ?? [];
}

/**
 * Danh sách quảng cáo kèm số liệu trong khoảng ngày (GET /v1/ads). Lọc `pageId` = chỉ quảng cáo có nội dung chạy dưới
 * Fanpage đó — một tài khoản quảng cáo chạy cho mọi Fanpage trong Business Manager, nên tiền từng trang phải lọc theo
 * Fanpage. `metrics.spend` tính theo đơn vị tiền của tài khoản quảng cáo.
 */
export async function listAds(q: Record<string, string>): Promise<{
  ads: { metrics?: { spend?: number } | null }[];
  pagination?: { page?: number; pages?: number; total?: number };
}> {
  const d = await request<{ ads?: { metrics?: { spend?: number } | null }[]; pagination?: { page?: number; pages?: number; total?: number } }>(
    "/ads",
    { query: q }
  );
  return { ads: d.ads ?? [], pagination: d.pagination };
}

// ---------------------------------------------------------------------------
// Chiến dịch
// ---------------------------------------------------------------------------

/**
 * Một chiến dịch theo ĐÚNG tài liệu "## AdCampaign" (docs/zernio-api-reference.txt:27312). Bản cũ khai id / name /
 * dailyBudget / startTime — nhà cung cấp không trả các trường đó (phiên kiểm duyệt bắt được 18/10/2026). Giao diện đọc
 * qua src/lib/chien-dich.ts.
 */
export interface AdCampaign {
  platformCampaignId: string;
  platform: string;
  campaignName: string;
  status: string;
  budget?: { amount?: number; type?: "daily" | "lifetime" } | null;
  campaignBudget?: { amount?: number; type?: "daily" | "lifetime" } | null;
  budgetLevel?: "campaign" | "adset" | null;
  currency?: string | null;
  metrics?: Record<string, unknown> | null;
  platformAdAccountId?: string;
  earliestAd?: string;
  latestAd?: string;
  [key: string]: unknown;
}

export async function listCampaigns(params: {
  accountId: string;
  adAccountId?: string;
  limit?: number;
  /** Khoảng ngày của metrics (tài liệu 27196: fromDate/toDate, bỏ trống = 90 ngày) — phải khớp kỳ đang xem. */
  fromDate?: string;
  toDate?: string;
}): Promise<{ campaigns: AdCampaign[]; total: number }> {
  const data = await request<{
    campaigns?: AdCampaign[];
    pagination?: { total?: number };
  }>("/ads/campaigns", {
    query: {
      accountId: params.accountId,
      adAccountId: params.adAccountId,
      limit: params.limit ?? 50,
      fromDate: params.fromDate,
      toDate: params.toDate,
    },
  });
  return {
    campaigns: data.campaigns ?? [],
    total: data.pagination?.total ?? data.campaigns?.length ?? 0,
  };
}

/**
 * Số liệu một chiến dịch. Tham số theo đúng tài liệu GET /v1/ads/campaigns/{campaignId}/analytics: fromDate / toDate
 * (YYYY-MM-DD). Bản cũ gửi accountId + datePreset — tài liệu không có hai tham số này, nên chọn kỳ nào cũng ra mặc định
 * 90 ngày. Mã 202 (backfillPending) vẫn trả nội dung — request() coi 2xx là thành công.
 */
export async function getCampaignAnalytics(params: {
  campaignId: string;
  fromDate: string;
  toDate: string;
}): Promise<Record<string, unknown>> {
  return request(`/ads/campaigns/${encodeURIComponent(params.campaignId)}/analytics`, {
    query: { fromDate: params.fromDate, toDate: params.toDate },
  });
}

/** Nền tảng tài liệu cho phép ở lệnh đổi trạng thái chiến dịch (PUT /v1/ads/campaigns/{id}/status — 30086). */
export const NEN_TANG_CHIEN_DICH = ["facebook", "instagram", "tiktok", "linkedin", "pinterest", "google", "twitter", "openai"];
/** Nền tảng tài liệu cho phép nhân bản (POST /v1/ads/campaigns/{id}/duplicate — 28550); nền tảng khác trả 501. */
export const NEN_TANG_NHAN_BAN = ["facebook", "instagram", "tiktok", "linkedin"];
/** Nền tảng tài liệu cho phép sửa ngân sách chiến dịch (PUT /v1/ads/campaigns/{id} — 28108); khác thì 501. */
export const NEN_TANG_NGAN_SACH = ["facebook", "instagram", "google"];

/**
 * Lệnh đổi trạng thái MỘT chiến dịch — hàm thuần, đúng tài liệu 30086: PUT /ads/campaigns/{platformCampaignId}/status,
 * body { status: active | paused, platform }. Bản cũ gửi POST bulk-status { campaignIds, "ACTIVE"/"PAUSED"/"ARCHIVED" }
 * — sai cả tên trường lẫn giá trị (tài liệu 27142 đòi `campaigns`, chữ thường, không có ARCHIVED).
 */
export function lenhDoiTrangThai(campaignId: string, platform: string, status: "active" | "paused") {
  return {
    path: `/ads/campaigns/${encodeURIComponent(campaignId)}/status`,
    method: "PUT" as const,
    body: { status, platform },
  };
}

/**
 * Lệnh nhân bản — hàm thuần, đúng tài liệu 28550: `platform` bắt buộc; deepCopy để chép đủ nhóm / quảng cáo; bản sao
 * ở trạng thái PAUSED (không tự tiêu tiền). Idempotency-Key do giao diện sinh NGẪU NHIÊN mỗi lần bấm: tài liệu "same
 * key + same body replays the original response" — dùng lại key cũ thì không tạo bản sao mới mà vẫn báo thành công.
 */
export function lenhNhanBan(campaignId: string, platform: string, khoa: string) {
  return {
    path: `/ads/campaigns/${encodeURIComponent(campaignId)}/duplicate`,
    method: "POST" as const,
    body: { platform, deepCopy: true, statusOption: "PAUSED" },
    headers: { "Idempotency-Key": khoa },
  };
}

/**
 * Chiến dịch này có thuộc tài khoản quảng cáo của shop không — CHỈ ĐỌC. Khoá API dùng chung cho cả nền tảng, lệnh đổi
 * trạng thái / nhân bản không nhận accountId (tài liệu 30086, 28550), nên phải tự đối chiếu trước khi đổi: GET
 * /v1/ads/tree lọc theo campaignId + accountId + adAccountId (tài liệu 28957) — không thuộc thì không trả chiến dịch nào.
 */
export async function chienDichThuocTaiKhoan(p: { campaignId: string; accountId: string; adAccountId: string }): Promise<boolean> {
  const d = await request<{ campaigns?: unknown[] }>("/ads/tree", {
    query: { campaignId: p.campaignId, accountId: p.accountId, adAccountId: p.adAccountId, limit: 1 },
  });
  return (d.campaigns ?? []).length > 0;
}

export async function doiTrangThaiChienDich(campaignId: string, platform: string, status: "active" | "paused") {
  const l = lenhDoiTrangThai(campaignId, platform, status);
  return request<{ updated?: number; skipped?: number; skippedReasons?: string[]; message?: string }>(l.path, l);
}

export async function nhanBanChienDich(campaignId: string, platform: string, khoa: string): Promise<unknown> {
  const l = lenhNhanBan(campaignId, platform, khoa);
  return request(l.path, l);
}

/**
 * Sửa ngân sách chiến dịch — qua Zernio, không đẩy chủ shop sang Meta.
 *
 * Trước đây nút "Sửa ngân sách" mở thẳng Trình quản lý quảng cáo của Facebook.
 * Sai hai lần: chủ shop phải học một công cụ khác, và đó đúng là thứ mà mình
 * trả tiền cho Zernio để khỏi phải đụng tới.
 *
 * Ngân sách nằm ở hai tầng, và Meta chỉ cho đặt ở MỘT trong hai:
 *   - CBO: ngân sách ở tầng chiến dịch  -> sửa bằng hàm này.
 *   - ABO: ngân sách ở tầng nhóm quảng cáo -> Zernio trả 409 và phải sửa
 *     bằng updateAdSetBudget.
 * Nên lỗi 409 ở đây không phải hỏng hóc, mà là câu trả lời "ngân sách của
 * chiến dịch này nằm ở tầng dưới".
 */
export async function updateCampaignBudget(params: {
  campaignId: string;
  platform: string;
  amount: number;
  budgetType: "daily" | "lifetime";
  /**
   * Bắt buộc với chiến dịch CHƯA CÓ quảng cáo nào — trường hợp rất hay gặp khi
   * Meta từ chối mẫu quảng cáo sau lúc chiến dịch đã được tạo. Thiếu nó thì
   * Zernio trả 404 "Campaign not found" dù chiến dịch có thật. Với chiến dịch
   * bình thường thì Zernio bỏ qua trường này, nên cứ gửi kèm cho chắc.
   */
  accountId?: string;
}): Promise<unknown> {
  return request(`/ads/campaigns/${encodeURIComponent(params.campaignId)}`, {
    method: "PUT",
    body: {
      platform: params.platform,
      budget: { amount: params.amount, type: params.budgetType },
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
  });
}



// ---------------------------------------------------------------------------
// Số liệu
// ---------------------------------------------------------------------------

/**
 * Số liệu hiệu quả của một đối tượng quảng cáo.
 * objectId là id chiến dịch, nhóm quảng cáo, quảng cáo, hoặc chính tài khoản.
 */
export async function getInsights(params: {
  accountId: string;
  objectId: string;
  datePreset?: string;
  level?: string;
}): Promise<Record<string, unknown>> {
  return request("/ads/insights", {
    query: {
      accountId: params.accountId,
      objectId: params.objectId,
      datePreset: params.datePreset ?? "last_7d",
      level: params.level,
    },
  });
}

// ---------------------------------------------------------------------------
// Tệp đối tượng
// ---------------------------------------------------------------------------

export interface AdAudience {
  id: string;
  name: string;
  subtype?: string;
  approximateCount?: number;
  deliveryStatus?: string | { code?: number; description?: string };
  [key: string]: unknown;
}

export async function listAudiences(params: {
  accountId: string;
  adAccountId: string;
}): Promise<AdAudience[]> {
  const data = await request<{ audiences?: AdAudience[] }>("/ads/audiences", {
    query: { accountId: params.accountId, adAccountId: params.adAccountId },
  });
  return data.audiences ?? [];
}

/**
 * Đổi tên và mô tả một tệp đối tượng.
 *
 * Trước đây giao diện không sửa được gì, chỉ có một nút mở sang Trình quản lý
 * quảng cáo của Facebook — trong khi cả sản phẩm hứa "không cần mở trình quản
 * lý quảng cáo riêng". Đẩy chủ shop sang đó là tự phá lời hứa của chính mình.
 *
 * Giới hạn có thật, không giấu: tệp tải lên / theo website / tương đồng thì
 * QUY TẮC là bất biến, chỉ đổi được tên và mô tả. Riêng tệp nhắm chọn sẵn
 * (saved_targeting) mới thay được cả cấu hình nhắm.
 */
export async function updateAudience(params: {
  accountId: string;
  audienceId: string;
  name?: string;
  description?: string;
  spec?: Record<string, unknown>;
}): Promise<unknown> {
  return request(`/ads/audiences/${encodeURIComponent(params.audienceId)}`, {
    method: "PUT",
    query: { accountId: params.accountId },
    body: {
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.spec !== undefined ? { spec: params.spec } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Quảng cáo cho bài đã đăng
// ---------------------------------------------------------------------------

/*
 * ĐẨY BÀI / DỰ BÁO / TẠO TỆP — đúng OpenAPI 1.330.1 (mục 3, phiên kiểm duyệt duyệt 22/10/2026). Bản cũ lệch tài liệu cả
 * 3 lệnh: đẩy bài thiếu name / goal (bắt buộc), gửi dailyBudget / durationDays / objective / geoLocations / genders (không
 * có trong lược đồ) và postId của nhà cung cấp trên kênh metaads ("a Zernio postId is a 400 there"); dự báo gửi
 * `targeting` thay vì `spec`; tạo tệp gửi `subtype`. Chưa lần đẩy bài nào thành công (sổ so_thay_doi 0 dòng) nên chưa mất
 * tiền. Các lệnh dựng bằng HÀM THUẦN để bộ kiểm tra thử bằng dữ liệu giả.
 */

export type CheDoNham = "tu_chon" | "facebook_tu_tim";
export type GioiTinhNham = "all" | "male" | "female";
export type MucTieuDayBai = "nhan_tin" | "tuong_tac";
export const TUOI_NHO_NHAT = 18;
export const TUOI_LON_NHAT = 65;

/** H9 (TD-25): số tỉnh / sở thích tối đa mỗi lần đẩy bài. */
export const TOI_DA_TINH = 25;
export const TOI_DA_SO_THICH = 10;
const MA_NHAM = /^[\w:.-]{1,64}$/;

/** Danh sách mục đã chọn {mã, tên} — mã đúng dạng, tên có chữ, không trùng mã, không quá số. Sai → 400. */
function docMucChon(v: unknown, truongMa: "key" | "id", toiDa: number, ten: string): { ma: string; ten: string }[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new AppError(`${ten} không hợp lệ`, 400);
  if (v.length > toiDa) throw new AppError(`Chọn tối đa ${toiDa} ${ten.toLowerCase()}`, 400);
  const ds = v.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const ma = typeof o[truongMa] === "string" ? (o[truongMa] as string).trim() : "";
    const nhan = typeof o.name === "string" ? o.name.trim().slice(0, 100) : "";
    if (!MA_NHAM.test(ma) || !nhan) throw new AppError(`${ten} không hợp lệ — vui lòng chọn lại từ ô tìm`, 400);
    return { ma, ten: nhan };
  });
  if (new Set(ds.map((x) => x.ma)).size !== ds.length) throw new AppError(`${ten} bị chọn trùng`, 400);
  return ds;
}

/**
 * Nhắm chọn (TargetingSpec) — chỉ Việt Nam. Sai → lỗi kèm câu cho chủ shop.
 * H9 (TD-25): Tự chọn thêm tỉnh / thành (regions[{key}] — tài liệu: key từ targeting/search geoType=region) và sở thích
 * (interests[{id, name}] — "Each must include id and name"). Có tỉnh thì BỎ countries ['VN']: Meta báo "locations overlap"
 * khi vừa nhắm nước vừa nhắm vùng trong nước đó. Dự báo tiếp cận dùng CHÍNH hàm này (routes/ads.ts /reach-estimate).
 */
export function dungNhamChon(n: { cheDo?: unknown; tuoiTu?: unknown; tuoiDen?: unknown; gioiTinh?: unknown; tinh?: unknown; soThich?: unknown }): Record<string, unknown> {
  if (n.cheDo === "facebook_tu_tim") return { countries: ["VN"], advantage_audience: 1 };
  if (n.cheDo !== "tu_chon") throw new AppError("Cách chọn người xem không hợp lệ", 400);
  const tu = Number(n.tuoiTu), den = Number(n.tuoiDen);
  if (!Number.isInteger(tu) || !Number.isInteger(den) || tu < TUOI_NHO_NHAT || den > TUOI_LON_NHAT || tu > den) {
    throw new AppError(`Độ tuổi phải trong khoảng ${TUOI_NHO_NHAT}–${TUOI_LON_NHAT}, tuổi đầu không lớn hơn tuổi cuối`, 400);
  }
  if (n.gioiTinh !== "all" && n.gioiTinh !== "male" && n.gioiTinh !== "female") throw new AppError("Giới tính không hợp lệ", 400);
  const tinh = docMucChon(n.tinh, "key", TOI_DA_TINH, "Tỉnh / thành");
  const soThich = docMucChon(n.soThich, "id", TOI_DA_SO_THICH, "Sở thích");
  return {
    ...(tinh.length ? { regions: tinh.map((x) => ({ key: x.ma, name: x.ten })) } : { countries: ["VN"] }),
    ageMin: tu,
    ageMax: den,
    gender: n.gioiTinh,
    ...(soThich.length ? { interests: soThich.map((x) => ({ id: x.ma, name: x.ten })) } : {}),
  };
}

/*
 * TÌM TỈNH / SỞ THÍCH (H9, TD-25) — GET /v1/ads/targeting/search (accountId bắt buộc; dimension geo | interest; geoType
 * region; countryCode; locale; limit ≤ 100). accountId = kênh metaads của CỬA HÀNG đang chọn (routes/ads.ts), đường nằm
 * trong DUONG_DANH_SACH (pham-vi-goi.ts) → thiếu accountId là chặn trước khi gọi.
 */
export type LoaiTimNham = "tinh" | "so_thich";
export const SO_KET_QUA_TIM = 10;

export function lenhTimNham(p: { accountId: string; adAccountId: string; loai: unknown; q: unknown }) {
  if (p.loai !== "tinh" && p.loai !== "so_thich") throw new AppError("Loại tìm không hợp lệ", 400);
  const q = typeof p.q === "string" ? p.q.trim() : "";
  if (q.length < 2 || q.length > 60) throw new AppError("Vui lòng gõ từ 2 đến 60 ký tự để tìm", 400);
  return {
    path: "/ads/targeting/search",
    query: {
      accountId: p.accountId,
      adAccountId: p.adAccountId,
      q,
      ...(p.loai === "tinh" ? { dimension: "geo", geoType: "region", countryCode: "VN" } : { dimension: "interest" }),
      locale: "vi_VN",
      limit: SO_KET_QUA_TIM,
    },
  };
}

/** Kết quả tìm: CHỈ giữ đúng loại (region cho tỉnh, interest cho sở thích) — lọc ở máy chủ, không tin nhà cung cấp/giao diện. */
export function docKetQuaTimNham(raw: unknown, loai: LoaiTimNham): { id: string; name: string; path: string[]; audienceSize: number | null }[] {
  const ds = Array.isArray((raw as { results?: unknown })?.results) ? ((raw as { results: unknown[] }).results) : [];
  const can = loai === "tinh" ? "region" : "interest";
  return ds
    .map((x) => (x ?? {}) as Record<string, unknown>)
    .filter((x) => x.type === can && typeof x.id === "string" && MA_NHAM.test(x.id) && typeof x.name === "string" && x.name.trim() !== "")
    .slice(0, SO_KET_QUA_TIM)
    .map((x) => ({
      id: x.id as string,
      name: (x.name as string).trim(),
      path: Array.isArray(x.path) ? (x.path as unknown[]).filter((s): s is string => typeof s === "string") : [],
      audienceSize: typeof x.audienceSize === "number" && Number.isFinite(x.audienceSize) && x.audienceSize >= 0 ? x.audienceSize : null,
    }));
}

export async function timNham(lenh: ReturnType<typeof lenhTimNham>): Promise<unknown> {
  return request(lenh.path, { query: lenh.query });
}

/*
 * TỆP ĐÃ LƯU (H9, TD-25) — SAU CỜ, TẮT MẶC ĐỊNH (phiên kiểm duyệt bắt buộc). Lệnh đẩy bài không có trường tệp trong
 * `targeting`; đường duy nhất là rawTargeting (Meta, "forwarded unchanged") với custom_audiences [{ id }] của Meta — tài liệu
 * nhà cung cấp không mô tả dạng này, CHƯA thử được (0 kênh Meta Ads). Bật (ADS_NHAM_TEP_DA_LUU=1) chỉ khi thử thật đầu tiên.
 * Kèm targeting.advantage_audience 0: có rawTargeting thì nhà cung cấp thôi tự thêm mặc định targeting_automation mà Meta bắt.
 * Dự báo tiếp cận (spec = TargetingSpec) KHÔNG có trường tệp → số dự báo không tính tệp: giao diện phải nói rõ.
 */
export const CO_TEP_DA_LUU = process.env.ADS_NHAM_TEP_DA_LUU === "1";

/** Tệp đã chọn → rawTargeting. Không chọn → undefined. Cờ tắt / tệp không thuộc tài khoản quảng cáo của cửa hàng → 400. */
export function dungTepDaLuu(tep: unknown, tepCuaCuaHang: Record<string, unknown>[], coBat = CO_TEP_DA_LUU): Record<string, unknown> | undefined {
  if (tep === undefined || tep === null || tep === "") return undefined;
  if (!coBat) throw new AppError("Chưa hỗ trợ nhắm theo tệp đã lưu", 400);
  if (typeof tep !== "string" || !MA_NHAM.test(tep) || !tepCuaCuaHang.some((t) => t.platformAudienceId === tep)) {
    throw new AppError("Tệp đã lưu không thuộc tài khoản quảng cáo của cửa hàng", 400);
  }
  return { custom_audiences: [{ id: tep }] };
}

/**
 * Mục tiêu đẩy bài. NHẮN TIN (mặc định — phiên kiểm duyệt chốt 22/10/2026): tài liệu "Messaging boosts (Meta): goal
 * engagement + callToAction MESSAGE_PAGE" → quảng cáo có nút nhắn tin, khách bấm là thành hội thoại trong hộp thư để
 * ③ AI Bán hàng tư vấn + chốt đơn. TƯƠNG TÁC: engagement trơn (thích / bình luận).
 */
export const MUC_TIEU_DAY_BAI: Record<MucTieuDayBai, Record<string, string>> = {
  nhan_tin: { goal: "engagement", callToAction: "MESSAGE_PAGE" },
  tuong_tac: { goal: "engagement" },
};

/**
 * Lệnh đẩy bài (POST /v1/ads/boost). accountId = kênh metaads (đăng nhập doanh nghiệp) → bài truyền bằng platformPostId
 * (mã bài Facebook). Ngân sách theo ngày, đơn vị tiền của tài khoản quảng cáo: chỗ gọi CHỈ cho VND và gửi kèm currency.
 * Idempotency-Key do giao diện sinh mỗi lần bấm (tài liệu: boost KHÔNG idempotent; cùng key + cùng thân → trả lại kết quả
 * cũ, không tạo quảng cáo thứ hai).
 */
export function lenhDayBai(p: {
  accountId: string;
  adAccountId: string;
  platformPostId: string;
  maBai: number;
  nganSachNgay: number;
  soNgay: number;
  mucTieu: MucTieuDayBai;
  nhamChon: Record<string, unknown>;
  /** Tệp đã lưu (dungTepDaLuu) — chỉ khi cờ bật. */
  rawTargeting?: Record<string, unknown>;
  khoa: string;
  bayGio: Date;
}) {
  const ngay = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(p.bayGio);
  return {
    path: "/ads/boost",
    method: "POST" as const,
    body: {
      accountId: p.accountId,
      adAccountId: p.adAccountId,
      platformPostId: p.platformPostId,
      name: `Đẩy bài ${p.maBai} ${ngay}`,
      ...MUC_TIEU_DAY_BAI[p.mucTieu],
      budgetAmount: p.nganSachNgay,
      budgetType: "daily",
      currency: "VND",
      endDate: new Date(p.bayGio.getTime() + p.soNgay * 86_400_000).toISOString(),
      ...(p.rawTargeting
        ? { targeting: { ...p.nhamChon, advantage_audience: 0 }, rawTargeting: p.rawTargeting }
        : { targeting: p.nhamChon }),
    },
    headers: { "Idempotency-Key": p.khoa },
  };
}

/**
 * Kiểm ngân sách đẩy bài với tài khoản quảng cáo. Ngân sách nhập theo ĐỒNG; nhà cung cấp tính theo tiền của tài khoản
 * quảng cáo ("whole currency units"). Khác VND → chặn, KHÔNG tự quy đổi (100.000 trên tài khoản USD là 100.000 USD mỗi
 * ngày). Meta còn có ngân sách tối thiểu theo từng tài khoản.
 */
export function kiemNganSachDayBai(taiKhoan: { currency?: string; minDailyBudget?: number }, nganSachNgay: number): void {
  if (taiKhoan.currency !== "VND") {
    throw new AppError(
      `Tài khoản quảng cáo đang dùng ${taiKhoan.currency || "loại tiền chưa rõ"}, màn này nhập ngân sách theo đồng — chưa hỗ trợ đẩy bài cho tài khoản này.`,
      409
    );
  }
  const toiThieu = Number(taiKhoan.minDailyBudget ?? 0);
  if (toiThieu > 0 && nganSachNgay < toiThieu) {
    throw new AppError(`Ngân sách mỗi ngày phải từ ${toiThieu.toLocaleString("vi-VN")} đ trở lên theo quy định của Meta.`);
  }
}

/** Mã bài Facebook (pageId_postId) trong bài của nhà cung cấp (GET /v1/posts/{id}: platforms[].platformPostId). */
export function maBaiFacebook(raw: unknown): string | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const bai = (o.post && typeof o.post === "object" ? o.post : o) as Record<string, unknown>;
  const ds = Array.isArray(bai.platforms) ? (bai.platforms as Record<string, unknown>[]) : [];
  const fb = ds.find((x) => x?.platform === "facebook" && typeof x.platformPostId === "string" && x.platformPostId !== "");
  return fb ? (fb.platformPostId as string) : null;
}

/**
 * Mốc của ý định đẩy bài (giao diện gửi kèm mã chống trùng). Phải là thời điểm thật trong 24 giờ qua (lệch đồng hồ cho
 * phép 5 phút) — mốc cũ hơn nghĩa là màn xác nhận đã để quá lâu, ngày kết thúc sẽ lệch: bắt xác nhận lại.
 */
export function docMocDayBai(raw: unknown, bayGio: Date): Date {
  const t = typeof raw === "string" ? new Date(raw) : new Date(NaN);
  const lech = bayGio.getTime() - t.getTime();
  if (!Number.isFinite(t.getTime()) || lech < -5 * 60_000 || lech > 24 * 3_600_000) {
    throw new AppError("Phiên xác nhận đã cũ. Vui lòng mở lại bước xác nhận rồi bấm chạy.", 400);
  }
  return t;
}

export async function dayBai(lenh: ReturnType<typeof lenhDayBai>): Promise<unknown> {
  // Đẩy bài có thể mất vài phút (tài liệu) — chờ tới 2 phút; hết giờ thì CHUA_RO, không thử lại.
  return request(lenh.path, { method: lenh.method, body: lenh.body, headers: lenh.headers, timeoutMs: 120_000 });
}

/** Lệnh dự báo tiếp cận (POST /v1/ads/targeting/reach-estimate): bắt buộc accountId, adAccountId, spec. */
export function lenhDuBao(p: { accountId: string; adAccountId: string; nhamChon: Record<string, unknown> }) {
  return { accountId: p.accountId, adAccountId: p.adAccountId, spec: p.nhamChon, optimizationGoal: "REACH" };
}

/** Đọc dự báo theo tài liệu: { available, lower, upper }. */
export function docDuBao(raw: unknown): { coDuBao: boolean; thap: number | null; cao: number | null } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const so = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const thap = so(o.lower), cao = so(o.upper);
  return { coDuBao: o.available !== false && (thap !== null || cao !== null), thap, cao };
}

export async function duBaoTiepCan(than: ReturnType<typeof lenhDuBao>): Promise<unknown> {
  return request("/ads/targeting/reach-estimate", { method: "POST", body: than });
}

export type LoaiTepTao = "tuong_tac_fanpage" | "tuong_tu";
export const SO_NGAY_TUONG_TAC = [30, 60, 90, 180, 365] as const;

/**
 * Thân lệnh tạo tệp (POST /v1/ads/audiences) — 2 loại làm được cho shop chỉ có Fanpage (không pixel / danh sách khách):
 *  - người đã tương tác với Fanpage: type meta_engagement, engagementSource 'page', sourceId = mã Fanpage, retentionDays ≤ 365;
 *  - giống một tệp đã có: type lookalike, sourceAudienceId, country 'VN', ratio 0.01–0.10.
 */
export function thanTaoTep(p: {
  accountId: string;
  adAccountId: string;
  ten: unknown;
  loai: unknown;
  pageId?: string | null;
  soNgay?: unknown;
  tepNguon?: unknown;
  phanTram?: unknown;
}): Record<string, unknown> {
  const ten = typeof p.ten === "string" ? p.ten.trim() : "";
  if (!ten) throw new AppError("Vui lòng đặt tên cho tệp đối tượng.", 400);
  const goc = { accountId: p.accountId, adAccountId: p.adAccountId, name: ten.slice(0, 200) };
  if (p.loai === "tuong_tac_fanpage") {
    if (!p.pageId) throw new AppError("Cửa hàng chưa nối Fanpage nên chưa tạo được tệp người tương tác", 409);
    const soNgay = Number(p.soNgay);
    if (!(SO_NGAY_TUONG_TAC as readonly number[]).includes(soNgay)) throw new AppError("Khoảng thời gian không hợp lệ", 400);
    return { ...goc, type: "meta_engagement", engagementSource: "page", sourceId: p.pageId, retentionDays: soNgay };
  }
  if (p.loai === "tuong_tu") {
    if (typeof p.tepNguon !== "string" || !p.tepNguon) throw new AppError("Vui lòng chọn tệp gốc để tìm người giống", 400);
    const pt = Number(p.phanTram);
    if (!Number.isInteger(pt) || pt < 1 || pt > 10) throw new AppError("Độ rộng phải từ 1% đến 10%", 400);
    return { ...goc, type: "lookalike", sourceAudienceId: p.tepNguon, country: "VN", ratio: pt / 100 };
  }
  throw new AppError("Loại tệp không hợp lệ", 400);
}

/**
 * Lỗi của lệnh GHI TỐN TIỀN / RA NGOÀI (đẩy bài, tạo tệp) → câu cho chủ shop. KHÔNG bao giờ bảo "thử lại" khi chưa rõ kết
 * quả: hết giờ chờ / đứt mạng / nhà cung cấp lỗi 5xx / lần bấm trước còn đang chạy (409) đều có thể ĐÃ tạo — bấm lại là
 * có thể trừ tiền hai lần (tài liệu /v1/ads/boost "Retries"). Lỗi 4xx khác = chắc chắn chưa tạo.
 */
export function loiLenhGhi(error: unknown, viec: string): AppError | null {
  if (!(error instanceof AdsError)) return null;
  if (error.code === "CHUA_RO" || error.status >= 500 || error.status === 409) {
    return new AppError(
      `Chưa rõ kết quả ${viec} — có thể đã tạo xong. Vui lòng xem danh sách chiến dịch / tệp đối tượng trước khi bấm lại.`,
      504
    );
  }
  return new AppError(`Chưa ${viec} được: ${giauNhaCungCap(error.message)}`, error.status >= 400 && error.status < 500 ? error.status : 400);
}

export async function taoTep(than: Record<string, unknown>): Promise<unknown> {
  return request("/ads/audiences", { method: "POST", body: than });
}

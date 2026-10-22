import crypto from "node:crypto";
import { env } from "../env.js";

/**
 * Client gọi Zernio API.
 *
 * Mọi đường dẫn và hình dạng dữ liệu ở đây đã được kiểm chứng bằng lời gọi
 * thật tới https://zernio.com/api/v1 ngày 17/08/2026, không suy đoán từ tài liệu.
 */

import { giauNhaCungCap } from "./text.js";
import { kiemPhamVi } from "./pham-vi-goi.js";

export class ZernioError extends Error {
  /**
   * Nguyên văn từ nhà cung cấp. CHỈ dùng cho log của máy chủ.
   *
   * `message` đã được che tên nhà cung cấp vì nó chảy đi rất nhiều hướng tới
   * mắt chủ shop: phản hồi API, posts.last_error, cảnh báo Telegram. Che ngay
   * tại chỗ sinh ra lỗi thì không phải nhớ vá từng hướng một.
   */
  readonly nguyenVan: string;

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: unknown
  ) {
    super(giauNhaCungCap(message));
    this.nguyenVan = message;
    this.name = "ZernioError";
  }

  /** Lỗi tạm thời thì đáng thử lại; lỗi 4xx thì không. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Header bổ sung, ví dụ x-request-id để chống đăng trùng. */
  headers?: Record<string, string>;
  /** Số lần thử lại khi gặp lỗi tạm thời. */
  retries?: number;
  /** Lý do CỐ Ý hỏi đường danh sách cho cả team (không phạm vi) — xem pham-vi-goi.ts. */
  caTeam?: string;
  /**
   * Hạn chờ riêng, tính bằng mili giây.
   *
   * Mặc định 20 giây đủ cho hầu hết lời gọi, nhưng KHÔNG đủ cho việc tạo bài
   * có ảnh: Zernio phải tải ảnh từ kho tạm về, xử lý rồi mới đẩy sang Facebook.
   * Đã gặp thật: hết giờ chờ ở phía mình trong khi bài ĐÃ ĐĂNG THÀNH CÔNG.
   */
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET", query, body, headers = {}, retries = 2, timeoutMs = 20_000, caTeam,
  } = options;
  kiemPhamVi(method, path, query, caTeam);

  const url = new URL(env.zernio.baseUrl + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError: ZernioError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${env.zernio.apiKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Lỗi mạng hoặc quá hạn chờ — coi như tạm thời.
      lastError = new ZernioError(
        `Không gọi được Zernio (${method} ${path}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        0
      );
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    }

    // Ghi nhận hạn mức thật từ mọi phản hồi, kể cả phản hồi lỗi.
    captureRateLimit(response);

    const text = await response.text();

    if (response.ok) {
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ZernioError(
          `Zernio trả về nội dung không phải JSON cho ${method} ${path}. ` +
            `Nhiều khả năng đường dẫn sai và đang nhận về trang HTML.`,
          response.status,
          "invalid_json",
          text.slice(0, 200)
        );
      }
    }

    let parsed: { error?: string; code?: string; message?: string } | undefined;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* thân lỗi không phải JSON */
    }

    lastError = new ZernioError(
      parsed?.error ?? parsed?.message ?? `Zernio trả lỗi ${response.status}`,
      response.status,
      parsed?.code,
      parsed ?? text.slice(0, 200)
    );

    if (!lastError.isRetryable || attempt === retries) throw lastError;

    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : backoffMs(attempt)
    );
  }

  throw lastError ?? new ZernioError("Lỗi không xác định khi gọi Zernio", 0);
}

function backoffMs(attempt: number): number {
  // 500ms, 1s, 2s… kèm nhiễu ngẫu nhiên để tránh dồn cục khi nhiều tiến trình cùng thử lại.
  return Math.round(500 * 2 ** attempt * (0.75 + Math.random() * 0.5));
}

// ---------------------------------------------------------------------------
// Hạn mức thật do Zernio báo về
// ---------------------------------------------------------------------------

/**
 * Hạn mức sống, đọc từ header của mỗi phản hồi Zernio.
 *
 * Đây là con số THẬT, không phải phỏng đoán. Zernio trả về:
 *   x-ratelimit-limit     — trần của bậc hiện tại (60 / 600 / 1200 tuỳ số
 *                           tài khoản kết nối trong cả team)
 *   x-ratelimit-remaining — còn lại bao nhiêu trong cửa sổ hiện tại
 *   x-ratelimit-reset     — mốc unix khi hạn mức được nạp lại
 *
 * Dùng con số này để chặn đúng lúc hết hạn mức, thay vì tự đặt một trần thấp
 * hơn rồi bỏ phí phần dung lượng còn được phép dùng.
 */
export interface RateLimitState {
  limit: number | null;
  remaining: number | null;
  /** Mốc nạp lại hạn mức. */
  resetAt: Date | null;
  /** Lần cuối đọc được header, để biết số liệu còn mới hay đã cũ. */
  observedAt: Date | null;
}

let rateLimitState: RateLimitState = {
  limit: null,
  remaining: null,
  resetAt: null,
  observedAt: null,
};

function captureRateLimit(response: Response): void {
  const limit = Number(response.headers.get("x-ratelimit-limit"));
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));

  if (!Number.isFinite(limit)) return;

  rateLimitState = {
    limit,
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt: Number.isFinite(reset) ? new Date(reset * 1_000) : null,
    observedAt: new Date(),
  };
}

export function getRateLimitState(): RateLimitState {
  // Đã qua mốc nạp lại thì hạn mức coi như đầy trở lại.
  if (rateLimitState.resetAt && rateLimitState.resetAt.getTime() <= Date.now()) {
    return {
      ...rateLimitState,
      remaining: rateLimitState.limit,
    };
  }
  return rateLimitState;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Kiểu dữ liệu (theo phản hồi thật của Zernio)
// ---------------------------------------------------------------------------

export interface ZernioProfile {
  _id: string;
  name: string;
  isDefault?: boolean;
  color?: string;
  accountUsernames?: string[];
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileUrl?: string;
  followersCount?: number;
  isActive?: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
  tokenExpiresAt?: string;
  platformStatus?: string;
  profileId?: string | { _id: string; name?: string };
  [key: string]: unknown;
}

export interface ZernioConversation {
  id: string;
  accountId: string;
  accountUsername?: string;
  platform: string;
  participantId: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  updatedTime?: string;
  status?: string;
  unreadCount?: number;
  url?: string;
}

export interface ZernioMessage {
  id: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  message?: string;
  text?: string;
  createdTime?: string;
  isFromPage?: boolean;
  attachments?: unknown[];
  [key: string]: unknown;
}

export interface ZernioComment {
  id: string;
  accountId: string;
  platform: string;
  postId?: string;
  content?: string;
  authorId?: string;
  authorName?: string;
  createdTime?: string;
  [key: string]: unknown;
}

/** profileId có thể là chuỗi hoặc đối tượng lồng — chuẩn hoá về chuỗi. */
export function accountProfileId(account: ZernioAccount): string | null {
  const value = account.profileId;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) return value._id;
  return null;
}

// ---------------------------------------------------------------------------
// Hồ sơ và tài khoản
// ---------------------------------------------------------------------------

export async function listProfiles(): Promise<ZernioProfile[]> {
  // Hồ sơ là đơn vị chia khách — danh sách hồ sơ luôn của cả team; chỉ dùng để cấp / nhận hồ sơ.
  const data = await request<{ profiles?: ZernioProfile[] }>("/profiles", {
    caTeam: "danh sách hồ sơ: cấp hồ sơ cho tài khoản (ensureProfile) và nhận hồ sơ (quản trị)",
  });
  return data.profiles ?? [];
}

export async function createProfile(name: string): Promise<ZernioProfile> {
  const data = await request<{ profile?: ZernioProfile } & ZernioProfile>("/profiles", {
    method: "POST",
    body: { name },
  });
  return data.profile ?? (data as ZernioProfile);
}

/**
 * Xoá một hồ sơ bên Zernio.
 *
 * Xoá tài khoản mà không xoá hồ sơ thì hồ sơ nằm lại vĩnh viễn: đã đếm được 5
 * hồ sơ rác đọng lại vì đúng lý do này, trong đó hai hồ sơ trùng tên gian hàng
 * mà không có kênh nào. Với mô hình mỗi trang một tài khoản thì chủ chuỗi lập
 * rồi bỏ trang là chuyện thường ngày, rác sẽ sinh nhanh hơn nhiều.
 */
export async function xoaHoSo(profileId: string): Promise<void> {
  await request(`/profiles/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    // Không thử lại: xoá xong mà mạng lỗi thì lần thử sau nhận 404 và ném lỗi
    // giả, làm chỗ gọi tưởng chưa xoá được.
    retries: 0,
  });
}

/**
 * Kênh của MỘT hồ sơ. Mặc định nhà cung cấp CHỈ trả kênh trong hạn mức gói (tài liệu GET /v1/accounts, dòng 22270) —
 * việc xoá / dọn hồ sơ phải xin cả kênh của hồ sơ vượt hạn mức (includeOverLimit), nếu không sẽ sót kênh.
 *
 * Mã hồ sơ BẮT BUỘC (22/10/2026): thiếu profileId thì nhà cung cấp trả kênh của CẢ TEAM — mọi khách dùng chung một
 * khoá. Lượt đồng bộ của một tài khoản từng có thể đi đường đó (req.user.profileRef rỗng) và kéo kênh của khách khác
 * về. Cả team chỉ được hỏi qua listAccountsCaTeam, có chủ đích.
 */
export async function listAccounts(profileId: string, tuyChon: { includeOverLimit?: boolean } = {}): Promise<ZernioAccount[]> {
  if (typeof profileId !== "string" || !profileId.trim()) throw new Error("Thiếu mã hồ sơ khi hỏi danh sách kênh");
  const data = await request<{ accounts?: ZernioAccount[] }>("/accounts", {
    query: { profileId, ...(tuyChon.includeOverLimit ? { includeOverLimit: "true" } : {}) },
  });
  return data.accounts ?? [];
}

/** Kênh của CẢ TEAM (mọi hồ sơ, mọi khách) — chỉ cho công cụ quản trị. */
export async function listAccountsCaTeam(): Promise<ZernioAccount[]> {
  const data = await request<{ accounts?: ZernioAccount[] }>("/accounts", {
    caTeam: "quản trị: đếm kênh của hồ sơ chưa ai nhận (available-profiles, chiQuanTri)",
  });
  return data.accounts ?? [];
}

/** Lấy URL để người dùng bấm vào và cấp quyền cho một nền tảng. */
export async function getConnectUrl(
  platform: string,
  profileId: string,
  options: { redirectUrl?: string; headless?: boolean } = {}
): Promise<string> {
  const data = await request<{ url?: string; authUrl?: string }>(
    `/connect/${encodeURIComponent(platform)}`,
    {
      query: {
        profileId,
        /*
         * redirect_url: thiếu tham số này thì Zernio đưa khách về dashboard
         * CỦA HỌ sau khi cấp quyền xong — khách nhìn thấy nhà cung cấp hạ tầng,
         * và cửa sổ không bao giờ quay lại app nên màn hình kết nối treo mãi.
         *
         * headless: để Zernio KHÔNG dựng màn hình chọn Trang. Mình tự dựng, vừa
         * đúng giao diện đã thiết kế, vừa giữ khách ở lại trong sản phẩm.
         */
        ...(options.redirectUrl ? { redirect_url: options.redirectUrl } : {}),
        ...(options.headless ? { headless: "true" } : {}),
      },
    }
  );
  const url = data.url ?? data.authUrl;
  if (!url) {
    throw new ZernioError(
      `Zernio không trả về URL kết nối cho nền tảng ${platform}`,
      502,
      "missing_connect_url"
    );
  }
  return url;
}

/** Một Trang Facebook mà khách có quyền quản lý. */
export interface FacebookPage {
  id: string;
  name: string;
  username?: string | null;
  category?: string;
  tasks?: string[];
}

/**
 * Lấy danh sách Trang sau khi khách cấp quyền xong (chặng 2 của headless).
 *
 * connectToken đi vào header X-Connect-Token — tài liệu ghi rõ là bắt buộc khi
 * gọi bằng API key, mà mình thì luôn gọi bằng API key.
 */
export async function listFacebookPages(params: {
  profileId: string;
  tempToken: string;
  connectToken?: string | null;
}): Promise<FacebookPage[]> {
  const data = await request<{ pages?: FacebookPage[] }>(
    "/connect/facebook/select-page",
    {
      query: { profileId: params.profileId, tempToken: params.tempToken },
      ...(params.connectToken
        ? { headers: { "X-Connect-Token": params.connectToken } }
        : {}),
    }
  );
  return data.pages ?? [];
}

/**
 * Chuyển một kênh sang hồ sơ khác của cùng chủ khoá API (PATCH /accounts/{id}, tài liệu "Move account to another
 * profile"). Mã kênh giữ nguyên, hội thoại / bài cũ vẫn theo kênh. Dùng khi chủ shop chuyển kênh sang cửa hàng khác —
 * mỗi cửa hàng một hồ sơ. Chỗ gọi phải chặn trước nếu hồ sơ đích đã có cùng nền tảng (nhà cung cấp sẽ thay tài khoản cũ).
 */
export async function chuyenKenhSangHoSo(accountId: string, profileId: string): Promise<void> {
  await request<{ message?: string; profileId?: string }>(
    `/accounts/${encodeURIComponent(accountId)}`,
    { method: "PATCH", body: { profileId }, retries: 0 }
  );
}

/**
 * TELEGRAM — nối bằng MÃ, không có đăng nhập (tài liệu: GET/PATCH /v1/connect/telegram). Nhà cung cấp phát mã sống
 * 15 phút; khách thêm bot của họ làm quản trị kênh / nhóm rồi gửi mã cho bot; mình dò PATCH mỗi ~3 giây.
 * Trước 17/10/2026 app xếp Telegram vào luồng đăng nhập thường → luôn hỏng (nhà cung cấp trả mã, không trả URL).
 */
export async function layMaTelegram(profileId: string): Promise<{
  code: string; expiresAt: string; botUsername: string;
}> {
  const d = await request<{ code?: string; expiresAt?: string; botUsername?: string }>("/connect/telegram", {
    query: { profileId },
  });
  if (!d.code || !d.botUsername) throw new ZernioError("Zernio không trả mã kết nối Telegram", 502, "missing_telegram_code");
  return { code: d.code, expiresAt: d.expiresAt ?? new Date(Date.now() + 15 * 60_000).toISOString(), botUsername: d.botUsername };
}

export async function kiemMaTelegram(code: string): Promise<"pending" | "connected" | "expired"> {
  const d = await request<{ status?: string }>("/connect/telegram", { method: "PATCH", query: { code }, retries: 0 });
  return d.status === "connected" ? "connected" : d.status === "expired" ? "expired" : "pending";
}

/**
 * BLUESKY — nối bằng tên tài khoản + MẬT KHẨU ỨNG DỤNG (tài liệu: POST /v1/connect/bluesky/credentials).
 * state bắt buộc dạng {userId}-{profileId}, userId lấy từ GET /v1/users (currentUserId). Mật khẩu ứng dụng chỉ đi
 * qua, mình KHÔNG lưu.
 */
export async function noiBluesky(identifier: string, appPassword: string, profileId: string): Promise<void> {
  const nguoiDung = await request<{ currentUserId?: string }>("/users", {
    caTeam: "chỉ lấy currentUserId (mã người gọi) dựng state Bluesky; danh sách người dùng không dùng, không lưu",
  });
  if (!nguoiDung.currentUserId) throw new ZernioError("Zernio không trả mã người dùng", 502, "missing_user_id");
  await request("/connect/bluesky/credentials", {
    method: "POST",
    body: { identifier, appPassword, state: `${nguoiDung.currentUserId}-${profileId}` },
    retries: 0,
  });
}

/**
 * Chốt Trang khách đã chọn — đây là bước thật sự tạo ra kênh trên Zernio.
 *
 * userProfile phải là OBJECT đã giải mã, không phải chuỗi mã hoá URL nhận được
 * ở đường dẫn quay về; gửi nguyên chuỗi sẽ bị từ chối 400.
 */
export async function selectFacebookPage(params: {
  profileId: string;
  pageId: string;
  tempToken: string;
  userProfile: Record<string, unknown>;
  connectToken?: string | null;
}): Promise<{
  message?: string;
  account?: {
    accountId?: string;
    platform?: string;
    username?: string;
    displayName?: string;
    profilePicture?: string;
    isActive?: boolean;
    selectedPageName?: string;
  };
}> {
  return request("/connect/facebook/select-page", {
    method: "POST",
    body: {
      profileId: params.profileId,
      pageId: params.pageId,
      tempToken: params.tempToken,
      userProfile: params.userProfile,
    },
    ...(params.connectToken
      ? { headers: { "X-Connect-Token": params.connectToken } }
      : {}),
    // Không thử lại: gọi hai lần có thể tạo hai kênh trùng cho cùng một Trang.
    retries: 0,
  });
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await request(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Hộp thư
// ---------------------------------------------------------------------------

export async function listConversations(params: {
  accountId: string;
  limit?: number;
}): Promise<ZernioConversation[]> {
  const data = await request<{ data?: ZernioConversation[] }>("/inbox/conversations", {
    query: params,
  });
  return data.data ?? [];
}

/**
 * Lấy tin nhắn trong một hội thoại.
 * accountId là bắt buộc — Zernio trả 400 nếu thiếu.
 */
export async function getConversation(
  conversationId: string,
  accountId: string,
  limit = 50
): Promise<{ conversation?: ZernioConversation; messages: ZernioMessage[] }> {
  /*
   * HAI đường dẫn khác nhau, đừng gộp.
   *
   * GET /inbox/conversations/{id}            -> chỉ thông tin hội thoại
   * GET /inbox/conversations/{id}/messages   -> danh sách tin nhắn
   *
   * Bản trước gọi đường thứ nhất rồi mò tin nhắn trong đó, nên LUÔN nhận về
   * mảng rỗng — kiểm chứng bằng lời gọi thật: phản hồi chỉ có { data: {...} }
   * chứa id, participantName, lastMessage… và không có tin nhắn nào.
   */
  const meta = await request<{ data?: ZernioConversation; conversation?: ZernioConversation }>(
    `/inbox/conversations/${encodeURIComponent(conversationId)}`,
    { query: { accountId } }
  );

  const tin = await request<{
    data?: ZernioMessage[];
    messages?: ZernioMessage[];
  }>(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    // asc = cũ trước, đúng thứ tự đọc của một đoạn chat.
    query: { accountId, limit, sortOrder: "asc" },
  });

  const messages = tin.messages ?? tin.data ?? [];

  return {
    conversation: meta.conversation ?? meta.data,
    messages: Array.isArray(messages) ? messages : [],
  };
}

/**
 * Gửi tin nhắn vào một hội thoại.
 *
 * CẢNH BÁO VỀ TÀI LIỆU: ví dụ trong tài liệu Zernio ghi thân request là
 * `{ text }` và không có accountId. Thực tế API từ chối dạng đó. Thăm dò trực
 * tiếp ngày 17/08/2026 cho kết quả:
 *   { text }               -> 400, báo thiếu accountId
 *   { accountId, text }    -> 400, báo thiếu message
 *   { accountId, message } -> qua được kiểm tra, chạm tới nền tảng
 * Nên hợp đồng thật là { accountId, message }. Viết theo tài liệu thì AI sẽ
 * không bao giờ gửi được tin nào cho khách.
 *
 * Phản hồi HTTP nghĩa là ĐÃ NHẬN, chưa phải ĐÃ GỬI TỚI KHÁCH. Trạng thái thật
 * đến sau qua webhook message.sent hoặc message.failed.
 */
/**
 * Thẻ tin nhắn cho phép gửi ngoài cửa sổ 24 giờ.
 * Danh sách này do Zernio trả về khi gửi thẻ sai, nên là danh sách thật.
 * Instagram chỉ nhận HUMAN_AGENT.
 */
export type MessageTag =
  | "CONFIRMED_EVENT_UPDATE"
  | "POST_PURCHASE_UPDATE"
  | "ACCOUNT_UPDATE"
  | "HUMAN_AGENT";

export async function sendMessage(params: {
  conversationId: string;
  accountId: string;
  text: string;
  /**
   * Gắn thẻ khi gửi ngoài cửa sổ 24 giờ. Không có thẻ mà gửi ngoài cửa sổ thì
   * nền tảng từ chối, và gắn thẻ sai ngữ cảnh là vi phạm chính sách.
   */
  messageTag?: MessageTag;
}): Promise<ZernioMessage> {
  return request<ZernioMessage>(
    `/inbox/conversations/${encodeURIComponent(params.conversationId)}/messages`,
    {
      method: "POST",
      body: {
        accountId: params.accountId,
        message: params.text,
        ...(params.messageTag
          ? { messagingType: "MESSAGE_TAG", messageTag: params.messageTag }
          : {}),
      },
      // Không thử lại khi gửi tin: lần thử thứ hai có thể khiến khách nhận hai tin.
      retries: 0,
    }
  );
}

// ---------------------------------------------------------------------------
// Bình luận
// ---------------------------------------------------------------------------

/**
 * Các BÀI ĐĂNG có bình luận — KHÔNG phải danh sách bình luận.
 *
 * Tên cũ là listComments và đã làm tôi báo cáo sai một lần: nó trả về bài đăng
 * kèm commentCount, không trả bình luận. Muốn lấy bình luận thật thì gọi
 * layBinhLuanCuaBai() với postId lấy từ đây.
 */
export interface BaiCoBinhLuan {
  id: string;
  accountId: string;
  content?: string;
  commentCount?: number;
  createdTime?: string;
}

export async function layBaiCoBinhLuan(params: {
  accountId: string;
  limit?: number;
}): Promise<BaiCoBinhLuan[]> {
  const data = await request<{ data?: BaiCoBinhLuan[] }>("/inbox/comments", {
    query: params,
  });
  return data.data ?? [];
}

/** Bình luận thật của một bài đăng. */
export interface BinhLuanCuaBai {
  id: string;
  message?: string;
  createdTime?: string;
  from?: { id?: string; name?: string };
  parent?: { id?: string };
}

export async function layBinhLuanCuaBai(params: {
  postId: string;
  accountId: string;
}): Promise<BinhLuanCuaBai[]> {
  const data = await request<{ comments?: BinhLuanCuaBai[] }>(
    `/inbox/comments/${encodeURIComponent(params.postId)}`,
    { query: { accountId: params.accountId } }
  );
  return data.comments ?? [];
}

/**
 * Trả lời công khai dưới một bình luận.
 *
 * CẢNH BÁO VỀ ĐƯỜNG DẪN: phải dùng POST /inbox/comments/{postId} kèm commentId
 * trong thân request. Bản trước dùng PATCH /inbox/comments/{postId}/{commentId}
 * — đó là endpoint SỬA bình luận, và Zernio chỉ hỗ trợ sửa trên Reddit. Trên
 * Facebook nó luôn trả lỗi "Editing comments is supported for: reddit".
 * Vì vậy trước đây không một bình luận nào được trả lời.
 *
 * Bỏ commentId thì bình luận mới nằm thẳng dưới bài, không phải trả lời ai.
 */
export async function replyToComment(params: {
  postId: string;
  commentId: string;
  accountId: string;
  text: string;
}): Promise<{ success?: boolean; data?: { commentId?: string; isReply?: boolean } }> {
  return request(`/inbox/comments/${encodeURIComponent(params.postId)}`, {
    method: "POST",
    body: {
      accountId: params.accountId,
      message: params.text,
      commentId: params.commentId,
    },
    retries: 0,
  });
}

/**
 * Trả lời một bình luận bằng tin nhắn riêng.
 * Đây chính là bước "khách bình luận thì AI chủ động nhắn tin" trong mô hình.
 */
/**
 * Nhắn tin riêng cho người vừa bình luận.
 *
 * Trường nội dung là `message`, không phải `text` — gửi `text` bị từ chối vì
 * thiếu trường bắt buộc.
 *
 * Chỉ hỗ trợ Instagram và Facebook. Theo tài liệu: MỘT lần cho mỗi bình luận,
 * và phải gửi trong 7 ngày. Hai điều kiện này được chốt chặn ở tầng
 * guardrails và bằng khoá duy nhất trong bảng comments.
 */
export async function privateReplyToComment(params: {
  postId: string;
  commentId: string;
  accountId: string;
  text: string;
}): Promise<unknown> {
  return request(
    `/inbox/comments/${encodeURIComponent(params.postId)}/${encodeURIComponent(
      params.commentId
    )}/private-reply`,
    {
      method: "POST",
      body: { accountId: params.accountId, message: params.text },
      retries: 0,
    }
  );
}

// ---------------------------------------------------------------------------
// Đăng bài
// ---------------------------------------------------------------------------

export interface PostTarget {
  /** Định danh nền tảng, ví dụ "facebook". */
  platform: string;
  /** _id của tài khoản đã kết nối trên nền tảng đó. */
  accountId: string;
}

/**
 * Tạo và đăng bài.
 *
 * Zernio nhận mảng `platforms` gồm các cặp { platform, accountId }, không phải
 * mảng accountId phẳng — gửi sai sẽ nhận "Missing required field: platforms".
 *
 * `x-request-id` là khoá chống đăng trùng: gửi lại cùng một UUID trong khoảng
 * 5 phút thì Zernio trả về bài cũ thay vì đăng thêm một bài nữa lên Fanpage.
 */
/** Loại tệp Zernio nhận trong mediaItems. */
export type MediaType = "image" | "video" | "gif" | "document";

export interface MediaItem {
  url: string;
  type: MediaType;
}

export async function createPost(params: {
  targets: PostTarget[];
  content: string;
  /**
   * Ảnh/video kèm bài.
   *
   * Zernio nhận `mediaItems: [{ url, type }]`. Tên `mediaUrls` là của Ayrshare
   * — gửi tên đó thì Zernio bỏ qua im lặng và bài lên sóng KHÔNG có ảnh, trong
   * khi API vẫn trả về thành công.
   */
  mediaItems?: MediaItem[];
  scheduledFor?: Date | null;
  /** Múi giờ dùng để hiểu thời gian hẹn. Mặc định giờ Việt Nam. */
  timezone?: string;
  idempotencyKey?: string;
}): Promise<{
  _id?: string;
  id?: string;
  status?: string;
  post?: Record<string, unknown>;
  existingPost?: Record<string, unknown>;
  [key: string]: unknown;
}> {
  return request("/posts", {
    method: "POST",
    headers: {
      "x-request-id": params.idempotencyKey ?? crypto.randomUUID(),
    },
    body: {
      content: params.content,
      platforms: params.targets.map((target) => ({
        platform: target.platform,
        accountId: target.accountId,
      })),
      timezone: params.timezone ?? "Asia/Ho_Chi_Minh",
      ...(params.mediaItems?.length ? { mediaItems: params.mediaItems } : {}),
      // Thiếu publishNow thì Zernio chỉ lưu bài ở trạng thái draft và không
      // bao giờ đẩy lên nền tảng — bài nằm im mà giao diện tưởng đã đăng.
      ...(params.scheduledFor
        ? { scheduledFor: params.scheduledFor.toISOString() }
        : { publishNow: true }),
    },
    retries: 0,
    // Bài có ảnh cần Zernio tải ảnh về rồi mới đẩy sang nền tảng.
    timeoutMs: 90_000,
  });
}

/**
 * Các bài gần đây, dùng để đối chiếu khi mình mất dấu một bài đã gửi đi.
 * Chỉ đọc — không bao giờ dùng để đăng lại.
 */
/**
 * Bài đăng qua MỘT kênh (accountId) từ một mốc — tài liệu GET /v1/posts: accountId, fromDate, sortBy, limit ≤ 500.
 * Không còn bản "20 bài mới nhất" không lọc: đó là 20 bài của CẢ TEAM.
 */
export async function listBaiCuaKenh(p: { accountId: string; tu: string; limit?: number }): Promise<Record<string, unknown>[]> {
  const data = await request<{ posts?: unknown[]; data?: unknown[] }>("/posts", {
    query: { accountId: p.accountId, fromDate: p.tu, sortBy: "created-desc", limit: p.limit ?? 50 },
  });
  const list = data.posts ?? data.data ?? [];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

/**
 * Sửa nội dung một bài ĐÃ ĐĂNG trên nền tảng.
 *
 * Đã dò endpoint thật ngày 14/09/2026: PATCH trả 405, còn PUT /posts/{id} có
 * thật — mã sai định dạng trả "Invalid post ID format", mã đúng định dạng mà
 * không tồn tại trả "Post not found".
 *
 * GIỚI HẠN CỦA NỀN TẢNG: Facebook chỉ cho sửa phần chữ của bài đã đăng, KHÔNG
 * cho đổi ảnh. Muốn đổi ảnh thì phải gỡ bài rồi đăng lại.
 */
export async function updatePost(params: {
  postId: string;
  content: string;
}): Promise<Record<string, unknown>> {
  return request(`/posts/${encodeURIComponent(params.postId)}`, {
    method: "PUT",
    body: { content: params.content },
  });
}

/**
 * XOÁ BẢN GHI bài phía Zernio (DELETE /v1/posts/{postId}) — dùng để HUỶ bài hẹn giờ / đang đăng.
 *
 * Tài liệu chính thức (openapi.yaml 1.295.0, đọc 19/10/2026): "Any status except `published` can be deleted"; bài
 * published trả 400 "Cannot delete published posts"; xoá là xoá CẢ bài (mọi kênh đích), KHÔNG gỡ gì đã lên nền tảng.
 * Gỡ bài đã đăng khỏi Fanpage → unpublishPost. (Chú thích cũ ghi "gỡ bài đã đăng khỏi nền tảng" là SAI.)
 */
export async function deletePost(postId: string): Promise<Record<string, unknown>> {
  return request(`/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

/** Nền tảng nhà cung cấp KHÔNG hỗ trợ gỡ bài đã đăng (tài liệu: "Not supported on Instagram, TikTok, or Snapchat"). */
export const NEN_TANG_KHONG_GO_DUOC = ["instagram", "tiktok", "snapchat"];

/**
 * GỠ bài đã đăng khỏi MỘT kênh (POST /v1/posts/{postId}/unpublish). Tài liệu: body bắt buộc `platform`; `accountId`
 * bắt buộc khi bài đăng lên nhiều tài khoản cùng nền tảng — luôn gửi cho chắc. Gỡ rồi không lấy lại được.
 */
export async function unpublishPost(params: {
  postId: string;
  platform: string;
  accountId: string;
}): Promise<Record<string, unknown>> {
  return request(`/posts/${encodeURIComponent(params.postId)}/unpublish`, {
    method: "POST",
    body: { platform: params.platform, accountId: params.accountId },
    retries: 0,
  });
}

export async function getPost(postId: string): Promise<Record<string, unknown>> {
  return request(`/posts/${encodeURIComponent(postId)}`);
}

// ---------------------------------------------------------------------------
// Tải ảnh và video lên
// ---------------------------------------------------------------------------

/** Các định dạng Zernio nhận, kèm loại tương ứng để gửi trong mediaItems. */
const MEDIA_TYPES: Record<string, MediaType> = {
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "gif",
  "video/mp4": "video",
  "video/mpeg": "video",
  "video/quicktime": "video",
  "video/avi": "video",
  "video/x-msvideo": "video",
  "video/webm": "video",
  "video/x-m4v": "video",
  "application/pdf": "document",
};

/** Giới hạn của Zernio: 5GB cho ảnh và video. */
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export function mediaTypeFor(contentType: string): MediaType | null {
  return MEDIA_TYPES[contentType.toLowerCase()] ?? null;
}

/**
 * Xin địa chỉ tải lên cho một tệp.
 *
 * Luồng của Zernio gồm ba bước: xin địa chỉ tạm ở đây, PUT tệp thẳng lên địa
 * chỉ đó, rồi dùng publicUrl trong mediaItems của bài đăng.
 *
 * Vì sao trình duyệt tự PUT chứ không đẩy tệp qua server của mình: bước PUT
 * không cần khoá API (chữ ký đã nằm trong địa chỉ), nên cho video vài trăm MB
 * đi xuyên qua tiến trình Node chỉ tốn bộ nhớ và làm chậm mọi yêu cầu khác mà
 * không thêm chút an toàn nào.
 *
 * Lưu ý thời hạn: tệp nằm ở kho tạm 7 ngày, đến khi bài dùng nó được đăng thì
 * Zernio mới chuyển sang kho vĩnh viễn. Bài hẹn lịch xa hơn 7 ngày sẽ lên sóng
 * mà mất ảnh.
 */
export async function presignMedia(params: {
  filename: string;
  contentType: string;
  size?: number;
}): Promise<{
  uploadUrl: string;
  publicUrl: string;
  type: MediaType;
  expiresIn: number;
}> {
  const type = mediaTypeFor(params.contentType);
  if (!type) {
    throw new ZernioError(
      `Định dạng ${params.contentType} không được hỗ trợ. ` +
        `Dùng JPG, PNG, WebP, GIF, MP4, MOV hoặc PDF.`,
      400
    );
  }

  if (params.size !== undefined && params.size > MEDIA_MAX_BYTES) {
    throw new ZernioError("Tệp vượt quá giới hạn 5GB của Zernio.", 400);
  }

  const presigned = await request<{
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    expiresIn?: number;
  }>("/media/presign", {
    method: "POST",
    body: {
      filename: params.filename,
      contentType: params.contentType,
      ...(params.size !== undefined ? { size: params.size } : {}),
    },
  });

  if (!presigned.uploadUrl || !presigned.publicUrl) {
    throw new ZernioError("Zernio không trả về địa chỉ tải lên.", 502);
  }

  return {
    uploadUrl: presigned.uploadUrl,
    publicUrl: presigned.publicUrl,
    type,
    expiresIn: presigned.expiresIn ?? 3_600,
  };
}

// ---------------------------------------------------------------------------
// Phân tích
// ---------------------------------------------------------------------------

export async function getAnalytics(params: {
  profileId: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  return request("/analytics", { query: params });
}

// ---------------------------------------------------------------------------
// Kịch bản bình luận → tin nhắn riêng
// ---------------------------------------------------------------------------

/**
 * Nhật ký giao webhook của nhà cung cấp.
 *
 * Đây là cách DUY NHẤT biết webhook có tới được mình không. Hàng đợi rỗng có
 * thể là "không ai nhắn" mà cũng có thể là "webhook chết" — hai thứ nhìn từ
 * phía mình giống hệt nhau. Nhật ký này phân biệt được.
 *
 * Đã xảy ra thật: địa chỉ webhook đăng ký nhầm thành api.trycloudflare.com,
 * mọi lần giao đều hỏng suốt nhiều ngày, nhà cung cấp ghi "Delivery suppressed:
 * endpoint has been failing continuously". Tin nhắn vẫn về nhờ vòng quét bù 5
 * phút nên nhìn bên ngoài tưởng bình thường, còn bình luận thì mất trắng.
 */
export interface LanGiaoWebhook {
  event: string;
  status: string;
  url: string;
  errorMessage?: string | null;
  createdAt: string;
}

/**
 * Đăng ký địa chỉ webhook của chính mình.
 *
 * VÌ SAO CẦN: trước đây chỉ có scripts/tunnel-watchdog.mjs làm việc này, mà
 * script đó chỉ chạy trên máy lập trình. Triển khai lên máy chủ thật thì không
 * ai chạy nó, nên địa chỉ webhook vẫn trỏ về đường hầm cũ đã chết — và lần này
 * không có script nào sửa hộ. Đã đo hậu quả của đúng tình huống đó: 0/100 lần
 * giao thành công, nhà cung cấp ngừng gửi, bình luận mất trắng nhiều ngày.
 *
 * Giữ nguyên bí mật ký và danh sách sự kiện của bản ghi đang có: chỉ đổi địa
 * chỉ. Ghi đè cả hai thứ kia sẽ làm hỏng phần xác thực chữ ký.
 */
export async function dangKyDiaChiWebhook(
  diaChi: string
): Promise<{ doi: boolean; cu?: string }> {
  const data = await request<{
    webhooks?: Array<{ _id: string; name: string; url: string; secret: string; events: string[] }>;
  }>("/webhooks/settings", { retries: 0 });

  const hook = data.webhooks?.[0];
  if (!hook) return { doi: false };
  if (hook.url === diaChi) return { doi: false, cu: hook.url };

  await request("/webhooks/settings", {
    method: "PUT",
    body: {
      _id: hook._id,
      name: hook.name,
      url: diaChi,
      secret: hook.secret,
      events: hook.events,
      isActive: true,
    },
    retries: 0,
  });
  return { doi: true, cu: hook.url };
}

/**
 * Gỡ trạng thái "ngắt gửi" của nhà cung cấp.
 *
 * Endpoint hỏng liên tục thì họ NGỪNG GỬI hẳn và không tự gỡ kể cả khi
 * endpoint đã sống lại — chỉ một lời gọi /webhooks/test thành công mới gỡ
 * (đã quan sát 17/08/2026: mất tin hơn 3 giờ sau khi đường đã thông).
 * Trả về true nếu sau đó không còn bị ngắt.
 */
export async function goNgatGuiWebhook(): Promise<boolean> {
  const data = await request<{ webhooks?: Array<{ _id: string; attemptFailingSince?: string | null }> }>(
    "/webhooks/settings",
    { retries: 0 }
  );
  const id = data.webhooks?.[0]?._id;
  if (!id) return false;
  await request("/webhooks/test", { method: "POST", body: { webhookId: id }, retries: 0 });
  const sau = await request<{ webhooks?: Array<{ attemptFailingSince?: string | null }> }>("/webhooks/settings", {
    retries: 0,
  });
  return !sau.webhooks?.[0]?.attemptFailingSince;
}

export async function layNhatKyWebhook(limit = 50): Promise<LanGiaoWebhook[]> {
  const data = await request<{ logs?: LanGiaoWebhook[] }>("/webhooks/logs", {
    query: { limit },
    retries: 0,
    caTeam: "webhook là hạ tầng chung của team; chỉ bộ canh sự cố (worker, báo admin) đọc",
  });
  return data.logs ?? [];
}


// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Xác thực chữ ký X-Zernio-Signature.
 *
 * Không có bước này thì bất kỳ ai biết URL đều có thể bơm tin nhắn giả vào hệ
 * thống và khiến AI nhắn tin cho người lạ dưới danh nghĩa của shop.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined
): boolean {
  if (!env.zernio.webhookSecret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", env.zernio.webhookSecret)
    .update(rawBody)
    .digest("hex");

  // Chữ ký có thể đến dưới dạng "sha256=<hex>" hoặc hex trần.
  const received = signature.includes("=") ? signature.split("=").pop()! : signature;

  const a = Buffer.from(expected);
  const b = Buffer.from(received.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Tiền Zernio tính cho TỪNG KÊNH trong một kỳ hoá đơn — đúng số trên hoá đơn của họ.
 *
 * Tài liệu chính thức (docs.zernio.com/billing, /usage/get-usage): tính theo từng kênh đang nối, chia theo ngày
 * (số ngày-kênh ÷ 30), chạy qua bậc giá 6 / 3 / 1 USD, trừ 12 USD miễn phí mỗi tháng. `groupBy=account` trả phần
 * tiền của từng kênh và "sum(groups) + unattributed equals totals exactly". Chủ dự án 04/10/2026: tính với khách
 * "y sì như vậy để khớp tuyệt đối 100%" — nên KHÔNG tự chia lại theo công thức riêng mà đọc thẳng số Zernio chia.
 * Đo thật cùng ngày: kỳ 09/2026 cả hệ thống 4,71 USD, nhóm duy nhất (kênh TikTok) 4,71, không gán 0.
 */
export interface TienKenhZernio {
  tu: string;
  den: string;
  /** id kênh Zernio → USD. */
  theoKenh: Record<string, number>;
  khongGanUsd: number;
  tongUsd: number;
}

export async function docTienKenhTheoKenh(
  khoang: "cycle" | "prev-cycle" | { from: string; to: string }
): Promise<TienKenhZernio> {
  // Khoảng ngày tuỳ chọn (UTC, gồm cả hai đầu): tiền từng kênh trong ĐÚNG khoảng đó, nhà cung cấp tự chia theo hoá đơn.
  const q =
    typeof khoang === "string"
      ? { range: khoang, granularity: "total", groupBy: "account" }
      : { range: "custom", from: khoang.from, to: khoang.to, granularity: "total", groupBy: "account" };
  const d = await request<{
    period?: { start?: string; end?: string };
    totals?: { total?: number };
    attribution?: { groups?: { key: string; totalUsd?: number }[]; unattributed?: { totalUsd?: number } };
  }>("/usage", {
    query: q,
    caTeam: "hoá đơn kênh của cả team, chia theo kênh; chỗ gọi tự lọc kênh của mình (tong-quan cuaMinh)",
  });
  const theoKenh: Record<string, number> = {};
  for (const g of d.attribution?.groups ?? []) theoKenh[g.key] = Number(g.totalUsd) || 0;
  return {
    tu: d.period?.start ?? "",
    den: d.period?.end ?? "",
    theoKenh,
    khongGanUsd: Number(d.attribution?.unattributed?.totalUsd) || 0,
    tongUsd: Number(d.totals?.total) || 0,
  };
}

/** Một bài trong danh sách số liệu bài đăng (GET /v1/analytics). Số là CỘNG DỒN trọn đời bài. */
export interface SoLieuBai {
  _id: string;
  latePostId?: string | null;
  publishedAt?: string | null;
  isExternal?: boolean;
  isAd?: boolean;
  platform?: string;
  analytics?: {
    impressions?: number; reach?: number; likes?: number; comments?: number; shares?: number; clicks?: number; views?: number;
  } | null;
}

/** Số liệu các bài của MỘT kênh, đăng trong khoảng ngày (YYYY-MM-DD). Đọc hết các trang kết quả. */
export async function layThongKeBai(accountId: string, fromDate: string, toDate: string): Promise<SoLieuBai[]> {
  const tatCa: SoLieuBai[] = [];
  for (let trang = 1; trang <= 20; trang++) {
    const d = await request<{ posts?: SoLieuBai[]; pagination?: { pages?: number } }>("/analytics", {
      query: { accountId, fromDate, toDate, limit: 100, page: trang },
    });
    tatCa.push(...(d.posts ?? []));
    if (trang >= (d.pagination?.pages ?? 1)) break;
  }
  return tatCa;
}

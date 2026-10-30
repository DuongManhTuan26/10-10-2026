import type pg from "pg";
import { query, queryOne, transaction } from "../db.js";
import { coNguon } from "./so-thay-doi.js";
import { getRateLimitState } from "./zernio.js";

/**
 * Hàng rào an toàn theo chính sách nền tảng.
 *
 * MỌI tin nhắn gửi ra ngoài đều phải đi qua `checkOutbound` trước. Không có
 * đường nào khác. Trang bị Meta khóa là mất toàn bộ kênh bán hàng, nên ở đây
 * nguyên tắc là THIẾU DỮ LIỆU THÌ CHẶN, không phải thiếu dữ liệu thì cho qua.
 *
 * Cơ sở chính sách, xác minh từ tài liệu Zernio và lời gọi sống 17/08/2026:
 *
 *   Cửa sổ 24 giờ — tính từ tin CUỐI CÙNG CỦA KHÁCH, không phải tin cuối của
 *   hội thoại. Trong 24 giờ: gửi tự do. Ngoài 24 giờ: bắt buộc dùng
 *   messagingType=MESSAGE_TAG kèm messageTag hợp lệ.
 *
 *   Thẻ hợp lệ (Zernio trả về khi gửi thẻ sai):
 *     CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE, HUMAN_AGENT
 *   Instagram chỉ nhận HUMAN_AGENT.
 *
 *   HUMAN_AGENT cho phép NGƯỜI THẬT trả lời trong 7 ngày. Đây là thẻ dành cho
 *   người, không dành cho máy — AI tuyệt đối không được dùng.
 *
 *   Quá 7 ngày: không ai gửi được, kể cả người thật.
 *
 *   Giới hạn API Zernio: 60 request/phút khi có 0–2 tài khoản kết nối,
 *   600 khi có 3–2000, 1200 khi trên 2000.
 */

/** 24 giờ — cửa sổ nhắn tin chuẩn. */
const STANDARD_WINDOW_MS = 24 * 60 * 60 * 1_000;

/** 7 ngày — giới hạn tuyệt đối của thẻ HUMAN_AGENT. */
const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

/** Trả lời riêng sau bình luận phải gửi trong 7 ngày kể từ lúc bình luận. */
export const COMMENT_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Trần theo bậc chính sách của Zernio, phụ thuộc số tài khoản kết nối của
 * cả team. Đây là con số CHÍNH SÁCH, không phải phỏng đoán:
 *   0–2 tài khoản     -> 60 request/phút
 *   3–2.000 tài khoản -> 600
 *   trên 2.000        -> 1.200
 *
 * Hệ thống ưu tiên dùng hạn mức SỐNG mà Zernio báo về qua header
 * x-ratelimit-limit; bảng này chỉ là phương án dự phòng khi chưa có header
 * nào được đọc (ví dụ ngay sau khi khởi động).
 */
/**
 * Bậc trần tốc độ theo tài liệu nhà cung cấp ("# Rate Limits"): tính theo số kênh đang nối của CẢ TEAM (mọi khách dùng
 * chung một khoá) — 0–2 → 60, 3–2.000 → 600, 2.001+ → 1.200 lượt / phút, cho MỌI lời gọi API.
 */
export function policyLimitPerMinute(connectedAccounts: number): number {
  if (connectedAccounts <= 2) return 60;
  if (connectedAccounts <= 2_000) return 600;
  return 1_200;
}

export type Actor = "ai" | "human" | "system";

export type BlockReason =
  | "window_expired_7d"
  | "ai_outside_24h"
  | "ai_paused"
  | "rate_limited"
  | "ai_hourly_limit"
  | "no_account"
  | "conversation_not_found";

export interface OutboundDecision {
  allowed: boolean;
  reason?: BlockReason;
  /** Thông báo tiếng Việt để hiện cho người dùng hoặc ghi log. */
  message?: string;
  /** Thẻ phải gắn kèm khi gửi, nếu đang ở ngoài cửa sổ 24 giờ. */
  messageTag?: string;
  /** Số giây nên chờ trước khi thử lại, khi bị giới hạn tốc độ. */
  retryAfterSeconds?: number;
  /** Cần thêm dòng khai báo bot vào tin này hay không. */
  needsDisclosure?: boolean;
  disclosureText?: string;
}

/**
 * Cấu hình rào chắn = phần TÀI KHOẢN (trần tin / phút — trần thật của nhà cung cấp, guardrail_configs) + phần CỬA HÀNG
 * (mọi thứ còn lại — rao_chan_cua_hang, A3 / 060). Các cột phần cửa hàng trên guardrail_configs không còn đọc / ghi.
 */
interface GuardrailConfig {
  disclosure_enabled: boolean;
  disclosure_text: string;
  max_sends_per_minute: number;
  max_ai_sends_per_hour: number;
  auto_pause_enabled: boolean;
  failure_rate_threshold: number;
  failure_min_samples: number;
  auto_pause_minutes: number;
  author_dm_cooldown_hours: number;
}

const DEFAULT_CONFIG: GuardrailConfig = {
  disclosure_enabled: true,
  disclosure_text:
    'Em là trợ lý tự động của shop, nếu cần gặp nhân viên anh/chị nhắn "gặp người thật" giúp em nhé.',
  // Bằng đúng hạn mức bậc thấp nhất của chính sách Zernio, không hạ thấp.
  max_sends_per_minute: 60,
  // 0 = không giới hạn. Đây không phải chính sách nền tảng.
  max_ai_sends_per_hour: 0,
  auto_pause_enabled: true,
  failure_rate_threshold: 30,
  failure_min_samples: 10,
  auto_pause_minutes: 60,
  // 0 = tắt, đúng chính sách Meta (một tin mỗi bình luận).
  author_dm_cooldown_hours: 0,
};

/** Các cột rào chắn THEO CỬA HÀNG (rao_chan_cua_hang). */
export const COT_RAO_CHAN_CUA_HANG = [
  "disclosure_enabled", "disclosure_text", "max_ai_sends_per_hour", "auto_pause_enabled",
  "failure_rate_threshold", "failure_min_samples", "auto_pause_minutes", "author_dm_cooldown_hours",
] as const;

/**
 * Câu GHI rào chắn của MỘT cửa hàng (PUT /settings/guardrails dùng; phép thử tự hoàn tác chạy đúng câu này). ON CONFLICT
 * khớp UNIQUE (trang_id) của rao_chan_cua_hang (060). Tham số: $1 trang_id, $2 user_id, $3 disclosure_enabled,
 * $4 disclosure_text, $5 max_ai_sends_per_hour, $6 auto_pause_enabled, $7 failure_rate_threshold, $8 failure_min_samples,
 * $9 auto_pause_minutes (null = giữ giá trị cũ / mặc định).
 */
export const GHI_RAO_CHAN_CUA_HANG = `
  INSERT INTO rao_chan_cua_hang
    (trang_id, user_id, disclosure_enabled, disclosure_text, max_ai_sends_per_hour, auto_pause_enabled,
     failure_rate_threshold, failure_min_samples, auto_pause_minutes)
  VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, COALESCE($7, 30), COALESCE($8, 10), COALESCE($9, 60))
  ON CONFLICT (trang_id) DO UPDATE SET
    disclosure_enabled     = EXCLUDED.disclosure_enabled,
    disclosure_text        = EXCLUDED.disclosure_text,
    max_ai_sends_per_hour  = COALESCE($5, rao_chan_cua_hang.max_ai_sends_per_hour),
    auto_pause_enabled     = EXCLUDED.auto_pause_enabled,
    failure_rate_threshold = COALESCE($7, rao_chan_cua_hang.failure_rate_threshold),
    failure_min_samples    = COALESCE($8, rao_chan_cua_hang.failure_min_samples),
    auto_pause_minutes     = COALESCE($9, rao_chan_cua_hang.auto_pause_minutes),
    updated_at             = now()
  RETURNING *`;

/**
 * Rào chắn áp cho một việc: trần tin / phút của TÀI KHOẢN + phần còn lại của CỬA HÀNG của việc. Cửa hàng chưa có dòng
 * (hoặc việc chưa có cửa hàng) → mặc định, như trước A3.
 */
export async function loadConfig(
  userId: number,
  trangId: number | null,
  db: Pick<pg.PoolClient, "query"> = { query: ((sql: string, ts?: unknown[]) => query(sql, ts)) as never }
): Promise<GuardrailConfig> {
  const tk = (await db.query<{ max_sends_per_minute: number }>(
    "SELECT max_sends_per_minute FROM guardrail_configs WHERE user_id = $1",
    [userId]
  )).rows[0];
  const ch =
    trangId == null
      ? null
      : (await db.query<Omit<GuardrailConfig, "max_sends_per_minute">>(
          `SELECT ${COT_RAO_CHAN_CUA_HANG.join(", ")} FROM rao_chan_cua_hang WHERE trang_id = $1`,
          [trangId]
        )).rows[0] ?? null;
  return {
    ...DEFAULT_CONFIG,
    ...(ch ?? {}),
    max_sends_per_minute: tk?.max_sends_per_minute ?? DEFAULT_CONFIG.max_sends_per_minute,
  };
}

/**
 * Chuẩn hoá giá trị người dùng đặt.
 *
 * KHÔNG hạ trần xuống dưới mức chính sách cho phép. Hệ thống chỉ chặn những
 * giá trị vô nghĩa (số âm, số không phải nguyên) và chặn đúng ngưỡng chính sách
 * thật của Zernio — không thấp hơn một đơn vị nào, vì hạ thấp là bỏ phí năng
 * lực gửi mà nền tảng đã cho phép.
 *
 * Riêng trần tin/phút bị kẹp theo hạn mức THẬT của Zernio: đặt cao hơn hạn mức
 * đó không giúp gửi được nhiều hơn, chỉ dẫn tới lỗi 429.
 */
export function clampConfig(
  input: Partial<GuardrailConfig>,
  policyMaxPerMinute: number
): Partial<GuardrailConfig> {
  const clamped: Partial<GuardrailConfig> = { ...input };

  if (input.max_sends_per_minute !== undefined) {
    clamped.max_sends_per_minute = Math.min(
      Math.max(1, Math.floor(input.max_sends_per_minute)),
      policyMaxPerMinute
    );
  }

  // Trần tin AI mỗi giờ KHÔNG phải chính sách nền tảng, chỉ là công tắc an toàn
  // tuỳ chọn chống phát tán khi có sự cố. 0 nghĩa là không giới hạn.
  if (input.max_ai_sends_per_hour !== undefined) {
    clamped.max_ai_sends_per_hour = Math.max(0, Math.floor(input.max_ai_sends_per_hour));
  }

  // Ngưỡng và thời lượng ngắt là lựa chọn vận hành của chủ shop, không phải
  // chính sách nền tảng — chỉ chặn giá trị vô nghĩa.
  if (input.failure_rate_threshold !== undefined) {
    clamped.failure_rate_threshold = Math.min(
      Math.max(1, Math.floor(input.failure_rate_threshold)),
      100
    );
  }
  if (input.auto_pause_minutes !== undefined) {
    clamped.auto_pause_minutes = Math.max(1, Math.floor(input.auto_pause_minutes));
  }
  if (input.failure_min_samples !== undefined) {
    clamped.failure_min_samples = Math.max(1, Math.floor(input.failure_min_samples));
  }

  return clamped;
}

/** Hạn mức tin/phút được phép, ưu tiên số sống do Zernio báo về. */
/**
 * Số shop đang thật sự gửi tin trong 5 phút gần đây.
 *
 * Nhớ tạm 30 giây: hàm này chạy trước MỖI tin gửi ra, đếm lại mỗi lượt là thêm
 * một truy vấn vào đúng đường nóng nhất của hệ thống.
 */
let nhoSoShop = { luc: 0, so: 1 };

async function soShopDangGui(): Promise<number> {
  if (Date.now() - nhoSoShop.luc < 30_000) return nhoSoShop.so;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(DISTINCT user_id)::int AS n FROM send_attempts
      WHERE created_at > now() - interval '5 minutes'`
  ).catch(() => null);
  nhoSoShop = { luc: Date.now(), so: Math.max(1, row?.n ?? 1) };
  return nhoSoShop.so;
}

/** Phần trần của mỗi shop: chia đều trần chung cho số shop đang gửi, tối thiểu 1. Dùng cho cả hai nhánh. */
export function chiaTran(tran: number, soShop: number): number {
  return Math.max(1, Math.floor(tran / Math.max(1, soShop)));
}

export async function effectiveRateLimit(): Promise<{
  perMinute: number;
  source: "live" | "policy";
  remaining: number | null;
  resetAt: Date | null;
}> {
  const live = getRateLimitState();
  if (live.limit !== null) {
    /*
     * Hạn mức sống là của CẢ HỆ THỐNG, không phải của riêng một shop.
     *
     * Nền tảng trả hạn mức theo khoá API, mà mọi shop dùng chung một khoá. Trả
     * nguyên con số đó cho từng shop nghĩa là mười shop cùng tưởng mình được
     * gửi 600 tin mỗi phút, rồi cả mười cùng đâm vào trần thật và cùng nhận
     * 429 — trong khi không shop nào làm gì sai.
     *
     * Nên chia đều cho số shop ĐANG thật sự gửi tin. Một mình dùng thì vẫn được
     * trọn hạn mức; đông lên thì tự co lại.
     */
    return {
      perMinute: chiaTran(live.limit, await soShopDangGui()),
      source: "live",
      remaining: live.remaining,
      resetAt: live.resetAt,
    };
  }

  /*
   * Chưa có số sống (vừa khởi động): bậc theo số kênh đang nối của CẢ HỆ THỐNG (một khoá API = một team), rồi chia như
   * nhánh số sống. Bản cũ (TD-21, sửa 22/10/2026) đếm kênh của riêng tài khoản này và trả TRỌN bậc cho từng tài khoản.
   */
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM social_accounts WHERE connected = TRUE"
  );
  return {
    perMinute: chiaTran(policyLimitPerMinute(row?.n ?? 0), await soShopDangGui()),
    source: "policy",
    remaining: null,
    resetAt: null,
  };
}

/**
 * Cổng kiểm tra duy nhất cho mọi tin gửi ra ngoài.
 *
 * Thứ tự kiểm tra có chủ đích: rẻ trước, đắt sau, và nghiêm ngặt nhất trước.
 * Cửa sổ 7 ngày xét đầu tiên vì đó là vi phạm nặng nhất.
 */
export async function checkOutbound(params: {
  conversationId: string;
  actor: Actor;
  /** Bỏ qua kiểm tra giới hạn tốc độ — chỉ dùng cho tin hệ thống bắt buộc. */
  skipRateLimit?: boolean;
}): Promise<OutboundDecision> {
  const conversation = await queryOne<{
    user_id: number;
    trang_id: number | null;
    social_account_id: string | null;
    platform: string;
    last_customer_message_at: Date | null;
    disclosure_sent_at: Date | null;
    ai_paused_until: Date | null;
    ai_pause_reason: string | null;
  }>(
    `SELECT c.user_id, c.trang_id, c.social_account_id, c.platform,
            c.last_customer_message_at, c.disclosure_sent_at,
            a.ai_paused_until, a.ai_pause_reason
       FROM conversations c
       LEFT JOIN social_accounts a ON a.id = c.social_account_id
      WHERE c.id = $1`,
    [params.conversationId]
  );

  if (!conversation) {
    return {
      allowed: false,
      reason: "conversation_not_found",
      message: "Không tìm thấy hội thoại này.",
    };
  }

  if (!conversation.social_account_id) {
    return {
      allowed: false,
      reason: "no_account",
      message: "Hội thoại không còn gắn với kênh nào nên không gửi được.",
    };
  }

  const config = await loadConfig(conversation.user_id, conversation.trang_id);

  // Mốc tính cửa sổ: tin cuối cùng CỦA KHÁCH. Không có mốc thì coi như đã
  // quá hạn — thà chặn oan còn hơn gửi sai và mất Trang.
  const lastCustomerAt = conversation.last_customer_message_at;
  const elapsed = lastCustomerAt
    ? Date.now() - lastCustomerAt.getTime()
    : Number.POSITIVE_INFINITY;

  // ── HÀNG RÀO 4: quá 7 ngày thì không ai gửi được ──────────────────────
  if (elapsed > HUMAN_AGENT_WINDOW_MS) {
    return {
      allowed: false,
      reason: "window_expired_7d",
      message:
        "Đã quá 7 ngày kể từ tin nhắn cuối của khách. Nền tảng không cho phép " +
        "gửi tin nữa, kể cả nhân viên. Vui lòng chờ khách nhắn lại.",
    };
  }

  const outsideStandardWindow = elapsed > STANDARD_WINDOW_MS;

  // ── HÀNG RÀO 7: ngoài 24 giờ thì chỉ NGƯỜI THẬT được gửi ──────────────
  if (outsideStandardWindow && params.actor === "ai") {
    return {
      allowed: false,
      reason: "ai_outside_24h",
      message:
        "Đã quá 24 giờ kể từ tin nhắn cuối của khách. Ngoài cửa sổ này chỉ " +
        "nhân viên được trả lời, AI không được phép.",
    };
  }

  // ── HÀNG RÀO 6: AI đang bị tạm ngắt (tỷ lệ lỗi cao / Facebook chặn gửi) ─
  if (
    params.actor === "ai" &&
    conversation.ai_paused_until &&
    conversation.ai_paused_until.getTime() > Date.now()
  ) {
    return {
      allowed: false,
      reason: "ai_paused",
      message: cauAiTamNgat(conversation.ai_pause_reason, conversation.ai_paused_until),
    };
  }

  // ── HÀNG RÀO 5: giới hạn tốc độ ───────────────────────────────────────
  if (!params.skipRateLimit) {
    /*
     * Trần tin/phút lấy đúng hạn mức Zernio cho phép, không tự hạ thấp.
     * Ưu tiên con số SỐNG từ header x-ratelimit-limit; chưa có header thì dùng
     * bậc chính sách theo số tài khoản kết nối.
     */
    const policy = await effectiveRateLimit();
    const perMinuteCap = Math.min(config.max_sends_per_minute, policy.perMinute);

    // Zernio còn báo chính xác còn lại bao nhiêu. Hết hạn mức thật thì chặn
    // ngay kèm mốc nạp lại, thay vì gửi để nhận 429 và mất tin.
    if (policy.source === "live" && policy.remaining !== null && policy.remaining <= 0) {
      const waitSeconds = policy.resetAt
        ? Math.max(1, Math.ceil((policy.resetAt.getTime() - Date.now()) / 1_000))
        : 60;
      return {
        allowed: false,
        reason: "rate_limited",
        message:
          `Đã dùng hết hạn mức ${policy.perMinute} request/phút của Zernio. ` +
          `Nạp lại sau ${waitSeconds} giây.`,
        retryAfterSeconds: waitSeconds,
      };
    }
    const recent = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM send_attempts
        WHERE user_id = $1 AND decision = 'allowed'
          AND created_at > now() - interval '1 minute'`,
      [conversation.user_id]
    );

    if ((recent?.n ?? 0) >= perMinuteCap) {
      return {
        allowed: false,
        reason: "rate_limited",
        message:
          `Đã gửi ${recent?.n} tin trong một phút, đạt giới hạn ${perMinuteCap} tin/phút. ` +
          `Chờ một chút rồi thử lại.`,
        retryAfterSeconds: 60,
      };
    }

    // Trần tin AI mỗi giờ là công tắc tuỳ chọn của chủ shop, KHÔNG phải chính
    // sách nền tảng. Đặt 0 nghĩa là không giới hạn.
    if (params.actor === "ai" && config.max_ai_sends_per_hour > 0) {
      const hourlyCap = config.max_ai_sends_per_hour;
      // Trần AI / giờ là của CỬA HÀNG (A3): cửa hàng này lỗi vòng lặp không làm tắt AI cửa hàng khác.
      const hourly = await queryOne<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM send_attempts
          WHERE user_id = $1 AND trang_id IS NOT DISTINCT FROM $2 AND actor = 'ai' AND decision = 'allowed'
            AND created_at > now() - interval '1 hour'`,
        [conversation.user_id, conversation.trang_id]
      );

      if ((hourly?.n ?? 0) >= hourlyCap) {
        return {
          allowed: false,
          reason: "ai_hourly_limit",
          message:
            `AI đã gửi ${hourly?.n} tin trong một giờ, đạt giới hạn ${hourlyCap}. ` +
            `Đây là chốt chặn chống phát tán khi có sự cố.`,
          retryAfterSeconds: 300,
        };
      }
    }
  }

  // ── HÀNG RÀO 3: dòng khai báo bot ở tin đầu tiên của AI ───────────────
  /*
   * Khai báo ĐÚNG MỘT LẦN cho mỗi khách, kể cả khi lời khai báo đã nằm trong
   * câu chào mẫu của kịch bản bình luận.
   *
   * Câu chào mẫu gửi thẳng qua zernio.privateReplyToComment nên không chạm vào
   * cờ disclosure_sent_at, mà lúc đó hội thoại còn chưa tồn tại để mà đánh dấu.
   * Nối hai bên qua chính con người: comments.author_id và
   * customers.participant_id là cùng một id (đã kiểm chứng trên dữ liệu thật).
   *
   * Chỉ tính những câu chào mẫu ĐÃ CHẮC CHẮN có khai báo (cột dm_disclosed do
   * sendPrivateReply ghi), nên không bao giờ có chuyện bỏ khai báo cả hai nơi.
   * Giới hạn 7 ngày — đúng cửa sổ trả lời riêng của Meta; xa hơn thì coi như
   * lần tiếp xúc mới, nói lại là đúng.
   */
  let daKhaiBaoQuaCauChao = false;
  if (
    params.actor === "ai" &&
    config.disclosure_enabled &&
    conversation.disclosure_sent_at === null
  ) {
    const cauChao = await queryOne(
      `SELECT 1
         FROM conversations c
         JOIN customers k ON k.id = c.customer_id
         JOIN comments cm ON cm.user_id = c.user_id AND cm.author_id = k.participant_id
        WHERE c.id = $1
          AND cm.dm_disclosed = TRUE
          AND cm.private_replied_at > now() - interval '7 days'
        LIMIT 1`,
      [params.conversationId]
    );
    if (cauChao) {
      daKhaiBaoQuaCauChao = true;
      // Đánh dấu luôn để lần sau không phải tra lại.
      await query(
        "UPDATE conversations SET disclosure_sent_at = now() WHERE id = $1 AND disclosure_sent_at IS NULL",
        [params.conversationId]
      );
    }
  }

  const needsDisclosure =
    params.actor === "ai" &&
    config.disclosure_enabled &&
    conversation.disclosure_sent_at === null &&
    !daKhaiBaoQuaCauChao;

  return {
    allowed: true,
    // Ngoài 24 giờ, người thật gửi được nhưng phải gắn thẻ HUMAN_AGENT.
    // Instagram chỉ nhận thẻ này, Facebook nhận thêm 3 thẻ khác nhưng
    // HUMAN_AGENT là thẻ đúng ngữ cảnh khi nhân viên trả lời khách.
    messageTag: outsideStandardWindow ? "HUMAN_AGENT" : undefined,
    needsDisclosure,
    disclosureText: needsDisclosure ? config.disclosure_text : undefined,
  };
}

/** Ghi nhận một lần gửi, dùng cho giới hạn tốc độ và đo tỷ lệ lỗi. */
/**
 * Xin một suất gửi cho việc trả lời bình luận.
 *
 * Vì sao cần: đường bình luận đi THẲNG tới Zernio, không qua sendMessageSafely,
 * nên nó không hề bị bộ đếm nào ràng buộc. Đã đo: hàng đợi lấy 50 tin riêng +
 * 50 trả lời công khai mỗi lượt quét, worker quét 5 giây một lần — tối đa 1200
 * lượt gửi mỗi phút, trong khi bậc thấp nhất của Zernio là 60. Vượt 20 lần.
 *
 * Một bài viral là đủ để ăn 429 hàng loạt. Dự án này đã dính một lần rồi: retry
 * dồn dập khiến Cloudflare trả error code 1015 và chặn cả tunnel.
 *
 * Dùng CHUNG bảng send_attempts với đường tin nhắn, không đếm riêng: hai bộ đếm
 * mỗi cái 60 thì tổng thành 120, vẫn vượt.
 */
export async function xinPhepGuiBinhLuan(
  userId: number,
  socialAccountId: string | null,
  trangId: number | null
): Promise<{ duoc: boolean; lyDo: string }> {
  const config = await loadConfig(userId, trangId);
  const policy = await effectiveRateLimit();
  const tran = Math.min(config.max_sends_per_minute, policy.perMinute);

  // Zernio báo chính xác còn lại bao nhiêu thì tin con số đó trước.
  if (policy.source === "live" && policy.remaining !== null && policy.remaining <= 0) {
    return { duoc: false, lyDo: `Hết hạn mức Zernio, chờ nạp lại` };
  }

  const ganDay = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM send_attempts
      WHERE user_id = $1 AND decision = 'allowed'
        AND created_at > now() - interval '1 minute'`,
    [userId]
  );

  if ((ganDay?.n ?? 0) >= tran) {
    return {
      duoc: false,
      lyDo: `Đã gửi ${ganDay?.n} lượt trong một phút, đạt trần ${tran}/phút`,
    };
  }

  // Ghi chỗ NGAY khi cho phép, không đợi gửi xong: đợi thì lượt quét kế tiếp
  // vẫn thấy bộ đếm cũ và cho qua thêm một loạt nữa.
  await recordAttempt({
    userId,
    trangId,
    socialAccountId,
    conversationId: null,
    actor: "ai",
    decision: "allowed",
  });

  return { duoc: true, lyDo: "" };
}

export async function recordAttempt(params: {
  userId: number;
  /** Cửa hàng CỦA VIỆC (hội thoại / bình luận) — đếm trần AI / giờ, nhật ký bị chặn, số liệu theo cửa hàng (A3). */
  trangId: number | null;
  socialAccountId: string | null;
  conversationId: string | null;
  actor: Actor;
  decision: "allowed" | "blocked";
  blockReason?: string;
  messageTag?: string;
  outcome?: "sent" | "failed" | "pending";
  errorCode?: string;
  /** Chống gửi lặp (063, services/chong-gui-lap.ts): mã lần khởi động, mã kích hoạt, băm nội dung của lần gửi THẬT. */
  maKhoiDong?: string;
  maKichHoat?: string | null;
  noiDungBam?: string;
}): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO send_attempts
       (user_id, social_account_id, conversation_id, actor, decision,
        block_reason, message_tag, outcome, error_code, trang_id, ma_khoi_dong, ma_kich_hoat, noi_dung_bam)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      params.userId,
      params.socialAccountId,
      params.conversationId,
      params.actor,
      params.decision,
      params.blockReason ?? null,
      params.messageTag ?? null,
      params.outcome ?? "pending",
      params.errorCode ?? null,
      params.trangId,
      params.maKhoiDong ?? null,
      params.maKichHoat ?? null,
      params.noiDungBam ?? null,
    ]
  );
  return row!.id;
}

export async function markAttemptOutcome(
  attemptId: number,
  outcome: "sent" | "failed",
  errorCode?: string
): Promise<void> {
  await query("UPDATE send_attempts SET outcome = $2, error_code = $3 WHERE id = $1", [
    attemptId,
    outcome,
    errorCode ?? null,
  ]);
}

/** Đánh dấu đã khai báo bot cho hội thoại, để không lặp lại. */
export async function markDisclosureSent(conversationId: string): Promise<void> {
  await query(
    "UPDATE conversations SET disclosure_sent_at = now() WHERE id = $1 AND disclosure_sent_at IS NULL",
    [conversationId]
  );
}

/**
 * HÀNG RÀO 6 — tự ngắt AI khi tỷ lệ gửi thất bại vọt lên.
 *
 * Meta không cung cấp tỷ lệ khách chặn Trang, nên không thể đo trực tiếp chỉ số
 * đó. Thứ đo được và có ý nghĩa tương đương là tỷ lệ gửi THẤT BẠI: khi khách
 * chặn Trang, khi Trang bị hạn chế, hoặc khi token có vấn đề, các lệnh gửi bắt
 * đầu trả lỗi. Tỷ lệ lỗi tăng vọt là tín hiệu sớm nhất có thật.
 *
 * Gọi sau mỗi lần gửi thất bại.
 */
export async function evaluateAutoPause(params: {
  userId: number;
  /** Cửa hàng của việc vừa gửi lỗi — ngưỡng ngắt lấy theo cửa hàng; ngắt vẫn THEO KÊNH (ai_paused_until). */
  trangId: number | null;
  socialAccountId: string;
}): Promise<{ paused: boolean; reason?: string; until?: Date }> {
  const config = await loadConfig(params.userId, params.trangId);
  if (!config.auto_pause_enabled) return { paused: false };

  /*
   * CHỈ đếm những lượt đã biết kết quả.
   *
   * Chỉ đếm lượt có kết quả CHẮC ('sent' / 'failed'); 'bo_do' / 'chua_ro' (chống gửi lặp, 063) không phải lỗi nền tảng.
   * Lượt còn 'pending' là lượt tiến trình chết giữa chừng, không biết tin có
   * tới khách hay không. Đếm nó vào mẫu số mà không vào tử số là làm LOÃNG tỷ
   * lệ lỗi — đúng lúc hệ thống đang sập thì lưới an toàn lại càng khó nổ.
   *
   * Đã đo trên dữ liệu thật: 17/34 = 50% theo cách cũ, trong khi chỉ tính lượt
   * đã có kết quả là 17/26 = 65%. Tệ hơn nữa: 5 thất bại + 15 treo ra 25% nên
   * KHÔNG ngắt, trong khi thực chất 5/5 tin đã gửi đều hỏng.
   */
  const stats = await queryOne<{ total: number; failed: number }>(
    `SELECT COUNT(*) FILTER (WHERE outcome IN ('sent', 'failed'))::int AS total,
            COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed
       FROM send_attempts
      WHERE social_account_id = $1 AND decision = 'allowed'
        AND created_at > now() - interval '1 hour'`,
    [params.socialAccountId]
  );

  const total = stats?.total ?? 0;
  const failed = stats?.failed ?? 0;

  // Mẫu quá nhỏ thì không kết luận, tránh ngắt oan vì một lỗi lẻ.
  if (total < config.failure_min_samples) return { paused: false };

  const rate = Math.round((failed / total) * 100);
  if (rate < config.failure_rate_threshold) return { paused: false };

  const until = new Date(Date.now() + config.auto_pause_minutes * 60_000);
  const reason =
    `tỷ lệ gửi thất bại ${rate}% trong một giờ (${failed}/${total} tin), ` +
    `vượt ngưỡng ${config.failure_rate_threshold}%`;

  // Sổ thay đổi: đây là HỆ THỐNG tự ngắt, không phải chủ shop — ghi nguồn trong cùng giao dịch (trigger đọc).
  await transaction(async (c) => {
    await coNguon(c, "he_thong");
    await c.query(
      `UPDATE social_accounts
          SET ai_paused_until = $2, ai_pause_reason = $3, ai_paused_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [params.socialAccountId, until, reason]
    );
  });

  console.error(
    `[hàng rào] TẠM NGẮT AI trên kênh ${params.socialAccountId}: ${reason}. ` +
      `Mở lại lúc ${until.toISOString()}`
  );

  return { paused: true, reason, until };
}

/** Câu "AI đang tạm ngắt" — MỘT nguồn cho cổng gửi (HÀNG RÀO 6) và lối ra sớm của AI Bán hàng. */
export function cauAiTamNgat(lyDo: string | null, den: Date): string {
  return (
    `AI đang tạm ngắt trên kênh này: ${lyDo ?? "tỷ lệ lỗi cao"}. ` +
    `Mở lại lúc ${den.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`
  );
}

/**
 * FACEBOOK CHẶN FANPAGE GỬI TIN (TD-36, 30/10/2026).
 *
 * Đo thật 30/10: Fanpage của cửa hàng 370 gửi lỗi "(#2022) Bạn tạm thời bị hạn chế gửi tin nhắn đến ngày mai lúc 18:20."
 * → AI vẫn được gọi cho mỗi tin khách, rồi lượt nhường người gửi thêm MỘT tin chắc chắn hỏng (send_attempts 206 + 207).
 * Bảng mã lỗi Messenger (developers.facebook.com/docs/messenger-platform/error-codes, đọc 30/10/2026):
 *   2022 "The ability to send commerce messages has been temporarily disabled … feature limit placed after a policy violation."
 *   10 / 1893063 "You are temporarily restricted from sending messages." (Messaging Policies)
 * Tài liệu KHÔNG nói thời hạn; câu "đến … 18:20" không rõ múi giờ → KHÔNG đọc mốc trong câu. Ngắt 24 giờ; hết mốc mà vẫn
 * bị chặn thì lần gửi kế tiếp lỗi lại → ngắt lại (tối đa một lượt hỏng mỗi ngày).
 * Mã có cấu trúc (platformError.code / subcode trong thân lỗi của nhà cung cấp) trước; chuỗi "(#2022)" chỉ là dự phòng.
 * Chỉ chặn NHẮN TIN — ngắt cũng chỉ áp cho tin nhắn (HÀNG RÀO 6), không đụng bình luận / đăng bài.
 */
export const NGAT_KHI_BI_CHAN_MS = 24 * 60 * 60_000;

/** Câu đặt ngắt (một nguồn cho hàm ngắt và phép thử tự hoàn tác scripts/thu-td36-hoan-tac.mts). $1 kênh, $2 ms, $3 lý do. */
export const DAT_NGAT_KHI_BI_CHAN = `
  UPDATE social_accounts
     SET ai_paused_until = now() + make_interval(secs => $2::double precision / 1000),
         ai_pause_reason = $3, ai_paused_at = now(), updated_at = now()
   WHERE id = $1
     AND (ai_paused_until IS NULL
          OR ai_paused_until < now() + make_interval(secs => $2::double precision / 1000) - interval '1 hour')
   RETURNING ai_paused_until, user_id, trang_id, display_name`;

export function laKenhBiChanGui(error: unknown): boolean {
  const e = error as { body?: { platformError?: Record<string, unknown> }; nguyenVan?: unknown; message?: unknown } | null;
  const pe = e?.body?.platformError;
  const code = Number(pe?.code);
  const sub = Number(pe?.subcode ?? pe?.error_subcode);
  if (code === 2022) return true;
  if (code === 10 && sub === 1893063) return true;
  const cau = typeof e?.nguyenVan === "string" ? e.nguyenVan : typeof e?.message === "string" ? e.message : "";
  return /\(#2022\)/.test(cau);
}

/** Gửi một tin cho chủ kênh + mọi quản trị, không trùng người. true = ít nhất một người nhận. */
async function guiChuKenhVaQuanTri(chuKenh: number, trangId: number | null, noiDung: string): Promise<boolean> {
  const { sendTelegramMessage } = await import("./telegram.js");
  const admins = await query<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
  const nguoiNhan = [...new Set([chuKenh, ...admins.rows.map((a) => a.id)])];
  let da = 0;
  for (const id of nguoiNhan) {
    if (await sendTelegramMessage(id, noiDung, "kenh_bi_chan", id === chuKenh ? trangId : null).catch(() => false)) da++;
  }
  return da > 0;
}

/**
 * Ngắt AI của kênh 24 giờ vì Facebook chặn gửi. Chống lặp bằng CHÍNH mốc ngắt: chỉ đặt (và chỉ báo Telegram) khi kênh
 * chưa ngắt, hoặc mốc cũ kết thúc sớm hơn mốc mới quá 1 giờ (vd. đang tự ngắt 30 phút vì tỷ lệ lỗi). Hai lượt lỗi cùng lúc:
 * lượt sau thấy mốc của lượt trước → không đặt lại, không báo lần hai.
 */
export async function ngatKenhBiChanGui(
  params: { socialAccountId: string; loi: string },
  gui: (chuKenh: number, trangId: number | null, noiDung: string) => Promise<boolean> = guiChuKenhVaQuanTri
): Promise<Date | null> {
  const lyDo = `Facebook đang chặn Fanpage gửi tin nhắn (${params.loi.slice(0, 200)})`;
  const dat = await transaction(async (c) => {
    await coNguon(c, "he_thong");
    const r = await c.query<{ ai_paused_until: Date; user_id: number; trang_id: number | null; display_name: string | null }>(
      DAT_NGAT_KHI_BI_CHAN,
      [params.socialAccountId, NGAT_KHI_BI_CHAN_MS, lyDo]
    );
    return r.rows[0] ?? null;
  });
  if (!dat) return null;

  const { escapeHtml } = await import("./telegram.js");
  console.error(`[hàng rào] Facebook CHẶN GỬI trên kênh ${params.socialAccountId}: ${params.loi}. AI ngắt tới ${dat.ai_paused_until.toISOString()}`);
  const noiDung =
    "⛔ <b>FACEBOOK ĐANG CHẶN FANPAGE GỬI TIN NHẮN</b>\n\n" +
    `<b>Kênh:</b> ${escapeHtml(dat.display_name ?? params.socialAccountId)}\n` +
    `<b>Facebook báo:</b> ${escapeHtml(params.loi.slice(0, 300))}\n\n` +
    `AI tạm dừng trả lời tin nhắn trên kênh này tới ${dat.ai_paused_until.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} ` +
    "(không gọi AI, không gửi thêm tin nào). Tin khách vẫn vào hộp thư và chuyển chờ người. Bình luận và đăng bài không bị ảnh hưởng.";
  if (!(await gui(dat.user_id, dat.trang_id, noiDung).catch(() => false))) {
    console.error("[hàng rào] Không gửi được Telegram báo kênh bị chặn — kênh vẫn đang ngắt.");
  }
  return dat.ai_paused_until;
}

/** Mở lại AI cho một kênh trước thời hạn, do chủ shop chủ động. */
export async function resumeAi(socialAccountId: string, userId: number): Promise<boolean> {
  const result = await query(
    `UPDATE social_accounts
        SET ai_paused_until = NULL, ai_pause_reason = NULL, updated_at = now()
      WHERE id = $1 AND user_id = $2`,
    [socialAccountId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Kiểm tra bình luận còn trong cửa sổ 7 ngày để trả lời riêng.
 * Tài liệu Zernio ghi rõ: một lần cho mỗi bình luận, trong 7 ngày.
 */
export function commentReplyAllowed(commentCreatedAt: Date | null): {
  allowed: boolean;
  message?: string;
} {
  if (!commentCreatedAt) {
    // Không biết thời điểm bình luận thì không dám gửi.
    return {
      allowed: false,
      message: "Không rõ thời điểm bình luận nên không gửi tin riêng.",
    };
  }
  const elapsed = Date.now() - commentCreatedAt.getTime();
  if (elapsed > COMMENT_REPLY_WINDOW_MS) {
    return {
      allowed: false,
      message: "Bình luận đã quá 7 ngày, nền tảng không cho nhắn tin riêng nữa.",
    };
  }
  return { allowed: true };
}

/** Trạng thái hàng rào để hiện trên giao diện. */
/**
 * Trạng thái rào chắn của CỬA HÀNG đang chọn (A3). "Lượt / phút vừa rồi" đếm cả TÀI KHOẢN — vì nó so với trần tin / phút
 * dùng chung (cấp tài khoản); mọi số khác đếm theo cửa hàng.
 */
export async function guardrailStatus(userId: number, trangId: number | null): Promise<Record<string, unknown>> {
  const config = await loadConfig(userId, trangId);

  const usage = await queryOne<{
    last_minute: number;
    ai_last_hour: number;
    failed_last_hour: number;
    total_last_hour: number;
    decided_last_hour: number;
    blocked_last_day: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE decision = 'allowed'
                          AND created_at > now() - interval '1 minute')::int AS last_minute,
       COUNT(*) FILTER (WHERE cua_hang AND decision = 'allowed' AND actor = 'ai'
                          AND created_at > now() - interval '1 hour')::int   AS ai_last_hour,
       COUNT(*) FILTER (WHERE cua_hang AND outcome = 'failed'
                          AND created_at > now() - interval '1 hour')::int   AS failed_last_hour,
       COUNT(*) FILTER (WHERE cua_hang AND decision = 'allowed'
                          AND created_at > now() - interval '1 hour')::int   AS total_last_hour,
       /* Chỉ những lượt đã biết kết quả — xem chú thích ở evaluateAutoPause. */
       COUNT(*) FILTER (WHERE cua_hang AND decision = 'allowed' AND outcome IN ('sent', 'failed')
                          AND created_at > now() - interval '1 hour')::int   AS decided_last_hour,
       COUNT(*) FILTER (WHERE cua_hang AND decision = 'blocked'
                          AND created_at > now() - interval '1 day')::int    AS blocked_last_day
     FROM (SELECT *, trang_id IS NOT DISTINCT FROM $2 AS cua_hang FROM send_attempts WHERE user_id = $1) s`,
    [userId, trangId]
  );

  const paused = await query<{
    id: string;
    display_name: string;
    ai_paused_until: Date;
    ai_pause_reason: string;
  }>(
    `SELECT id, display_name, ai_paused_until, ai_pause_reason
       FROM social_accounts
      WHERE user_id = $1 AND trang_id IS NOT DISTINCT FROM $2 AND ai_paused_until > now()`,
    [userId, trangId]
  );

  const blockedBreakdown = await query<{ block_reason: string; n: number }>(
    `SELECT block_reason, COUNT(*)::int AS n FROM send_attempts
      WHERE user_id = $1 AND trang_id IS NOT DISTINCT FROM $2 AND decision = 'blocked'
        AND created_at > now() - interval '7 days'
      GROUP BY block_reason ORDER BY n DESC`,
    [userId, trangId]
  );

  const totalHour = usage?.total_last_hour ?? 0;

  const policy = await effectiveRateLimit();

  return {
    config,
    // Hạn mức thật của nền tảng, để giao diện hiện đúng con số được phép dùng.
    rateLimit: {
      perMinute: policy.perMinute,
      source: policy.source,
      remaining: policy.remaining,
      resetAt: policy.resetAt,
    },
    usage: {
      sentLastMinute: usage?.last_minute ?? 0,
      aiSentLastHour: usage?.ai_last_hour ?? 0,
      failureRateLastHour: (() => {
        // Mẫu số là số lượt ĐÃ BIẾT kết quả, không phải tổng số lượt đã cho gửi.
        const daBiet = usage?.decided_last_hour ?? 0;
        return daBiet > 0 ? Math.round(((usage?.failed_last_hour ?? 0) / daBiet) * 100) : 0;
      })(),
      totalLastHour: totalHour,
      blockedLastDay: usage?.blocked_last_day ?? 0,
    },
    pausedAccounts: paused.rows,
    blockedReasons: blockedBreakdown.rows,
  };
}

import { query, queryOne } from "../db.js";
import { AppError } from "../http.js";
import { boMarkdown } from "./text.js";
import * as zernio from "./zernio.js";
import {
  checkOutbound,
  recordAttempt,
  markAttemptOutcome,
  markDisclosureSent,
  evaluateAutoPause,
  laKenhBiChanGui,
  ngatKenhBiChanGui,
  type Actor,
} from "./guardrails.js";
import { chanCuaRa } from "./cua-ra.js";
import { bamNoiDung, LOI_CHUA_RO_TIN, MA_KHOI_DONG, quyetDinhDoiChieu, tinCuaTrang, type KetDoiChieu } from "./chong-gui-lap.js";

/**
 * Đối chiếu các lần gửi CỦA LẦN KHỞI ĐỘNG KHÁC còn 'pending' trong hội thoại với tin thật bên nhà cung cấp, ghi kết quả.
 * Đọc lỗi → mọi lần dở là 'chua_ro' (không đoán). Không có lần dở → không gọi nhà cung cấp.
 */
async function doiChieuLanBoDo(
  conversationId: string,
  maLuong: string,
  kenh: string
): Promise<{ maKichHoat: string | null; ket: KetDoiChieu }[]> {
  const lanDo = await query<{ id: number; ma_kich_hoat: string | null; noi_dung_bam: string; created_at: Date }>(
    `SELECT id, ma_kich_hoat, noi_dung_bam, created_at FROM send_attempts
      WHERE conversation_id = $1 AND decision = 'allowed' AND outcome = 'pending'
        AND ma_khoi_dong IS NOT NULL AND ma_khoi_dong <> $2 AND noi_dung_bam IS NOT NULL`,
    [conversationId, MA_KHOI_DONG]
  );
  if (lanDo.rows.length === 0) return [];
  let tin: ReturnType<typeof tinCuaTrang> | null = null;
  try {
    tin = tinCuaTrang((await zernio.getConversation(maLuong, kenh, 50)).messages as Array<Record<string, unknown>>);
  } catch (error) {
    console.warn(`[chống gửi lặp] Không đọc được tin của ${conversationId}:`, error instanceof Error ? error.message : error);
  }
  const ra: { maKichHoat: string | null; ket: KetDoiChieu }[] = [];
  for (const l of lanDo.rows) {
    const ket: KetDoiChieu = tin ? quyetDinhDoiChieu({ bam: l.noi_dung_bam, luc: l.created_at }, tin) : { ket: "chua_ro" };
    await query("UPDATE send_attempts SET outcome = $2, error_code = 'doi_chieu' WHERE id = $1", [
      l.id,
      // 'bo_do' (bị cắt trước khi đi) / 'chua_ro' KHÔNG phải lỗi nền tảng — lưới tự ngắt chỉ đếm 'sent' / 'failed'.
      ket.ket === "da_gui" ? "sent" : ket.ket === "chua_ro" ? "chua_ro" : "bo_do",
    ]);
    ra.push({ maKichHoat: l.ma_kich_hoat, ket });
  }
  return ra;
}

/**
 * Đường duy nhất để gửi tin nhắn ra ngoài.
 *
 * Không nơi nào trong hệ thống được gọi zernio.sendMessage trực tiếp. Mọi lệnh
 * gửi đều đi qua đây để chắc chắn hàng rào an toàn được áp dụng — nếu có hai
 * đường gửi thì sớm muộn sẽ có một đường quên kiểm tra, và đó là lúc Trang bị
 * khóa.
 */

export interface SendResult {
  sent: boolean;
  /** Nội dung thật đã gửi, có thể khác text đầu vào vì đã thêm khai báo bot. */
  text: string;
  externalId: string | null;
  messageTag?: string;
  /** Lý do bị chặn, nếu không gửi được. */
  blockReason?: string;
  blockMessage?: string;
  /**
   * Có đáng thử lại không.
   *
   * Phân biệt hai loại thất bại khác hẳn nhau:
   *   - Tạm thời (hết giờ chờ, lỗi mạng, 429, 5xx): thử lại có cơ hội thành công.
   *   - Dứt khoát (4xx như sai id hội thoại, thiếu quyền): thử lại bao nhiêu lần
   *     cũng hỏng y như vậy, phải gọi người thật.
   *
   * Quan trọng hơn: chỉ được thử lại khi tin gần như chắc chắn CHƯA tới nơi.
   * Gửi trùng một tin cho khách là mẫu hành vi Meta gắn cờ bot.
   */
  retryable?: boolean;
}

/**
 * Gửi tin nhắn có kiểm tra hàng rào.
 *
 * @param throwOnBlock true thì ném AppError khi bị chặn (dùng cho route để
 *        nhân viên thấy thông báo), false thì trả về kết quả (dùng cho AI chạy
 *        nền, nơi bị chặn là tình huống bình thường chứ không phải lỗi).
 */
export async function sendMessageSafely(params: {
  conversationId: string;
  text: string;
  actor: Actor;
  throwOnBlock?: boolean;
  skipRateLimit?: boolean;
  /**
   * Mã KÍCH HOẠT có căn cứ (tin khách mà AI đang trả lời, lần nhắc…) — chống gửi lặp: lần gửi bị bỏ dở do khởi động lại
   * mà cùng mã kích hoạt thì KHÔNG gửi lần hai (services/chong-gui-lap.ts). Không có mã → gửi như thường.
   */
  maKichHoat?: string;
}): Promise<SendResult> {
  const conversation = await queryOne<{
    user_id: number;
    social_account_id: string | null;
    ma_luong: string;
    trang_id: number | null;
    nhiem_ky_id: number | null;
  }>("SELECT user_id, social_account_id, ma_luong, trang_id, nhiem_ky_id FROM conversations WHERE id = $1", [
    params.conversationId,
  ]);

  if (!conversation) {
    if (params.throwOnBlock) throw new AppError("Không tìm thấy hội thoại", 404);
    return {
      sent: false,
      text: params.text,
      externalId: null,
      blockReason: "conversation_not_found",
      blockMessage: "Không tìm thấy hội thoại",
    };
  }

  /*
   * CHỐT CỬA RA (services/cua-ra.ts): chỉ gửi qua kênh còn thuộc đúng CỬA HÀNG CỦA HỘI THOẠI và đang ở đúng NHIỆM KỲ
   * của hội thoại (đợt 2a — nhiệm kỳ kênh). Kênh đã rời / quay về (nhiệm kỳ mới) → hội thoại cũ chỉ xem, không gửi.
   * Hội thoại chưa có cửa hàng (kênh chưa gắn cửa hàng — thoáng qua lúc nối): chanCuaRa(NULL) CHẶN — chưa có cửa hàng thuê
   * kênh thì không ai gửi được, kể cả nhân viên trả lời tay (phiên kiểm duyệt duyệt 19/10, đợt 2b).
   */
  let kenhGui: string;
  try {
    const cuaRa = await chanCuaRa(
      conversation.user_id,
      [conversation.social_account_id],
      conversation.trang_id,
      undefined,
      conversation.nhiem_ky_id
    );
    kenhGui = cuaRa.duoc[0];
  } catch (error) {
    if (params.throwOnBlock || !(error instanceof AppError)) throw error;
    return { sent: false, text: params.text, externalId: null, blockReason: "kenh_da_roi", blockMessage: error.message };
  }

  const decision = await checkOutbound({
    conversationId: params.conversationId,
    actor: params.actor,
    skipRateLimit: params.skipRateLimit,
  });

  if (!decision.allowed) {
    // Ghi lại cả lần bị chặn: chủ shop cần thấy hệ thống đã ngăn những gì,
    // và số liệu này là cơ sở để điều chỉnh ngưỡng.
    await recordAttempt({
      userId: conversation.user_id,
      trangId: conversation.trang_id,
      socialAccountId: conversation.social_account_id,
      conversationId: params.conversationId,
      actor: params.actor,
      decision: "blocked",
      blockReason: decision.reason,
      outcome: "pending",
    });

    console.log(
      `[hàng rào] CHẶN gửi tin (${params.actor}) trong ${params.conversationId}: ` +
        `${decision.reason} — ${decision.message}`
    );

    if (params.throwOnBlock) {
      throw new AppError(
        decision.message ?? "Không được phép gửi tin trong tình huống này.",
        decision.reason === "rate_limited" || decision.reason === "ai_hourly_limit"
          ? 429
          : 409
      );
    }

    return {
      sent: false,
      text: params.text,
      externalId: null,
      blockReason: decision.reason,
      blockMessage: decision.message,
    };
  }

  /*
   * HÀNG RÀO 3 — khai báo bot.
   *
   * Thêm vào tin ĐẦU TIÊN mà AI gửi trong mỗi hội thoại. Khách có quyền biết
   * mình đang nói chuyện với máy; đây cũng là yêu cầu của chính sách nền tảng
   * đối với trợ lý tự động.
   */
  let text = params.text;
  /*
   * Gỡ markdown ở đây — chốt chặn cuối trước khi chữ rời hệ thống.
   *
   * Mọi tin nhắn gửi khách đều đi qua hàm này, nên đặt ở đây là không đường nào
   * lọt. Dặn trong lời nhắc vẫn cần, nhưng lời nhắc chỉ là lời khuyên: model
   * quên lúc nào không ai biết, còn khách thì đọc thấy nguyên dấu sao.
   */
  text = boMarkdown(text);

  if (decision.needsDisclosure && decision.disclosureText) {
    text = `${decision.disclosureText}\n\n${text}`;
  }

  /*
   * CHỐNG GỬI LẶP: lần gửi của LẦN KHỞI ĐỘNG TRƯỚC còn dở trong hội thoại này (máy chủ bị cắt giữa "đã gửi" và "đã ghi")
   * → đối chiếu với nhà cung cấp trước khi gửi. Cùng mã kích hoạt: đã đi thì coi như đã gửi (trả đúng tin đã đi); chưa
   * rõ thì KHÔNG gửi, để người xem; không có gì thì gửi bình thường.
   */
  const doiChieu = await doiChieuLanBoDo(params.conversationId, conversation.ma_luong, kenhGui);
  const cungYDinh = params.maKichHoat ? doiChieu.find((x) => x.maKichHoat === params.maKichHoat) : undefined;
  if (cungYDinh?.ket.ket === "da_gui") {
    console.log(`[chống gửi lặp] ${params.conversationId}: tin của lần khởi động trước ĐÃ tới khách — không gửi lại`);
    return { sent: true, text: cungYDinh.ket.noiDung, externalId: cungYDinh.ket.id };
  }
  if (cungYDinh?.ket.ket === "chua_ro") {
    console.log(`[chống gửi lặp] ${params.conversationId}: chưa rõ lần gửi trước — để người xem, không gửi`);
    return { sent: false, text, externalId: null, blockReason: "chua_ro", blockMessage: LOI_CHUA_RO_TIN };
  }

  const attemptId = await recordAttempt({
    userId: conversation.user_id,
    trangId: conversation.trang_id,
    socialAccountId: conversation.social_account_id,
    conversationId: params.conversationId,
    actor: params.actor,
    decision: "allowed",
    messageTag: decision.messageTag,
    outcome: "pending",
    maKhoiDong: MA_KHOI_DONG,
    maKichHoat: params.maKichHoat ?? null,
    noiDungBam: bamNoiDung(text),
  });

  try {
    const sent = await zernio.sendMessage({
      // Nhà cung cấp chỉ biết MÃ LUỒNG — mã dòng trong app có thể mang hậu tố nhiệm kỳ (services/nhiem-ky.ts).
      conversationId: conversation.ma_luong,
      accountId: kenhGui,
      text,
      messageTag: decision.messageTag as zernio.MessageTag | undefined,
    });

    await markAttemptOutcome(attemptId, "sent");

    if (decision.needsDisclosure) {
      await markDisclosureSent(params.conversationId);
    }

    return {
      sent: true,
      text,
      externalId: typeof sent?.id === "string" ? sent.id : null,
      messageTag: decision.messageTag,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof zernio.ZernioError ? (error.code ?? String(error.status)) : "unknown";

    await markAttemptOutcome(attemptId, "failed", code);

    // Facebook chặn Fanpage gửi tin (TD-36): ngắt AI của kênh TRƯỚC khi trả về — lượt nhường người / câu giữ chỗ phía sau
    // (actor ai) bị HÀNG RÀO 6 chặn ở cổng, không gửi thêm tin chắc chắn hỏng.
    if (conversation.social_account_id && laKenhBiChanGui(error)) {
      await ngatKenhBiChanGui({ socialAccountId: conversation.social_account_id, loi: message }).catch((e) =>
        console.error("[hàng rào] Không ngắt được kênh bị chặn:", e instanceof Error ? e.message : e)
      );
    }

    // Gửi lỗi có thể là dấu hiệu Trang đang bị hạn chế. Xét ngắt AI ngay.
    if (conversation.social_account_id) {
      await evaluateAutoPause({
        userId: conversation.user_id,
        trangId: conversation.trang_id,
        socialAccountId: conversation.social_account_id,
      }).catch(() => {});
    }

    console.error(
      `[gửi tin] Thất bại trong ${params.conversationId} (${params.actor}): ${message}`
    );

    if (params.throwOnBlock) throw error;

    /*
     * 429 và 5xx: Zernio/Facebook từ chối xử lý, tin chắc chắn chưa đi.
     * status 0: không gọi được tới nơi (mạng, hết giờ chờ) — tin RẤT có thể
     *   chưa đi, và nếu lỡ đã đi thì tầng chống lặp sẽ thấy tin của AI trong
     *   lịch sử ở lượt thử sau mà dừng lại.
     * 4xx còn lại: sai dứt khoát, thử lại vô ích.
     */
    const retryable =
      error instanceof zernio.ZernioError
        ? error.status === 0 || error.status === 429 || error.status >= 500
        : true;

    return {
      sent: false,
      text,
      externalId: null,
      blockReason: "send_failed",
      blockMessage: message,
      retryable,
    };
  }
}

/**
 * Cập nhật mốc tin cuối của khách.
 *
 * Mốc này là cơ sở tính cả cửa sổ 24 giờ và 7 ngày, nên phải được cập nhật ở
 * đúng một chỗ và chỉ khi KHÁCH gửi tin — shop gửi thì mốc không đổi.
 */
export async function touchCustomerMessage(
  conversationId: string,
  at: Date
): Promise<void> {
  await query(
    `UPDATE conversations
        SET last_customer_message_at = GREATEST(
              COALESCE(last_customer_message_at, $2::timestamptz), $2::timestamptz),
            updated_at = now()
      WHERE id = $1`,
    [conversationId, at]
  );
}

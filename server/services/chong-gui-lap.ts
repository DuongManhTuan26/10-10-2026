/**
 * CHỐNG GỬI LẶP SAU KHI BỊ CẮT (23/10/2026; phiên kiểm duyệt duyệt thiết kế + 3 sửa).
 *
 * Tin Messenger và câu trả lời công khai GỬI RA NGOÀI trước rồi mới GHI DB. Máy chủ bị cắt đúng giữa hai bước (khởi động
 * lại khi một việc còn dở) thì lượt sau không biết đã gửi → gửi lần hai. Nay:
 *  - mỗi lần gửi ghi trước MÃ LẦN KHỞI ĐỘNG (không dùng ngưỡng thời gian: một việc worker được chạy tới 2 phút, lần gửi
 *    "cũ" vẫn có thể đang chạy) — lần gửi còn dở mang mã KHÁC mã hiện tại chắc chắn là bị bỏ dở;
 *  - lần bị bỏ dở được ĐỐI CHIẾU với nhà cung cấp (lệnh đọc, có phạm vi): thấy đúng tin đã đi → coi là đã gửi; có tin
 *    khác của trang sau mốc (nhà cung cấp đổi chữ / nhân viên vừa trả lời tay) → CHƯA RÕ, để người xem; không có gì →
 *    gửi lại (khách không bị bỏ rơi);
 *  - "cùng ý định" theo MÃ KÍCH HOẠT có căn cứ (tin khách mà AI đang trả lời), không đoán theo nội dung.
 */
import crypto from "node:crypto";

/** Mã của lần khởi động này — mọi lần gửi ghi kèm. */
export const MA_KHOI_DONG = `${Date.now().toString(36)}-${process.pid}`;

/** Băm nội dung sau khi bỏ khoảng trắng thừa (nhà cung cấp có thể chuẩn hoá khoảng trắng). */
export function bamNoiDung(text: string): string {
  return crypto.createHash("sha256").update(text.trim().replace(/\s+/g, " ")).digest("hex");
}

/** Đồng hồ hai phía lệch nhau: tin của nhà cung cấp có thể mang giờ sớm hơn mốc ghi của mình vài chục giây. */
export const LECH_DONG_HO_MS = 60_000;

export type KetDoiChieu = { ket: "da_gui"; id: string | null; noiDung: string } | { ket: "chua_ro" } | { ket: "gui_lai" };

/**
 * Quyết định cho MỘT lần gửi bị bỏ dở — hàm thuần.
 * tin: tin / câu trả lời CỦA TRANG lấy từ nhà cung cấp (đã lọc chiều ra).
 */
export function quyetDinhDoiChieu(
  lan: { bam: string; luc: Date },
  tin: { id?: string | null; noiDung: string; luc: Date }[]
): KetDoiChieu {
  const sauMoc = tin.filter((t) => Number.isFinite(t.luc.getTime()) && t.luc.getTime() >= lan.luc.getTime() - LECH_DONG_HO_MS);
  const trung = sauMoc.find((t) => bamNoiDung(t.noiDung) === lan.bam);
  if (trung) return { ket: "da_gui", id: trung.id ?? null, noiDung: trung.noiDung };
  if (sauMoc.length > 0) return { ket: "chua_ro" };
  return { ket: "gui_lai" };
}

export const LOI_CHUA_RO_TIN =
  "Chưa rõ AI đã trả lời khách chưa (máy chủ khởi động lại đúng lúc gửi). Vui lòng xem hội thoại rồi trả lời tay nếu cần.";
export const LOI_CHUA_RO_CONG_KHAI =
  "Chưa rõ đã trả lời công khai bình luận này chưa (máy chủ khởi động lại đúng lúc gửi). Vui lòng xem bài rồi trả lời tay nếu cần.";

/**
 * Tin CỦA TRANG trong danh sách tin nhà cung cấp trả (GET /inbox/conversations/{id}/messages) — đọc đúng như reconcile.ts:
 * chiều theo `direction` ("outgoing" = trang gửi; kiểm chứng bằng dữ liệu thật), chữ ở message / text, giờ ở
 * createdAt / sentAt / createdTime.
 */
export function tinCuaTrang(ds: Array<Record<string, unknown>>): { id: string | null; noiDung: string; luc: Date }[] {
  return ds
    .filter((m) => m.direction === "outgoing")
    .map((m) => ({
      id: typeof m.id === "string" ? m.id : null,
      noiDung: String(m.message ?? m.text ?? ""),
      luc: new Date(String(m.createdAt ?? m.sentAt ?? m.createdTime ?? "")),
    }));
}

/**
 * Câu trả lời CỦA TRANG dưới một bình luận (GET /v1/inbox/comments/{commentId}?accountId — tài liệu: "a comment ID is
 * also accepted here and returns that comment's replies"). Trang nhận ra bằng from.isOwner; gộp cả replies[] lồng nhau.
 */
export function traLoiCuaTrang(ds: Array<Record<string, unknown>>): { id: string | null; noiDung: string; luc: Date }[] {
  const phang = ds.flatMap((x) => [x, ...((Array.isArray(x.replies) ? x.replies : []) as Array<Record<string, unknown>>)]);
  return phang
    .filter((x) => (x.from as { isOwner?: unknown } | undefined)?.isOwner === true)
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : null,
      noiDung: String(x.message ?? ""),
      luc: new Date(String(x.createdTime ?? "")),
    }));
}

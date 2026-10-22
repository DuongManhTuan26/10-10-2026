/**
 * SỰ CỐ HẠ TẦNG + CHẶN BÁO LẶP SỐNG QUA KHỞI ĐỘNG LẠI (22/10/2026; phiên kiểm duyệt duyệt thiết kế).
 *
 * Vì sao: bộ chặn lặp cũ nằm trong BỘ NHỚ (worker.ts lanBaoWebhookChet, lanBaoUngDong) — mỗi lần máy chủ khởi động lại
 * (tsx nạp lại khi lưu tệp, gộp nhánh…) là về 0 → báo lại ngay: 165 tin "TIN NHẮN VÀ BÌNH LUẬN KHÔNG VỀ ĐƯỢC" tới 19/10, và
 * gửi cho MỌI chủ shop (khách thuê) một sự cố hạ tầng họ không làm gì được.
 *
 * Trạng thái lưu ở cai_dat_he_thong:
 *  - 'su_co_webhook'      = { batDau, lanBao } — sự cố NHÀ CUNG CẤP KHÔNG GIAO ĐƯỢC TIN (webhook hỏng). Chỉ ADMIN nhận.
 *    Khác hẳn sự cố "MÁY CHỦ TRONG MÁY ĐANG TẮT" do người canh đường hầm báo (scripts/nguoi-canh-luat.mjs): lúc đó máy chủ
 *    tắt nên worker này không chạy được; câu chữ hai tin phân biệt rõ.
 *  - 'bao_hang_doi_ket'   = { [userId]: mốc báo } — tin của CHÍNH khách shop chờ quá lâu (chủ shop trả lời tay được).
 */
import { query, queryOne } from "../db.js";

export interface SuCoWebhook {
  batDau: string;
  lanBao: string;
}

export const NHAC_SU_CO_MS = 6 * 60 * 60_000;

/**
 * Một bước của sự cố webhook — hàm thuần.
 *  - hong: MỌI lần giao gần nhất đều 'failed' (nhật ký giao của nhà cung cấp).
 *  - coThanhCongSau(iso): có lần giao 'success' THẬT sau mốc đó (tài liệu: status ∈ {success, failed}). "Không thấy hỏng"
 *    (nhật ký trống, đọc lỗi) KHÔNG phải hồi phục — chỉ một lần giao thành công thật mới đóng sự cố.
 */
export function buocSuCoWebhook(
  dangCo: SuCoWebhook | null,
  p: { hong: boolean; coThanhCongSau: (iso: string) => boolean },
  bayGio: Date
): { moi: SuCoWebhook | null; gui: null | "bat_dau" | "nhac" | "hoi_phuc" } {
  const luc = bayGio.toISOString();
  if (p.hong) {
    if (!dangCo) return { moi: { batDau: luc, lanBao: luc }, gui: "bat_dau" };
    if (bayGio.getTime() - new Date(dangCo.lanBao).getTime() >= NHAC_SU_CO_MS) return { moi: { ...dangCo, lanBao: luc }, gui: "nhac" };
    return { moi: dangCo, gui: null };
  }
  if (dangCo && p.coThanhCongSau(dangCo.batDau)) return { moi: null, gui: "hoi_phuc" };
  return { moi: dangCo, gui: null };
}

const phut = (ms: number) => Math.max(1, Math.round(ms / 60_000));
const khoangThoiGian = (ms: number) => (ms >= 2 * 3_600_000 ? `${Math.round(ms / 3_600_000)} giờ` : `${phut(ms)} phút`);

/** Câu báo admin cho từng bước (đều nói rõ: máy chủ VẪN CHẠY — khác tin "máy chủ đang tắt" của người canh). */
export function cauSuCoWebhook(gui: "bat_dau" | "nhac" | "hoi_phuc", suCo: SuCoWebhook, bayGio: Date, lyDo: string): string {
  const dai = bayGio.getTime() - new Date(suCo.batDau).getTime();
  if (gui === "hoi_phuc") {
    return `✅ <b>NHÀ CUNG CẤP ĐÃ GIAO TIN VỀ LẠI</b>\n\nSự cố webhook kéo dài ${khoangThoiGian(dai)} đã hết (có lần giao thành công thật).`;
  }
  return (
    `⚠️ <b>${gui === "nhac" ? `WEBHOOK VẪN HỎNG (${khoangThoiGian(dai)})` : "SỰ CỐ: NHÀ CUNG CẤP KHÔNG GIAO ĐƯỢC TIN VỀ"}</b>\n\n` +
    "Máy chủ VẪN CHẠY, nhưng mọi lần nhà cung cấp giao tin / bình luận về gần đây đều hỏng" +
    (lyDo ? ` (${lyDo})` : "") +
    ". Hệ thống đang tự sửa và quét bù mỗi phút nên tin vẫn về, chỉ chậm hơn.\n" +
    "Hết sự cố sẽ có một tin báo. Chủ shop không nhận tin này."
  );
}

export async function docSuCoWebhook(): Promise<SuCoWebhook | null> {
  const r = await queryOne<{ gia_tri: SuCoWebhook | null }>("SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = 'su_co_webhook'");
  return r?.gia_tri && typeof r.gia_tri === "object" && "batDau" in r.gia_tri ? r.gia_tri : null;
}

export async function ghiSuCoWebhook(suCo: SuCoWebhook | null): Promise<void> {
  await query(
    `INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('su_co_webhook', $1::jsonb)
     ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri, updated_at = now()`,
    [JSON.stringify(suCo)]
  );
}

export const BAO_HANG_DOI_KET_MS = 60 * 60_000;

/**
 * Xin quyền báo "tin của khách chờ quá lâu" cho một tài khoản: tối đa 1 lần / giờ, mốc lưu DB (sống qua khởi động lại).
 * Một câu cập nhật có điều kiện — hai lượt chạy cùng lúc không báo hai lần.
 */
export async function xinBaoHangDoiKet(userId: number, bayGio = Date.now()): Promise<boolean> {
  const r = await queryOne<{ ok: boolean }>(
    `INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ('bao_hang_doi_ket', jsonb_build_object($1::text, $2::bigint))
     ON CONFLICT (khoa) DO UPDATE SET gia_tri = cai_dat_he_thong.gia_tri || jsonb_build_object($1::text, $2::bigint), updated_at = now()
       WHERE COALESCE((cai_dat_he_thong.gia_tri ->> $1)::bigint, 0) <= $2 - $3
     RETURNING TRUE AS ok`,
    [String(userId), bayGio, BAO_HANG_DOI_KET_MS]
  );
  return !!r?.ok;
}

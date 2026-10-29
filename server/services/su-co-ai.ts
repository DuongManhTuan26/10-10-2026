/**
 * SỰ CỐ "AI BỊ CHẶN" — nhà cung cấp AI từ chối vì hết ngân sách / hết tiền (H19, 30/10/2026).
 *
 * Đã xảy ra 29–30/10/2026: workspace OpenRouter có ngân sách trọn đời 22 USD; vượt là MỌI lệnh AI trả 403 "Workspace
 * lifetime budget of $22.00 exceeded … does not reset" — trong khi số dư (/credits) vẫn còn 7,42 USD nên cảnh báo chi phí
 * theo số dư (chi-phi.ts) không thấy gì. App chỉ dịch câu lỗi (loi-ncc.ts), không báo ai; phát hiện tình cờ lúc vẽ ảnh thử.
 *
 * Một điểm gắn: loiNhaCungCap (mọi lệnh gọi nhà cung cấp AI đi qua) gặp laHetTienAi → ghi sự cố + báo Telegram quản trị
 * (chống lặp 1 giờ, sống qua khởi động lại, an toàn nhiều tiến trình). Sự cố hiện trong cảnh báo "Chi phí hệ thống" tới khi
 * một lệnh AI thành công (sổ ai_usage, không lỗi) → xoá sự cố + báo "AI đã chạy lại".
 */
import { query, queryOne } from "../db.js";

export const KHOA_SU_CO_AI = "su_co_ai";
export const BAO_LAI_SAU_MS = 60 * 60_000;

export interface SuCoAi {
  batDau: string;
  chiTiet: string;
  baoLuc: string;
}

/** Chi tiết lỗi đưa vào tin quản trị: bỏ đường dẫn, gộp khoảng trắng, tối đa 200 ký tự (giữ số tiền — biết vượt bao nhiêu). */
export function locChiTietLoi(message: string): string {
  return message.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function cauBaoAiBiChan(chiTiet: string): string {
  return (
    "🔴 <b>AI ĐANG BỊ CHẶN</b>\n\n" +
    "Nhà cung cấp AI báo hết ngân sách / hết tiền. Mọi việc AI (trả lời tin, viết bài, ảnh, video, ④ Điều hành) đang dừng " +
    "tới khi nâng ngân sách nhóm làm việc hoặc nạp thêm ở trang nhà cung cấp AI.\n" +
    (chiTiet ? `Chi tiết: ${chiTiet}\n` : "") +
    "Khi AI chạy lại sẽ có một tin báo."
  );
}

export function cauAiChayLai(batDau: string): string {
  return `✅ <b>AI đã chạy lại</b> (bị chặn từ ${new Date(batDau).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}).`;
}

/**
 * Ghi sự cố (lần đầu tạo; đã có thì giữ batDau) và GIÀNH quyền báo: true khi chưa báo hoặc lần báo trước đã quá 1 giờ.
 * MỘT câu có điều kiện — hai lượt cùng lúc không báo hai lần. Sự cố luôn được ghi, kể cả khi sau đó gửi Telegram hỏng.
 */
export const GHI_SU_CO_AI = `
  INSERT INTO cai_dat_he_thong (khoa, gia_tri)
  VALUES ('${KHOA_SU_CO_AI}', jsonb_build_object('batDau', $1::text, 'chiTiet', $2::text, 'baoLuc', $1::text))
  ON CONFLICT (khoa) DO UPDATE
     SET gia_tri = cai_dat_he_thong.gia_tri || jsonb_build_object('chiTiet', $2::text, 'baoLuc', $1::text), updated_at = now()
   WHERE (cai_dat_he_thong.gia_tri ->> 'baoLuc') IS NULL
      OR (cai_dat_he_thong.gia_tri ->> 'baoLuc')::timestamptz <= $1::timestamptz - make_interval(secs => $3::double precision / 1000)
  RETURNING TRUE AS ok`;

export async function docSuCoAi(): Promise<SuCoAi | null> {
  const r = await queryOne<{ gia_tri: SuCoAi | null }>(`SELECT gia_tri FROM cai_dat_he_thong WHERE khoa = '${KHOA_SU_CO_AI}'`);
  return r?.gia_tri && typeof r.gia_tri === "object" && "batDau" in r.gia_tri ? r.gia_tri : null;
}

/** Gửi một tin cho mọi quản trị (kind "chi_phi" — chỉ quản trị). true = ít nhất một người nhận. */
async function guiQuanTri(noiDung: string): Promise<boolean> {
  const { sendTelegramMessage } = await import("./telegram.js");
  const admins = await query<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
  let da = 0;
  for (const a of admins.rows) if (await sendTelegramMessage(a.id, noiDung, "chi_phi").catch(() => false)) da++;
  return da > 0;
}

/** Có thể còn sự cố chưa xoá (mặc định true: sau khởi động lại phải đọc DB một lần) — tránh hỏi DB mỗi lượt AI thành công. */
let coTheCoSuCo = true;

export async function baoHetTienAi(message: string, gui: (noiDung: string) => Promise<boolean> = guiQuanTri, bayGio = new Date()): Promise<void> {
  const chiTiet = locChiTietLoi(message);
  coTheCoSuCo = true;
  const r = await queryOne<{ ok: boolean }>(GHI_SU_CO_AI, [bayGio.toISOString(), chiTiet, BAO_LAI_SAU_MS]);
  console.error(`[AI bị chặn] ${chiTiet}`);
  if (!r?.ok) return;
  if (!(await gui(cauBaoAiBiChan(chiTiet)).catch(() => false))) {
    console.error("[AI bị chặn] Không gửi được Telegram cho quản trị — sự cố vẫn hiện ở Chi phí hệ thống.");
  }
}

/** Gọi sau mỗi lượt AI THÀNH CÔNG: có sự cố thì xoá + báo "đã chạy lại". */
export async function aiChayLaiNeuCoSuCo(gui: (noiDung: string) => Promise<boolean> = guiQuanTri): Promise<void> {
  if (!coTheCoSuCo) return;
  coTheCoSuCo = false;
  const r = await queryOne<{ gia_tri: SuCoAi }>(`DELETE FROM cai_dat_he_thong WHERE khoa = '${KHOA_SU_CO_AI}' RETURNING gia_tri`);
  if (r?.gia_tri?.batDau) await gui(cauAiChayLai(r.gia_tri.batDau)).catch(() => false);
}

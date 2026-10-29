/**
 * Sổ AI: mỗi lượt nhà cung cấp trừ tiền là một dòng, gắn đúng tài khoản và
 * đúng tính năng.
 *
 * Vì sao phải chặt: sổ này là căn cứ để tính tiền từng tài khoản (tài khoản
 * tổng và từng tài khoản con, độc lập nhau), nên phải khớp tuyệt đối với số
 * nhà cung cấp trừ. Đã đo ngày 01/10/2026: sổ ghi 1,53 USD, nhà cung cấp trừ
 * 2,66 USD, và không truy được lệch ở đâu vì sổ không lưu mã giao dịch.
 *
 * Quy tắc:
 *   - Ghi ngay khi nhà cung cấp báo đã tính tiền, TRƯỚC mọi bước có thể hỏng
 *     phía sau (lưu kho, đọc JSON...). Hỏng sau đó vẫn là tiền đã mất.
 *   - Lượt bị tính tiền mà hỏng vẫn ghi, kèm lý do ở cột loi.
 *   - Luôn lưu mã giao dịch để tra lại đúng lượt đó với nhà cung cấp.
 */

import { query } from "../db.js";
import { env } from "../env.js";
import { trangChoSo } from "./ngu-canh-trang.js";

/** Nhóm hiện ở dòng chính của sao kê. */
export const NHOM_VIEC = {
  ban_hang: "Chatbot bán hàng",
  marketing: "Marketing",
  phan_tich: "Phân tích",
  anh: "Tạo ảnh",
  video: "Tạo video",
  day_ai: "Dạy AI",
} as const;

export type NhomViec = keyof typeof NHOM_VIEC;

/** Từng tính năng gọi AI. Thêm tính năng mới mà không khai ở đây thì không biên dịch được. */
export const VIEC = {
  tra_loi_khach: { ten: "Trả lời khách", nhom: "ban_hang" },
  goi_y_tra_loi: { ten: "Gợi ý câu trả lời", nhom: "ban_hang" },
  nhac_khach: { ten: "Nhắn nhắc khách", nhom: "ban_hang" },
  boc_don: { ten: "Bóc tách đơn hàng", nhom: "ban_hang" },
  doc_tep_khach: { ten: "Đọc ảnh, tệp khách gửi", nhom: "ban_hang" },
  viet_bai: { ten: "Viết bài", nhom: "marketing" },
  viet_bai_tu_dong: { ten: "Viết bài tự động theo lịch", nhom: "marketing" },
  phan_tich_qc: { ten: "Phân tích quảng cáo", nhom: "phan_tich" },
  phan_tich_so_lieu: { ten: "Phân tích số liệu bán hàng", nhom: "phan_tich" },
  dieu_hanh_chan_doan: { ten: "AI điều hành: chẩn đoán và đề xuất", nhom: "phan_tich" },
  dieu_hanh_kiem: { ten: "AI điều hành: kiểm chéo", nhom: "phan_tich" },
  tao_anh: { ten: "Tạo ảnh", nhom: "anh" },
  tao_anh_tu_dong: { ten: "Tạo ảnh tự động theo lịch đăng", nhom: "anh" },
  tao_video: { ten: "Tạo video", nhom: "video" },
  tao_canh_video_dai: { ten: "Tạo cảnh của video dài", nhom: "video" },
  sua_video: { ten: "Sửa video", nhom: "video" },
  mo_ta_video: { ten: "Viết lời mô tả video", nhom: "video" },
  chia_canh: { ten: "Chia cảnh video dài", nhom: "video" },
  phan_tich_trend: { ten: "Phân tích video trend", nhom: "video" },
  khung_video: { ten: "Vẽ khung mở đầu cảnh video", nhom: "video" },
  giong_doc: { ten: "Giọng đọc AI", nhom: "video" },
  nhac_nen: { ten: "Nhạc nền AI", nhom: "video" },
  nghe_kiem_tra: { ten: "Nghe kiểm tra giọng đọc", nhom: "video" },
  kiem_dinh_video: { ten: "Kiểm định cảnh video", nhom: "video" },
  doc_tai_lieu: { ten: "Đọc tài liệu dạy AI", nhom: "day_ai" },
  thu_ai: { ten: "Chạy thử AI khi dạy", nhom: "day_ai" },
} as const satisfies Record<string, { ten: string; nhom: NhomViec }>;

export type Viec = keyof typeof VIEC;

/** Dòng cũ (trước khi ghi theo tính năng) không đoán bừa — gọi đúng tên của nó. */
export const TEN_CHUA_PHAN_LOAI = "Chưa phân loại (ghi trước 01/10/2026)";

export function tenViec(viec: string | null): string {
  return viec && viec in VIEC ? VIEC[viec as Viec].ten : TEN_CHUA_PHAN_LOAI;
}

export function nhomCua(viec: string | null): string {
  return viec && viec in VIEC ? NHOM_VIEC[VIEC[viec as Viec].nhom] : TEN_CHUA_PHAN_LOAI;
}

export interface LuotAi {
  userId: number | null;
  /** Cột task cũ, giữ để các truy vấn cũ vẫn đúng. */
  task: string;
  viec: Viec;
  model: string;
  /** Mã giao dịch nhà cung cấp trả về — để tra lại đúng lượt này. */
  maNcc: string | null;
  promptTokens?: number;
  completionTokens?: number;
  costUsd: number;
  /** Bị tính tiền nhưng hỏng: ghi lý do. */
  loi?: string | null;
  /** Trang được tính tiền. Bỏ trống = lấy "Trang đang làm việc" (ngu-canh-trang.ts). */
  trangId?: number | null;
}

/**
 * Ghi một lượt. Trùng mã giao dịch thì bỏ qua (gọi lại không được tính hai lần).
 *
 * Ghi hỏng thì chỉ báo log, KHÔNG ném lỗi: khách đang chờ câu trả lời, không
 * thể vì một dòng thống kê mà để họ chờ tiếp. Lượt lọt sổ kiểu này vẫn lộ ra ở
 * phần đối chiếu tổng với nhà cung cấp.
 */
export async function ghiLuotAi(l: LuotAi): Promise<void> {
  const trangId = l.trangId !== undefined ? l.trangId : await trangChoSo();
  await query(
    // Trang phải thuộc đúng tài khoản được tính tiền — không bao giờ ghi tiền sang trang của người khác.
    `INSERT INTO ai_usage (user_id, task, viec, model, ma_ncc, prompt_tokens, completion_tokens, cost_usd, loi, trang_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT id FROM trang WHERE id = $10 AND user_id = $1))
     ON CONFLICT (ma_ncc) WHERE ma_ncc IS NOT NULL DO NOTHING`,
    [
      l.userId,
      l.task,
      l.viec,
      l.model,
      l.maNcc,
      l.promptTokens ?? 0,
      l.completionTokens ?? 0,
      Number.isFinite(l.costUsd) ? l.costUsd : 0,
      l.loi ?? null,
      trangId,
    ]
  ).catch((error) => console.error("[sổ AI] Không ghi được lượt AI:", error));
  // H19: lượt AI THÀNH CÔNG → nếu đang có sự cố "AI bị chặn" thì xoá + báo "AI đã chạy lại" (máy chủ đăng ký).
  if (!l.loi) {
    try {
      khiAiThanhCong?.();
    } catch {
      /* không làm hỏng việc ghi sổ */
    }
  }
}

let khiAiThanhCong: (() => void) | null = null;
export function datKhiAiThanhCong(fn: (() => void) | null): void {
  khiAiThanhCong = fn;
}

// ---------------------------------------------------------------------------
// Đối chiếu từng lượt với nhà cung cấp
// ---------------------------------------------------------------------------

const GOC_API = "https://openrouter.ai/api/v1";

/**
 * Nhà cung cấp chốt số CHẬM. Đã đo ngày 01/10/2026: tra một lượt chat ngay
 * sau khi gọi thì báo "không tìm thấy" suốt hơn 4 phút; 15 phút sau mới ra,
 * total_cost = 0,00000825 USD — đúng bằng số đã nhận lúc gọi, và tổng của khoá
 * tăng đúng chừng ấy. Nên chỉ tra lượt đã qua vài phút, chưa ra thì để lần sau.
 */
const CHO_TOI_THIEU = "3 minutes";

/** Đọc số tiền nhà cung cấp đã chốt cho một lượt. null = chưa chốt, để lần sau. */
async function traTienLuot(maNcc: string, laVideo: boolean): Promise<number | null> {
  const dau = { Authorization: `Bearer ${env.openrouter.apiKey}` };
  const url = laVideo
    ? `${GOC_API}/videos/${encodeURIComponent(maNcc)}`
    : `${GOC_API}/generation?id=${encodeURIComponent(maNcc)}`;
  const r = await fetch(url, { headers: dau, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (laVideo) {
    const tien = Number((j?.usage as Record<string, unknown> | undefined)?.cost);
    return Number.isFinite(tien) ? tien : null;
  }
  const tien = Number((j?.data as Record<string, unknown> | undefined)?.total_cost);
  return Number.isFinite(tien) ? tien : null;
}

/**
 * Tra lại các lượt chưa đối chiếu. Gọi định kỳ từ worker.
 * Trả về số lượt vừa đối chiếu xong.
 */
export async function doiChieuLuotAi(toiDa = 40): Promise<number> {
  if (!env.openrouter.apiKey) return 0;
  const cho = await query<{ id: string; ma_ncc: string; task: string }>(
    `SELECT id, ma_ncc, task FROM ai_usage
      WHERE ma_ncc IS NOT NULL AND doi_chieu_at IS NULL
        AND created_at < now() - interval '${CHO_TOI_THIEU}'
      ORDER BY tra_luc NULLS FIRST, created_at LIMIT $1`,
    [toiDa]
  );
  let xong = 0;
  for (const l of cho.rows) {
    const tien = await traTienLuot(l.ma_ncc, l.task === "video").catch(() => null);
    if (tien === null) {
      /*
       * Chưa ra số: xuống cuối hàng. Đã thấy: lấy lượt cũ nhất trước mà không
       * xoay vòng thì một lượt kẹt chặn mãi mọi lượt phía sau.
       */
      await query(`UPDATE ai_usage SET tra_luc = now(), so_lan_tra = so_lan_tra + 1 WHERE id = $1`, [l.id]);
      continue;
    }
    await query(
      `UPDATE ai_usage SET cost_ncc = $2, doi_chieu_at = now(), tra_luc = now(), so_lan_tra = so_lan_tra + 1 WHERE id = $1`,
      [l.id, tien]
    );
    xong++;
  }
  return xong;
}

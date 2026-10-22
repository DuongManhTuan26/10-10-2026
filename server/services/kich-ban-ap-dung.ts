/**
 * KỊCH BẢN ÁP DỤNG CHO BÀI NÀO — hàm thuần (không gọi database), để bộ kiểm tra thử hành vi bằng dữ liệu giả.
 *
 * Luật (mục 2, phiên kiểm duyệt duyệt 22/10/2026; migration 062):
 *  - 'all' = mọi bài của các kênh kịch bản chạy; 'specific' = CHỈ những bài trong bai_ap_dung (1–100 mã bài, đúng giá trị
 *    comments.platform_post_id). Bản cũ lưu chuỗi gì cũng được và bộ máy không đọc → kịch bản chạy ở MỌI bài.
 *  - Chọn bài cụ thể mới làm được cho Facebook: mã bài Instagram chưa đối chiếu được với bình luận thật (chưa có bình luận
 *    Instagram nào) — không giả định cùng định dạng.
 *  - Bài quảng cáo chưa chọn được (bình luận quảng cáo đi đường khác của nhà cung cấp).
 */
import { AppError } from "../http.js";

export const TOI_DA_BAI = 100;
export const LOI_CHUA_CHON_BAI = "Vui lòng chọn ít nhất một bài cho kịch bản này.";
export const LOI_QUA_NHIEU_BAI = `Mỗi kịch bản chọn tối đa ${TOI_DA_BAI} bài. Vui lòng bỏ bớt, hoặc chọn "Tất cả bài đăng".`;
export const LY_DO_KHONG_AP_BAI = "Không có kịch bản nào áp dụng cho bài này";

/** Đọc "áp dụng cho bài nào" từ thân yêu cầu. Thiếu applyTo → null (lệnh sửa không đụng tới). Sai → lỗi 400. */
export function docApDung(body: { applyTo?: unknown; baiApDung?: unknown }): { applyTo: "all" | "specific"; baiApDung: string[] } | null {
  if (body.applyTo === undefined) return null;
  if (body.applyTo === "all") return { applyTo: "all", baiApDung: [] };
  if (body.applyTo !== "specific") throw new AppError("Phạm vi áp dụng không hợp lệ", 400);
  const ds = Array.isArray(body.baiApDung) ? body.baiApDung : [];
  const bai = [...new Set(ds.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter(
    (x) => x !== "" && x.length <= 120
  );
  if (bai.length === 0) throw new AppError(LOI_CHUA_CHON_BAI, 400);
  if (bai.length > TOI_DA_BAI) throw new AppError(LOI_QUA_NHIEU_BAI, 400);
  return { applyTo: "specific", baiApDung: bai };
}

/** Kịch bản (đang bật, đúng cửa hàng + kênh) áp được cho bài có mã này. */
export function kichBanChoBai<T extends { apply_to: string; bai_ap_dung: string[] | null }>(ds: T[], maBai: string): T[] {
  return ds.filter((k) => k.apply_to === "all" || (k.apply_to === "specific" && (k.bai_ap_dung ?? []).includes(maBai)));
}

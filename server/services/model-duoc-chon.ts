/**
 * Danh sách mô hình AI được phép gọi — CHỌN THEO XẾP HẠNG, có bằng chứng.
 *
 * Quy tắc (chủ dự án đặt 02/10/2026): chỉ dùng mô hình xếp TOP ĐẦU ở từng phân
 * khúc giá — rẻ nhất thì chọn con đánh giá cao nhất trong nhóm rẻ, đắt nhất thì
 * con đánh giá cao nhất trong nhóm đắt — và mỗi mô hình gọi phải đúng tuyệt đối.
 *
 * Cách chọn: loại mọi mô hình VỪA ĐẮT HƠN VỪA KÉM HƠN một mô hình khác (theo cả
 * hai bảng video-từ-chữ và video-từ-ảnh). Còn lại là những con không ai hơn ở
 * mức giá của nó.
 *
 * Đã thấy trước khi có danh sách này: app hiện cả 30 mô hình nhà cung cấp liệt
 * kê, gồm Sora 2 Pro (OpenAI tắt API từ 24/09/2026 — chọn là hỏng), Seedance 1.5
 * Pro (hạng 27/35), và nhiều mô hình không có trên bảng xếp hạng nào.
 *
 * Nguồn xếp hạng: Artificial Analysis Video Arena (bỏ phiếu mù của người thật),
 * đo ngày 02/10/2026. Cập nhật danh sách khi bảng xếp hạng đổi.
 */

export const NGUON_XEP_HANG = "Artificial Analysis Video Arena, đo 02/10/2026";

export interface ModelDuocChon {
  id: string;
  phanKhuc: string;
  xepHang: string;
}

/** Tạo video. Cả ba đều nhận ảnh khung mở đầu (cần cho nối cảnh video dài). */
export const MODEL_VIDEO_DUOC_CHON: ModelDuocChon[] = [
  // 0,05–0,08 USD/giây. Rẻ nhất mà hạng 1 video-từ-ảnh. Không có tiếng.
  { id: "minimax/hailuo-3-max", phanKhuc: "Tiết kiệm", xepHang: "Hạng 1 video từ ảnh · hạng 5 video từ chữ" },
  // 0,05–0,20 USD/giây (480p–1080p). Hạng 1 video-từ-chữ, có tiếng, dài tới 30 giây.
  { id: "alibaba/wan-3.0", phanKhuc: "Cân bằng", xepHang: "Hạng 1 video từ chữ · hạng 6 video từ ảnh" },
  // 0,13 USD/giây, 2K, có tiếng. Hạng 2 video-từ-ảnh.
  { id: "minimax/hailuo-3", phanKhuc: "Cao cấp · 2K", xepHang: "Hạng 2 video từ ảnh · hạng 4 video từ chữ" },
];

/**
 * Sửa video (đưa video vào, ra video đã sửa).
 *
 * Bảng xếp hạng sửa video: Wan 3.0 hạng 1 nhưng qua nhà cung cấp của mình nó
 * TỪ CHỐI video đầu vào (đã thử 02/10/2026: "does not accept video input
 * references"). MiniMax H3 hạng 2 — đã thử thật: đổi màu chiếc ly, giữ nguyên
 * bố cục/hơi nước/nền. Runway Aleph 2 hạng 7 và đắt gấp đôi → loại. FLUX Video
 * Edit không có trên bảng → loại.
 */
export const MODEL_SUA_VIDEO_DUOC_CHON: ModelDuocChon[] = [
  { id: "minimax/hailuo-3", phanKhuc: "Tốt nhất gọi được", xepHang: "Hạng 2 sửa video" },
];

export function thongTinChon(ds: ModelDuocChon[], id: string): ModelDuocChon | undefined {
  return ds.find((m) => m.id === id);
}

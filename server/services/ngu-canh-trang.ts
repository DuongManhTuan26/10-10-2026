import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "../http.js";
import { layTrangTuKenh } from "./trang.js";

/**
 * "Đang làm việc cho Trang nào" — để sổ AI ghi được tiền của TỪNG TRANG.
 *
 * Vì sao giữ ở đây thay vì truyền tay qua từng lời gọi AI: có hơn 20 chỗ gọi AI, sửa từng chỗ thì chỉ cần một chỗ
 * quên là tiền của trang đó lọt sang "chưa rõ trang" mà không ai biết. Thay vào đó đặt Trang ở các ĐIỂM VÀO
 * (mỗi yêu cầu từ màn hình, mỗi việc chạy nền: tin khách, bình luận, lịch đăng, video) — sổ AI tự đọc.
 *
 * Không có Trang (vd. tài khoản quản lý chuỗi tự thử AI) thì để trống: màn hình ghi rõ "không thuộc trang nào".
 */
// Giữ CÁCH TÌM Trang chứ không tìm sẵn: phần lớn yêu cầu không gọi AI, tìm trước là thêm một lượt đọc database
// cho mọi yêu cầu. Chỉ tìm khi sổ AI thật sự cần ghi.
const kho = new AsyncLocalStorage<{ lay: () => Promise<number | null> }>();

export function chayChoTrang<T>(trangId: number | null, viec: () => T): T {
  return kho.run({ lay: async () => trangId }, viec);
}

/** Như chayChoTrang, nhưng suy Trang từ kênh (kênh nào thuộc Trang nấy). */
export function chayChoKenh<T>(kenhId: string | null | undefined, viec: () => T): T {
  return kho.run({ lay: async () => (kenhId ? await layTrangTuKenh(kenhId).catch(() => null) : null) }, viec);
}

/** Cách tìm Trang tuỳ ý (vd. yêu cầu từ màn hình: Trang đang chọn của người đăng nhập). */
export function chayVoiCachTim<T>(lay: () => Promise<number | null>, viec: () => T): T {
  return kho.run({ lay }, viec);
}

/**
 * Cửa hàng của việc đang chạy. Lỗi 409 "chưa chọn cửa hàng" của lớp giữa (yêu cầu GHI thiếu mã cửa hàng — A4a) được NÉM
 * ra cho route trả về; lỗi khác (vd. database) → null như trước.
 */
export async function trangHienTai(): Promise<number | null> {
  const ch = kho.getStore();
  return ch
    ? await ch.lay().catch((e) => {
        if (e instanceof AppError) throw e;
        return null;
      })
    : null;
}

/** Cho SỔ (tiền AI, nhật ký thay đổi): không bao giờ ném — sổ không được làm hỏng việc chính. */
export async function trangChoSo(): Promise<number | null> {
  return trangHienTai().catch(() => null);
}

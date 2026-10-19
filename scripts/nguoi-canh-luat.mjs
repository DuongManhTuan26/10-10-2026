/**
 * LUẬT QUYẾT ĐỊNH của người canh đường hầm (scripts/tunnel-watchdog.mjs) — hàm thuần, KHÔNG có tác dụng phụ, để bộ
 * kiểm tra gọi thử được mà không bật cloudflared.
 *
 * Vì sao (điều tra 19/10/2026, phiên kiểm duyệt duyệt): máy chủ trong máy bị tắt 11:28–12:44 → đường hầm trỏ vào chỗ
 * trống → người canh tưởng đường hầm hỏng, dựng lại ~30 lần → Cloudflare chặn tần suất (429 / 1015) → máy chủ sống lại
 * rồi mà webhook vẫn chết tới 13:21. Dựng lại đường hầm KHÔNG chữa được máy chủ tắt.
 */

/**
 * Một lượt kiểm: gốc (máy chủ trong máy) sống không, đường hầm thông không → làm gì.
 *  - "thong": đường hầm thông → đếm về 0 (người canh còn gỡ trạng thái ngắt gửi của nhà cung cấp).
 *  - "cho_goc": máy chủ trong máy đang tắt → GIỮ đường hầm, không đếm, không dựng lại (dựng lại vô ích, chỉ tốn lượt
 *    Cloudflare).
 *  - "an_han": đường hầm mới dựng chưa đủ 3 phút → "không thông" KHÔNG đếm (máy này cần ~80 giây mới phân giải được tên
 *    miền mới — đo 2 lần 19/10; đếm ngay thì 90 giây là dựng lại oan, rồi lại oan… đúng vòng làm Cloudflare chặn).
 *  - "dem": gốc sống mà đường hầm không thông → đếm, chưa đủ ngưỡng thì chờ xem lại.
 *  - "dung_lai": đủ ngưỡng liên tiếp → dựng đường hầm mới.
 */
export const AN_HAN_SAU_KHI_DUNG_MS = 3 * 60_000;
export function quyetDinh({ gocSong, duongHamThong, soLanKhongThong, nguong = 3, msTuLucDung = Infinity }) {
  if (duongHamThong) return { hanhDong: "thong", soLanKhongThong: 0 };
  if (!gocSong) return { hanhDong: "cho_goc", soLanKhongThong: 0 };
  if (msTuLucDung < AN_HAN_SAU_KHI_DUNG_MS) return { hanhDong: "an_han", soLanKhongThong: 0 };
  const dem = soLanKhongThong + 1;
  if (dem < nguong) return { hanhDong: "dem", soLanKhongThong: dem };
  return { hanhDong: "dung_lai", soLanKhongThong: 0 };
}

export const BAO_GOC_SAU_MS = 5 * 60_000;

/**
 * Báo admin qua Telegram khi máy chủ trong máy tắt quá 5 phút LIÊN TIẾP, và báo một lần nữa khi sống lại. Mỗi đợt tắt
 * chỉ báo MỘT lần, không lặp.
 *  trangThai: { chetTu: số ms | null, daBao: boolean } → { trangThai mới, gui: null | "tat" | "song" }
 */
export function baoGoc(trangThai, gocSong, bayGio, nguongMs = BAO_GOC_SAU_MS) {
  if (gocSong) {
    return { trangThai: { chetTu: null, daBao: false }, gui: trangThai.daBao ? "song" : null };
  }
  const chetTu = trangThai.chetTu ?? bayGio;
  if (!trangThai.daBao && bayGio - chetTu >= nguongMs) {
    return { trangThai: { chetTu, daBao: true }, gui: "tat" };
  }
  return { trangThai: { chetTu, daBao: trangThai.daBao }, gui: null };
}

export const TIN_GOC_TAT =
  "⚠️ <b>MÁY CHỦ TRONG MÁY ĐANG TẮT</b>\n\nKhách nhắn tin / bình luận sẽ KHÔNG có AI trả lời cho tới khi máy chủ chạy lại.\n" +
  'Vui lòng bấm "Mở app" trên Desktop.';
export const TIN_GOC_SONG = "✅ <b>Máy chủ đã chạy lại</b> — AI trả lời khách bình thường.";

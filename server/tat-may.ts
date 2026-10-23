/**
 * TẮT ÊM (TD-20, sửa 22/10/2026; phiên kiểm duyệt duyệt thiết kế mục 7).
 *
 * Trước: SIGTERM bật cờ dừng worker / Telegram rồi đóng pool ngay khi server.close xong — lượt worker đang dở vẫn gọi DB
 * → "Cannot use a pool after calling end on the pool"; server.close chờ kết nối giữ sống (WebSocket HMR của vite, keep-alive)
 * nên hay quá 5 giây → tsx watch buộc tắt ("Process didn't exit in 5s. Force killing").
 *
 * Nay: dừng worker + Telegram + máy chủ CÙNG LÚC, chờ tối đa HAN_TAT_MS. Worker đã dừng → đóng pool (không ai còn dùng).
 * Quá hạn mà worker còn việc dở (một việc có thể chạy tới 2 phút) → thoát KHÔNG đóng pool: Postgres tự huỷ giao dịch dở
 * khi kết nối đứt; sự kiện kẹt ở 'processing' được recoverStuckEvents nhận lại lúc khởi động.
 */

/**
 * 4 giây: dưới hạn 5 giây của tsx watch (môi trường đang chạy bằng scripts/mo-app.sh). Lên máy chủ thật / dịch vụ hệ
 * thống vẫn dùng cùng hằng số — hạn ngắn không làm mất gì (việc dở được nhận lại), chỉ tránh bị giết giữa chừng.
 */
export const HAN_TAT_MS = 4_000;

export async function tatEm(p: {
  dungWorker: () => Promise<void>;
  dungTelegram: () => Promise<void>;
  dongMayChu: () => Promise<void>;
  dongPool: () => Promise<void>;
  han?: number;
}): Promise<"sach" | "qua_han"> {
  let workerXong = false;
  const worker = p.dungWorker().then(() => {
    workerXong = true;
  });
  const conLai = Promise.allSettled([worker, p.dungTelegram(), p.dongMayChu()]);
  let hen: NodeJS.Timeout | undefined;
  await Promise.race([conLai, new Promise<void>((xong) => (hen = setTimeout(xong, p.han ?? HAN_TAT_MS)))]);
  clearTimeout(hen);
  if (!workerXong) return "qua_han";
  await p.dongPool().catch(() => {});
  return "sach";
}

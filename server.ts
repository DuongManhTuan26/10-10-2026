import { createApp, logStartupWarnings } from "./server/app.js";
import { env } from "./server/env.js";
import { verifyConnection, closePool } from "./server/db.js";
import { runMigrations } from "./server/migrate.js";
import { dangKyDiaChiWebhook } from "./server/services/zernio.js";
import { damBaoNguoiCanh, laDiaChiNoiBo, NHAT_KY_DUONG_HAM } from "./server/services/duong-ham.js";
import { donDuLieuHetHan } from "./server/auth.js";
import { startWorker, stopWorker, recoverStuckEvents } from "./server/worker.js";
import { datBaoHetTienAi } from "./server/services/loi-ncc.js";
import { datKhiAiThanhCong } from "./server/services/so-ai.js";
import { aiChayLaiNeuCoSuCo, baoHetTienAi } from "./server/services/su-co-ai.js";
import { tatEm, HAN_TAT_MS } from "./server/tat-may.js";
import {
  startTelegramPolling,
  stopTelegramPolling,
} from "./server/services/telegram.js";

/**
 * Điểm khởi động của hệ thống.
 *
 * Thứ tự có chủ đích: kiểm tra database trước, chạy migration, rồi mới mở cổng.
 * Server không bao giờ nhận request khi lược đồ chưa sẵn sàng.
 */
/**
 * Lưới an toàn cuối cùng.
 *
 * Mọi nguồn lỗi đã biết đều được xử lý tại chỗ. Hai handler này chỉ để
 * những lỗi ngoài dự kiến được ghi lại đầy đủ thay vì chết câm lặng, giúp
 * tìm nguyên nhân khi vận hành thật.
 */
function installCrashGuards(): void {
  // Promise lỗi không ai bắt: GHI rồi chạy tiếp, KHÔNG thoát (phiên kiểm duyệt chốt 23/10/2026) — một lời hứa lỗi lặt vặt
  // (vd. một lần gọi Telegram) mà thoát thì máy chủ bật lại liên tục dưới LaunchAgent, hại hơn lợi.
  process.on("unhandledRejection", (reason) => {
    console.error(
      "[nghiêm trọng] Promise bị từ chối mà không ai bắt:",
      reason instanceof Error ? (reason.stack ?? reason.message) : reason
    );
  });

  process.on("uncaughtException", (error) => {
    console.error("[nghiêm trọng] Lỗi không bắt được:", error.stack ?? error.message);
    // Tiến trình có thể đã ở trạng thái hỏng. Thoát để trình quản lý dịch vụ
    // khởi động lại sạch sẽ, thay vì chạy tiếp với dữ liệu không đáng tin.
    process.exit(1);
  });
}

async function main() {
  installCrashGuards();
  logStartupWarnings();

  console.log("[khởi động] Đang kiểm tra kết nối database…");
  await verifyConnection();

  console.log("[khởi động] Đang áp dụng migration…");
  await runMigrations();

  // Sự kiện kẹt ở 'processing' do lần chạy trước bị giết giữa chừng.
  await recoverStuckEvents();

  const app = await createApp();

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`[khởi động] Sẵn sàng tại http://localhost:${env.port}`);
  });

  /*
   * Tự đăng ký địa chỉ webhook của chính mình.
   *
   * Chỉ làm khi APP_URL là địa chỉ công khai https. Trên máy lập trình
   * (localhost) thì bỏ qua — ở đó đường hầm mới là địa chỉ đúng, và
   * scripts/tunnel-watchdog.mjs lo việc đăng ký.
   *
   * Không có bước này thì triển khai lên máy chủ thật là webhook chết ngay:
   * địa chỉ vẫn trỏ về đường hầm cũ của máy lập trình, mà không ai sửa hộ.
   * Đã đo hậu quả đúng tình huống đó: 0/100 lần giao thành công.
   *
   * Không chờ và không để lỗi làm chết khởi động: webhook hỏng thì hai lớp
   * quét bù vẫn kéo tin về, còn máy chủ không lên thì hỏng tất.
   */
  void (async () => {
    try {
      if (laDiaChiNoiBo(env.appUrl)) {
        /*
         * Trên máy: tự bật người canh đường hầm — nó dựng đường hầm công khai
         * và đăng ký webhook. Đã thấy: bật app mà quên bật người canh là
         * webhook chết, khách nhắn phải chờ vòng quét bù.
         */
        const tinhTrang = damBaoNguoiCanh();
        console.log(
          tinhTrang === "dang_chay"
            ? "[khởi động] Người canh đường hầm đang chạy — webhook nhận tin theo thời gian thực."
            : tinhTrang === "vua_bat"
              ? `[khởi động] Đã bật người canh đường hầm (nhật ký: ${NHAT_KY_DUONG_HAM}).`
              : `[khởi động] KHÔNG bật được đường hầm (${tinhTrang}) — webhook sẽ chết, tin chỉ về qua quét bù. ` +
                "Cài cloudflared và điền CLOUDFLARED_PATH trong .env."
        );
        return;
      }
      const diaChi = `${env.appUrl.replace(/\/$/, "")}/api/webhooks/zernio`;
      const kq = await dangKyDiaChiWebhook(diaChi);
      if (kq.doi) {
        console.log(`[khởi động] Đã đổi địa chỉ webhook: ${kq.cu} -> ${diaChi}`);
      } else {
        console.log(`[khởi động] Địa chỉ webhook đã đúng: ${diaChi}`);
      }
    } catch (error) {
      console.error(
        "[khởi động] Không đăng ký được địa chỉ webhook:",
        error instanceof Error ? error.message : error
      );
    }
  })();

  // H19: chỉ máy chủ thật mới ghi sự cố "AI bị chặn" + báo quản trị (bộ kiểm tra / kịch bản không đăng ký).
  datBaoHetTienAi((chiTiet) => void baoHetTienAi(chiTiet).catch((e) => console.error("[AI bị chặn] Không ghi được sự cố:", e)));
  datKhiAiThanhCong(() => void aiChayLaiNeuCoSuCo().catch(() => {}));
  startWorker();

  // Vòng lặp nhận lệnh /start của Telegram. Chạy song song, không chờ: đây là
  // vòng lặp vô hạn và không phải điều kiện để server phục vụ request.
  void startTelegramPolling().catch((error) =>
    console.error("[telegram] Vòng lặp liên kết dừng bất thường:", error)
  );

  // Dọn phiên hết hạn và bộ đếm chống dò mỗi giờ. unref() để tác vụ này không
  // giữ tiến trình sống.
  const sessionCleanup = setInterval(
    () => {
      donDuLieuHetHan().catch((error) =>
        console.error("[phiên] Dọn dẹp thất bại:", error)
      );
    },
    60 * 60 * 1_000
  );
  sessionCleanup.unref();

  // Tắt êm (server/tat-may.ts — TD-20): dừng worker / Telegram / máy chủ cùng lúc, chờ tối đa HAN_TAT_MS; pool chỉ
  // đóng khi worker đã thoát hẳn (không ai còn dùng).
  let dangTat = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      if (dangTat) return;
      dangTat = true;
      console.log(`\n[tắt] Nhận ${signal}, đang đóng…`);
      clearInterval(sessionCleanup);
      void tatEm({
        dungWorker: stopWorker,
        dungTelegram: stopTelegramPolling,
        dongMayChu: () =>
          new Promise<void>((xong) => {
            server.close(() => xong());
            // Kết nối giữ sống (WebSocket HMR, keep-alive) làm server.close chờ mãi — cắt luôn.
            server.closeAllConnections();
          }),
        dongPool: closePool,
      }).then((kq) => {
        if (kq === "qua_han") {
          console.log("[tắt] Worker còn việc dở — thoát không đóng pool; sự kiện kẹt được nhận lại lúc khởi động.");
        }
        process.exit(0);
      });
      // Lưới cuối: tatEm luôn xong trong HAN_TAT_MS, nhưng không để tiến trình treo vì bất cứ lý do gì.
      setTimeout(() => process.exit(1), HAN_TAT_MS + 500).unref();
    });
  }
}

main().catch((error) => {
  console.error(
    "\n[khởi động] THẤT BẠI:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});

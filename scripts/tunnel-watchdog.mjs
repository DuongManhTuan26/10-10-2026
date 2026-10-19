#!/usr/bin/env node
/**
 * Trông tunnel và tự phục hồi.
 *
 * Cloudflare quick tunnel (trycloudflare) không ổn định: tiến trình vẫn sống
 * nhưng đường dẫn ngừng hoạt động, với lỗi "control stream encountered a
 * failure while serving". Khi đó Zernio gửi webhook vào chỗ trống và tin nhắn
 * của khách biến mất không dấu vết — đã xảy ra ba lần trong quá trình thử.
 *
 * Script này kiểm tra định kỳ QUA tunnel (không phải localhost), và khi tunnel
 * chết thì tự dựng lại rồi cập nhật URL webhook bên Zernio.
 *
 * Đây là giải pháp tạm cho giai đoạn thử nghiệm. Khi triển khai thật, dùng
 * domain cố định và bỏ script này đi.
 *
 * Chạy: npm run tunnel
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import pg from "pg";
import { baoGoc, quyetDinh, TIN_GOC_SONG, TIN_GOC_TAT } from "./nguoi-canh-luat.mjs";

const CLOUDFLARED = process.env.CLOUDFLARED_PATH;
// 127.0.0.1, không "localhost": máy này phân giải localhost ra cả ::1, còn máy chủ chỉ nghe IPv4 (server.ts listen 0.0.0.0).
const LOCAL_URL = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const CHECK_INTERVAL_MS = 30_000;
const STATE_FILE = path.join(process.cwd(), ".tunnel-url");
const PID_FILE = path.join(process.cwd(), ".tunnel.pid");

if (!CLOUDFLARED || !fs.existsSync(CLOUDFLARED)) {
  console.error(
    "Thiếu CLOUDFLARED_PATH trong .env, hoặc đường dẫn không tồn tại.\n" +
      "Ví dụ: CLOUDFLARED_PATH=/usr/local/bin/cloudflared"
  );
  process.exit(1);
}

let child = null;
let currentUrl = null;

function log(message) {
  console.log(`[tunnel] ${new Date().toLocaleTimeString("vi-VN")} ${message}`);
}

/** Cập nhật URL webhook bên Zernio, giữ nguyên bí mật và danh sách sự kiện. */
async function updateZernioWebhook(url) {
  const key = process.env.ZERNIO_API_KEY;
  const base = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const list = await (await fetch(`${base}/webhooks/settings`, { headers })).json();
  const hook = list.webhooks?.[0];
  if (!hook) {
    log("Chưa có webhook nào đăng ký bên Zernio — bỏ qua bước cập nhật");
    return;
  }

  const response = await fetch(`${base}/webhooks/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      _id: hook._id,
      name: hook.name,
      url: `${url}/api/webhooks/zernio`,
      secret: hook.secret,
      events: hook.events,
      isActive: true,
    }),
  });

  log(
    response.ok
      ? `Đã trỏ webhook Zernio sang ${url}`
      : `Cập nhật webhook thất bại: HTTP ${response.status}`
  );

  // Bắt buộc: gỡ trạng thái ngắt của Zernio sau khi đổi URL.
  await clearSuppression();
}

/**
 * Gỡ trạng thái "Delivery suppressed" của Zernio.
 *
 * ĐÂY LÀ ĐIỂM QUAN TRỌNG NHẤT của script này.
 *
 * Zernio có cơ chế tự ngắt: khi endpoint thất bại liên tục, họ NGỪNG GỬI hẳn
 * và ghi "Delivery suppressed: endpoint has been failing continuously". Sửa
 * tunnel xong thì webhook vẫn không về, vì trạng thái ngắt còn nguyên.
 *
 * Đã quan sát trên nhật ký thật ngày 17/08/2026: tunnel chết lúc 10:01, Zernio
 * trả HTTP 530 nhiều lần rồi chuyển sang suppressed. Tin nhắn và bình luận của
 * khách trong hơn 3 giờ sau đó bị bỏ hoàn toàn — kể cả sau khi tunnel đã sống
 * lại. Chỉ một lời gọi POST /webhooks/test thành công mới xoá trạng thái này.
 */
async function clearSuppression() {
  const key = process.env.ZERNIO_API_KEY;
  const base = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    const list = await (await fetch(`${base}/webhooks/settings`, { headers })).json();
    const id = list.webhooks?.[0]?._id;
    if (!id) return;

    // POST /webhooks/test BẮT BUỘC có webhookId trong body; thiếu thì trả 400.
    const response = await fetch(`${base}/webhooks/test`, {
      method: "POST",
      headers,
      body: JSON.stringify({ webhookId: id }),
    });
    if (!response.ok) {
      log(`Gọi test webhook thất bại: HTTP ${response.status}`);
      return;
    }

    const after = await (await fetch(`${base}/webhooks/settings`, { headers })).json();
    const hook = after.webhooks?.[0];
    const suppressed = Boolean(hook?.attemptFailingSince);

    log(
      suppressed
        ? "⚠️  Zernio VẪN đang ngắt gửi — cần kiểm tra thủ công"
        : "Đã gỡ trạng thái ngắt gửi của Zernio, webhook sẵn sàng nhận"
    );
  } catch (error) {
    log(`Không gỡ được trạng thái ngắt: ${error.message}`);
  }
}

/**
 * Kiểm tra Zernio có đang ngắt gửi hay không.
 *
 * Tunnel có thể sống mà Zernio vẫn ngắt — hai tình trạng độc lập, phải theo dõi
 * riêng. Đây chính là lý do lần trước sửa tunnel xong mà tin vẫn không về.
 */
async function checkSuppression() {
  const key = process.env.ZERNIO_API_KEY;
  const base = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
  const headers = { Authorization: `Bearer ${key}` };

  try {
    const list = await (await fetch(`${base}/webhooks/settings`, { headers })).json();
    const hook = list.webhooks?.[0];
    if (!hook) return;

    if (hook.attemptFailingSince) {
      log(
        `Zernio đang ngắt gửi (thất bại từ ${new Date(hook.attemptFailingSince).toLocaleTimeString("vi-VN")}) — đang gỡ`
      );
      await clearSuppression();
    }
  } catch {
    /* lỗi mạng tạm thời, để nhịp sau xét lại */
  }
}

/**
 * Dựng tunnel mới và đọc URL từ log của cloudflared.
 *
 * BA LỖI ĐÃ TỪNG XẢY RA THẬT, sửa ở đây:
 *
 * 1. Không giết tiến trình cũ trước khi dựng cái mới. Sau vài giờ có tới NĂM
 *    tiến trình cloudflared cùng chạy, mỗi cái một địa chỉ, chỉ một cái được
 *    đăng ký — bốn cái còn lại chạy vô ích và vẫn gọi Cloudflare.
 *
 * 2. Khi hết 60 giây không thấy URL thì chỉ reject mà KHÔNG giết tiến trình
 *    vừa đẻ ra. Nó thành tiến trình mồ côi, tiếp tục thử kết nối mãi.
 *
 * 3. Không phân biệt lỗi tạm thời với việc bị Cloudflare CHẶN TẦN SUẤT. Dựng
 *    lại đều đặn 30 giây một lần suốt hàng giờ dẫn tới:
 *       status_code="429 Too Many Requests", error code: 1015
 *    Tức là chính vòng thử lại đã tự tạo ra lệnh chặn, rồi lại thử lại tiếp
 *    trong khi đang bị chặn. Nay nhận diện được và báo ra ngoài để lùi thật xa.
 */
function startTunnel() {
  return new Promise((resolve, reject) => {
    // Luôn dọn tiến trình cũ trước, không bao giờ để hai cái cùng sống.
    if (child) {
      try { child.kill("SIGKILL"); } catch { /* đã chết rồi */ }
      child = null;
    }

    const proc = spawn(CLOUDFLARED, ["tunnel", "--url", LOCAL_URL, "--no-autoupdate"]);
    child = proc;

    let settled = false;
    let biChan = false;

    const ketThuc = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };

    const timer = setTimeout(() => {
      // Giết luôn, không để lại tiến trình mồ côi.
      try { proc.kill("SIGKILL"); } catch { /* đã chết rồi */ }
      if (child === proc) child = null;
      ketThuc(
        reject,
        new Error(
          biChan
            ? "RATE_LIMIT: Cloudflare đang chặn tần suất tạo tunnel (429 / mã 1015)"
            : "Quá 60 giây không thấy URL tunnel"
        )
      );
    }, 60_000);

    const onData = (chunk) => {
      const text = String(chunk);

      // Nhận diện lệnh chặn ngay khi thấy, để lùi thật xa thay vì thử lại dồn dập.
      if (/429|Too Many Requests|error code: 1015/i.test(text)) {
        biChan = true;
        try { proc.kill("SIGKILL"); } catch { /* đã chết rồi */ }
        if (child === proc) child = null;
        ketThuc(
          reject,
          new Error("RATE_LIMIT: Cloudflare đang chặn tần suất tạo tunnel (429 / mã 1015)")
        );
        return;
      }

      /*
       * Bỏ qua api.trycloudflare.com — ĐÓ KHÔNG PHẢI địa chỉ tunnel.
       *
       * cloudflared in ra địa chỉ máy chủ API của Cloudflare trong log khởi
       * động, TRƯỚC khi in địa chỉ tunnel thật. Mẫu cũ [a-z0-9-]+ khớp luôn
       * chữ "api", nên script lấy nhầm dòng đầu rồi đem đăng ký với nhà cung
       * cấp. Hậu quả đã xảy ra thật: mọi webhook gửi vào chỗ chết suốt nhiều
       * ngày, nhà cung cấp ghi "Delivery suppressed: endpoint has been failing
       * continuously", 0/100 lần giao thành công. Tin nhắn còn về được nhờ
       * vòng quét bù 5 phút, còn bình luận thì mất trắng vì không có vòng nào
       * quét bù cho nó.
       *
       * Địa chỉ tunnel thật của quick tunnel luôn có nhiều từ nối bằng gạch
       * ngang; api.trycloudflare.com thì không. Nhưng thay vì đoán theo hình
       * dạng, cứ loại thẳng những tên miền con đã biết là không phải tunnel.
       */
      const KHONG_PHAI_TUNNEL = new Set(["api", "www", "dash"]);
      for (const ung of text.matchAll(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/g)) {
        if (KHONG_PHAI_TUNNEL.has(ung[1])) continue;
        ketThuc(resolve, ung[0]);
        return;
      }
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => {
      log(`Tiến trình cloudflared đã thoát (mã ${code})`);
      if (child === proc) child = null;
      ketThuc(reject, new Error(`cloudflared thoát sớm (mã ${code})`));
    });
  });
}

/**
 * Tunnel còn dẫn được không.
 *
 * Phải gọi QUA tunnel, không phải localhost: tiến trình sống mà đường không
 * thông là đúng tình huống đã xảy ra, và chỉ lời gọi qua tunnel mới phát hiện.
 */
async function tunnelHealthy(url) {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Máy chủ trong máy (gốc của đường hầm) còn trả lời không — gọi THẲNG, không qua đường hầm. */
async function gocSong() {
  try {
    const response = await fetch(`${LOCAL_URL}/api/health`, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Gửi Telegram cho quản trị (chủ dự án) — dùng khi máy chủ trong máy tắt: lúc đó máy chủ không tự báo được. Đọc cấu hình
 * Telegram của tài khoản quản trị trong database (chỉ đọc). Hỏng thì chỉ ghi nhật ký, không làm dừng người canh.
 */
async function baoQuanTri(noiDung) {
  if (!process.env.DATABASE_URL) return;
  const kho = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const r = await kho.query(
      `SELECT tc.chat_id, tc.bot_token, tc.uses_platform_bot FROM telegram_configs tc JOIN users u ON u.id = tc.user_id
        WHERE u.role = 'admin' AND tc.enabled AND COALESCE(tc.chat_id, '') <> ''`
    );
    for (const dong of r.rows) {
      const token = dong.uses_platform_bot ? process.env.TELEGRAM_BOT_TOKEN : dong.bot_token;
      if (!token) continue;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: dong.chat_id, text: noiDung, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(15_000),
      });
    }
    log(`Đã báo quản trị qua Telegram (${r.rows.length} nơi nhận).`);
  } catch (error) {
    log(`Không báo được quản trị qua Telegram: ${error.message}`);
  } finally {
    await kho.end().catch(() => {});
  }
}

async function rotate() {
  if (child) {
    child.kill();
    child = null;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  currentUrl = await startTunnel();
  fs.writeFileSync(STATE_FILE, currentUrl);
  log(`Tunnel mới: ${currentUrl}`);
  /*
   * Chờ đường hầm THÔNG rồi mới đăng ký. Đã thấy ngày 01/10/2026: đăng ký và
   * gọi thử ngay khi vừa có địa chỉ thì tên miền chưa kịp phân giải
   * (getaddrinfo EBUSY) — lần thử hỏng, nhà cung cấp vẫn ngắt gửi thêm 30 giây.
   */
  for (let i = 0; i < 12 && !(await tunnelHealthy(currentUrl)); i++) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
  await updateZernioWebhook(currentUrl);
}

function dangSong(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * CHỈ MỘT người canh được chạy.
 *
 * Hai người canh cùng chạy thì mỗi bên dựng một tunnel và tranh nhau ghi địa
 * chỉ webhook — bên này vừa đăng ký xong bên kia ghi đè, tin về chỗ chết. Nay
 * server tự bật người canh mỗi lần khởi động, nên chốt này là bắt buộc.
 */
function giuChoDuyNhat() {
  try {
    const cu = Number(fs.readFileSync(PID_FILE, "utf8"));
    if (cu && cu !== process.pid && dangSong(cu)) {
      log(`Đã có người canh khác đang chạy (pid ${cu}) — thoát, không chạy trùng.`);
      process.exit(0);
    }
  } catch {
    /* chưa có tệp khoá */
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
  process.on("exit", () => {
    try {
      if (Number(fs.readFileSync(PID_FILE, "utf8")) === process.pid) fs.rmSync(PID_FILE);
    } catch {
      /* đã xoá rồi */
    }
    child?.kill();
  });
}

async function main() {
  giuChoDuyNhat();
  log("Bắt đầu trông tunnel");

  /*
   * Lần dựng đầu tiên KHÔNG được phép làm chết tiến trình.
   *
   * Bản trước gọi thẳng rotate() không bọc, nên khi Cloudflare đang chặn tần
   * suất thì watchdog tắt ngay lúc khởi động — đúng lúc cần nó nhất. Nay coi
   * thất bại đầu tiên như mọi thất bại khác: lùi rồi thử lại ở vòng sau.
   */
  let khoiDongHong = false;
  try {
    await rotate();
  } catch (error) {
    khoiDongHong = true;
    log(`Chưa dựng được tunnel lúc khởi động: ${error.message}`);
    log("Vẫn chạy tiếp và sẽ thử lại theo nhịp lùi dần.");
  }

  /*
   * Lùi dần khi dựng lại thất bại.
   *
   * Bản trước thử lại đúng 30 giây một lần, bất kể lỗi gì, không giới hạn. Sau
   * vài giờ Cloudflare chặn tần suất (429 / mã 1015) — chính vòng thử lại đã
   * tạo ra lệnh chặn, rồi tiếp tục nện vào trong khi đang bị chặn nên không bao
   * giờ thoát ra được. Chủ shop mất webhook suốt thời gian đó mà không hay.
   *
   * Nay: thất bại thường thì lùi gấp đôi mỗi lần (1, 2, 4… phút, tối đa 15).
   * Bị chặn tần suất thì lùi thẳng 15 phút, vì thử sớm chỉ kéo dài lệnh chặn.
   */
  let soLanHong = khoiDongHong ? 1 : 0;
  let choToiPhut = khoiDongHong ? 15 : 0;

  const LUI_TOI_DA_PHUT = 15;
  const LUI_KHI_BI_CHAN_PHUT = 15;

  /*
   * Phải hỏng NHIỀU LẦN LIÊN TIẾP mới dựng lại. Đã thấy ngày 01/10/2026: đường
   * hầm vừa dựng 90 giây, nhà cung cấp đã giao thử thành công, vậy mà một lần
   * kiểm tra hỏng (máy này tạm nhớ kết quả tra tên miền thất bại) là bị đập bỏ
   * dựng lại — địa chỉ đổi vô ích, dựng dồn dập thì Cloudflare chặn tần suất.
   */
  const HONG_LIEN_TIEP_MOI_DUNG_LAI = 3;
  let soLanKhongThong = 0;
  let trangThaiGoc = { chetTu: null, daBao: false };
  /*
   * Cờ chống CHỒNG LƯỢT (19/10/2026): setInterval(async) chạy lượt mới cả khi lượt trước (dựng lại đường hầm — có thể
   * quá 60 giây) chưa xong → lượt mới đếm "không phản hồi" ngay lúc tên miền mới chưa kịp phân giải, đủ 3 lần là đập bỏ
   * đường hầm vừa dựng.
   */
  let dangXet = false;

  setInterval(async () => {
    if (dangXet) return;
    dangXet = true;
    try {
      await motLuot();
    } finally {
      dangXet = false;
    }
  }, CHECK_INTERVAL_MS);

  async function motLuot() {
    // Gốc (máy chủ trong máy) xét MỌI lượt, kể cả lúc đang lùi: tắt quá 5 phút liên tiếp → báo quản trị một lần; sống lại
    // → báo một lần nữa (nguoi-canh-luat.mjs — baoGoc).
    const song = await gocSong();
    const bao = baoGoc(trangThaiGoc, song, Date.now());
    trangThaiGoc = bao.trangThai;
    if (bao.gui === "tat") await baoQuanTri(TIN_GOC_TAT);
    if (bao.gui === "song") await baoQuanTri(TIN_GOC_SONG);

    // Đang trong thời gian lùi thì không đụng vào Cloudflare.
    if (choToiPhut > 0) {
      choToiPhut -= CHECK_INTERVAL_MS / 60_000;
      return;
    }

    const healthy = currentUrl ? await tunnelHealthy(currentUrl) : false;
    const qd = quyetDinh({
      gocSong: song,
      duongHamThong: healthy,
      soLanKhongThong,
      nguong: currentUrl ? HONG_LIEN_TIEP_MOI_DUNG_LAI : 1,
    });
    soLanKhongThong = qd.soLanKhongThong;

    if (qd.hanhDong === "cho_goc") {
      log("Máy chủ trong máy đang tắt — giữ đường hầm, KHÔNG dựng lại (dựng lại không chữa được máy chủ tắt).");
      return;
    }

    if (qd.hanhDong === "dem") {
      log(`Tunnel không phản hồi (lần ${soLanKhongThong}/${HONG_LIEN_TIEP_MOI_DUNG_LAI}) — chờ xem lại, chưa dựng lại.`);
      return;
    }

    if (qd.hanhDong === "dung_lai") {
      log("Tunnel không phản hồi — đang dựng lại");
      try {
        await rotate();
        soLanHong = 0;
      } catch (error) {
        soLanHong += 1;
        const biChan = String(error.message).startsWith("RATE_LIMIT");
        choToiPhut = biChan
          ? LUI_KHI_BI_CHAN_PHUT
          : Math.min(2 ** (soLanHong - 1), LUI_TOI_DA_PHUT);

        log(
          `Dựng lại thất bại (lần ${soLanHong}): ${error.message}. ` +
            `Chờ ${choToiPhut} phút rồi mới thử lại.`
        );

        if (biChan) {
          log(
            "Bị Cloudflare chặn tần suất. Đây là giới hạn của tunnel tạm miễn phí. " +
              "Muốn hết hẳn thì phải dùng tên miền cố định, không dùng trycloudflare."
          );
        }
      }
      return;
    }

    soLanHong = 0;

    // Tunnel sống vẫn phải xét riêng trạng thái ngắt của Zernio: hai tình
    // trạng độc lập, và ngắt không tự hết khi tunnel hồi phục.
    await checkSuppression();
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log("Đang dừng");
    child?.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[tunnel] Lỗi nghiêm trọng:", error.message);
  process.exit(1);
});

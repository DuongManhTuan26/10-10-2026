/**
 * Đường hầm công khai cho webhook khi chạy trên máy (localhost).
 *
 * Vì sao có: khách nhắn tin, bình luận chỉ về THEO THỜI GIAN THỰC qua webhook,
 * mà nhà cung cấp kênh không gọi được localhost. Đã xảy ra ngày 01/10/2026:
 * app được bật bằng nút Desktop (chỉ chạy server), không ai bật người canh
 * đường hầm, nên 30/30 lần giao webhook hỏng — AI chỉ thấy tin nhờ vòng quét bù
 * vài phút một lần, khách phải chờ.
 *
 * Nay server tự bật người canh (scripts/tunnel-watchdog.mjs) mỗi khi khởi động
 * trên máy, và tự bật lại khi phát hiện webhook chết. Người canh chạy TÁCH RỜI
 * (detached): server tự khởi động lại khi sửa mã thì đường hầm vẫn giữ nguyên,
 * không đổi địa chỉ liên tục (Cloudflare chặn tần suất nếu dựng lại dồn dập).
 * Người canh tự giữ chỗ duy nhất bằng tệp .tunnel.pid.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PID_FILE = path.join(process.cwd(), ".tunnel.pid");
const NHAT_KY = path.join(os.homedir(), "Library", "Logs", "quan-ly-fanpage-duong-ham.log");

function dangSong(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export type TinhTrangNguoiCanh = "dang_chay" | "vua_bat" | "thieu_cloudflared" | "thieu_script";

/** Người canh đang chạy thì thôi; chưa thì bật (tách rời khỏi server). */
export function damBaoNguoiCanh(): TinhTrangNguoiCanh {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
    if (pid && dangSong(pid)) return "dang_chay";
  } catch {
    /* chưa có tệp khoá */
  }
  const cloudflared = process.env.CLOUDFLARED_PATH;
  if (!cloudflared || !fs.existsSync(cloudflared)) return "thieu_cloudflared";
  const script = path.join(process.cwd(), "scripts", "tunnel-watchdog.mjs");
  if (!fs.existsSync(script)) return "thieu_script";

  fs.mkdirSync(path.dirname(NHAT_KY), { recursive: true });
  const ra = fs.openSync(NHAT_KY, "a");
  const con = spawn(process.execPath, [script], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", ra, ra],
    env: process.env,
  });
  con.unref();
  fs.closeSync(ra);
  return "vua_bat";
}

export const NHAT_KY_DUONG_HAM = NHAT_KY;

/** APP_URL không phải địa chỉ https công khai (máy lập trình) → webhook phải đi qua đường hầm. */
export function laDiaChiNoiBo(appUrl: string): boolean {
  try {
    const u = new URL(appUrl);
    return (
      u.protocol !== "https:" ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".local")
    );
  } catch {
    return true;
  }
}

/**
 * Công cụ ffmpeg cho video AI: đọc thông tin video, lấy khung cuối, ghép cảnh,
 * cắt ảnh theo khung. Tách riêng để video một cảnh và video dài dùng chung.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import * as zernio from "./zernio.js";

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------

export function chayFfmpeg(args: string[], hanMs = 600_000): Promise<string> {
  return new Promise((ok, loi) => {
    if (!ffmpegPath) return loi(new Error("Máy chủ thiếu ffmpeg"));
    const p = spawn(ffmpegPath as unknown as string, ["-hide_banner", "-y", ...args]);
    let log = "";
    p.stderr.on("data", (d) => {
      log = (log + String(d)).slice(-20_000);
    });
    const hen = setTimeout(() => p.kill("SIGKILL"), hanMs);
    p.on("error", (e) => {
      clearTimeout(hen);
      loi(e);
    });
    p.on("close", (ma) => {
      clearTimeout(hen);
      if (ma === 0) ok(log);
      else loi(new Error(`ffmpeg thoát mã ${ma}: ${log.slice(-400)}`));
    });
  });
}

/** Thông tin một tệp video, đọc từ phần ffmpeg in ra. */
export function docThongTinVideo(log: string): { rong: number; cao: number; coTieng: boolean; soGiay: number | null } {
  const v = /Stream #\d+:\d+[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/.exec(log);
  const t = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  return {
    rong: v ? Number(v[1]) : 0,
    cao: v ? Number(v[2]) : 0,
    coTieng: /Stream #\d+:\d+[^\n]*Audio:/.test(log),
    soGiay: t ? Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]) : null,
  };
}

/**
 * Đọc thông tin một tệp. Chỉ có "-i" nên ffmpeg luôn thoát mã lỗi — vẫn phải
 * lấy ĐỦ log. Bản trước lấy log qua câu báo lỗi, vốn chỉ giữ 400 ký tự cuối,
 * nên mất đúng dòng ghi kích thước: đã đo, ghép ra 720×1280 thay vì 480×854.
 */
export function thongTin(tep: string): Promise<ReturnType<typeof docThongTinVideo>> {
  return new Promise((ok, loi) => {
    if (!ffmpegPath) return loi(new Error("Máy chủ thiếu ffmpeg"));
    const p = spawn(ffmpegPath as unknown as string, ["-hide_banner", "-i", tep]);
    let log = "";
    p.stderr.on("data", (d) => {
      log += String(d);
    });
    p.on("error", loi);
    p.on("close", () => ok(docThongTinVideo(log)));
  });
}

export async function taiVe(url: string, tep: string): Promise<void> {
  const r = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!r.ok || !r.body) throw new Error(`tải tệp hỏng: HTTP ${r.status}`);
  await pipeline(Readable.fromWeb(r.body as import("node:stream/web").ReadableStream), fs.createWriteStream(tep));
}

async function duaLenKho(tep: string, contentType: string, ten: string): Promise<string> {
  const du = await fsp.readFile(tep);
  const presign = await zernio.presignMedia({ filename: ten, contentType, size: du.length });
  const r = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(du),
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok) throw new Error(`đưa tệp lên kho hỏng: HTTP ${r.status}`);
  return presign.publicUrl;
}

export async function voiThuMucTam<T>(viec: (thuMuc: string) => Promise<T>): Promise<T> {
  const thuMuc = await fsp.mkdtemp(path.join(os.tmpdir(), "video-"));
  try {
    return await viec(thuMuc);
  } finally {
    await fsp.rm(thuMuc, { recursive: true, force: true });
  }
}

/** Khung hình cuối của một video, đưa lên kho, trả địa chỉ gốc. */
export async function layKhungCuoi(urlVideo: string, ten: string): Promise<string> {
  return voiThuMucTam(async (thuMuc) => {
    const vao = path.join(thuMuc, "vao.mp4");
    const ra = path.join(thuMuc, "cuoi.jpg");
    await taiVe(urlVideo, vao);
    await chayFfmpeg(["-sseof", "-0.25", "-i", vao, "-frames:v", "1", "-q:v", "2", "-update", "1", ra], 120_000);
    return duaLenKho(ra, "image/jpeg", ten);
  });
}

/**
 * Ghép nhiều cảnh thành một video.
 *
 * Mã hoá lại chứ không nối thẳng: cảnh có ảnh mở đầu đôi khi ra khác kích
 * thước (đã đo: ảnh vuông → video vuông), nên đưa mọi cảnh về cùng khung của
 * cảnh đầu, cùng 24 khung/giây. H.264 + faststart để Facebook nhận và xem được
 * ngay khi đang tải.
 */
export async function ghepVideo(urls: string[], coTieng: boolean, ten: string): Promise<string> {
  return voiThuMucTam(async (thuMuc) => {
    const tep: string[] = [];
    for (const [i, u] of urls.entries()) {
      const t = path.join(thuMuc, `canh-${i}.mp4`);
      await taiVe(u, t);
      tep.push(t);
    }
    const info = await Promise.all(tep.map(thongTin));
    const rong = info[0].rong - (info[0].rong % 2) || 720;
    const cao = info[0].cao - (info[0].cao % 2) || 1280;
    /*
     * Muốn có tiếng mà có cảnh không có tiếng thì chèn khoảng lặng đúng độ dài
     * cảnh đó, KHÔNG bỏ tiếng của cả video. Đã đo: bản trước bỏ sạch tiếng chỉ
     * vì một cảnh thiếu.
     */
    const giuTieng = coTieng && info.some((x) => x.coTieng);

    const loc: string[] = [];
    tep.forEach((_, i) => {
      loc.push(
        `[${i}:v]scale=${rong}:${cao}:force_original_aspect_ratio=decrease,` +
          `pad=${rong}:${cao}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`
      );
      if (!giuTieng) return;
      if (info[i].coTieng) {
        loc.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
      } else {
        const dai = info[i].soGiay ?? 0;
        loc.push(`anullsrc=r=44100:cl=stereo,atrim=0:${dai.toFixed(3)}[a${i}]`);
      }
    });
    const vao = tep.map((_, i) => (giuTieng ? `[v${i}][a${i}]` : `[v${i}]`)).join("");
    loc.push(`${vao}concat=n=${tep.length}:v=1:a=${giuTieng ? 1 : 0}${giuTieng ? "[v][a]" : "[v]"}`);

    const ra = path.join(thuMuc, "ra.mp4");
    await chayFfmpeg([
      ...tep.flatMap((t) => ["-i", t]),
      "-filter_complex", loc.join(";"),
      "-map", "[v]",
      ...(giuTieng ? ["-map", "[a]", "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      ra,
    ]);
    return duaLenKho(ra, "video/mp4", ten);
  });
}

/** Cạnh dài, cạnh ngắn theo độ nét — dùng khi cắt ảnh theo khung. */
const CANH_NGAN_ANH: Record<string, number> = { "480p": 480, "720p": 720, "768p": 768, "1080p": 1080 };

/**
 * Cắt ảnh về đúng tỷ lệ khung đã chọn (cắt giữa), đưa lên kho, trả địa chỉ gốc.
 *
 * Đã đo 3 lần: ảnh mở đầu hay ảnh tham chiếu VUÔNG thì video ra vuông, kể cả
 * khi gửi kèm aspect_ratio 9:16 và size 480x854 — model theo tỷ lệ của ảnh.
 * Nên phải đưa ảnh về đúng khung TRƯỚC khi gửi.
 */
export async function anhTheoKhung(url: string, khung: string, doNet: string, ten: string): Promise<string> {
  const [a, b] = khung.split(":").map(Number);
  if (!a || !b) return url;
  const ngan = CANH_NGAN_ANH[doNet.toLowerCase()] ?? 720;
  const chan = (n: number) => n - (n % 2);
  const rong = chan(a >= b ? Math.round((ngan * a) / b) : ngan);
  const cao = chan(a >= b ? ngan : Math.round((ngan * b) / a));
  return voiThuMucTam(async (thuMuc) => {
    const vao = path.join(thuMuc, "vao");
    const ra = path.join(thuMuc, "ra.jpg");
    await taiVe(url, vao);
    await chayFfmpeg([
      "-i", vao,
      "-vf", `scale=${rong}:${cao}:force_original_aspect_ratio=increase,crop=${rong}:${cao}`,
      "-frames:v", "1", "-q:v", "2", ra,
    ], 60_000);
    return duaLenKho(ra, "image/jpeg", ten);
  });
}

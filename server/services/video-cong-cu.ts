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
export function docThongTinVideo(log: string): {
  rong: number;
  cao: number;
  coTieng: boolean;
  soGiay: number | null;
  khungMoiGiay: number | null;
} {
  const v = /Stream #\d+:\d+[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/.exec(log);
  const t = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  const f = /Stream #\d+:\d+[^\n]*Video:[^\n]*?, ([\d.]+) fps\b/.exec(log);
  return {
    rong: v ? Number(v[1]) : 0,
    cao: v ? Number(v[2]) : 0,
    coTieng: /Stream #\d+:\d+[^\n]*Audio:/.test(log),
    soGiay: t ? Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]) : null,
    khungMoiGiay: f && Number(f[1]) > 0 ? Number(f[1]) : null,
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

export async function duaLenKho(tep: string, contentType: string, ten: string): Promise<string> {
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

/**
 * Khung hình CUỐI THẬT của một video, đưa lên kho, trả địa chỉ gốc.
 *
 * Giải mã nửa giây cuối và ghi đè từng khung ("-update 1", không "-frames:v 1")
 * nên tệp còn lại là khung cuối cùng. Đã đo 02/10/2026: bản trước lấy khung
 * đầu tiên của 0,25 giây cuối = lùi 4 khung → cảnh sau bắt đầu từ đó, video
 * ghép bị TUA NGƯỢC ~0,17 giây ở mỗi mối nối.
 */
export async function layKhungCuoi(urlVideo: string, ten: string): Promise<string> {
  return voiThuMucTam(async (thuMuc) => {
    const vao = path.join(thuMuc, "vao.mp4");
    const ra = path.join(thuMuc, "cuoi.jpg");
    await taiVe(urlVideo, vao);
    await chayFfmpeg(["-sseof", "-0.5", "-i", vao, "-q:v", "2", "-update", "1", ra], 120_000);
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
 *
 * Từ cảnh 2 trở đi BỎ KHUNG ĐẦU: cảnh đó được tạo từ khung cuối của cảnh trước,
 * nên khung đầu của nó là chính khung đó vẽ lại — giữ thì hình đứng một nhịp ở
 * mỗi mối nối. Tiếng cắt đúng bằng một khung để tiếng và hình không lệch dần.
 */
export async function ghepVideo(
  urls: string[],
  coTieng: boolean,
  ten: string,
  them: { giong?: (Buffer | null)[]; nhacUrl?: string; phuDe?: (string | null)[]; boKhungDau?: boolean[] } = {}
): Promise<string> {
  return voiThuMucTam(async (thuMuc) => {
    const tep: string[] = [];
    for (const [i, u] of urls.entries()) {
      const t = path.join(thuMuc, `canh-${i}.mp4`);
      await taiVe(u, t);
      tep.push(t);
    }
    const info = await Promise.all(tep.map(thongTin));
    const soKhung = await Promise.all(tep.map(demKhung));

    const giong: ({ tep: string; soGiay: number } | null)[] = [];
    for (const [i, b] of (them.giong ?? []).entries()) {
      if (!b) {
        giong.push(null);
        continue;
      }
      const t = path.join(thuMuc, `giong-${i}.wav`);
      await fsp.writeFile(t, b);
      giong.push({ tep: t, soGiay: (await thongTin(t)).soGiay ?? 0 });
    }
    let nhac: string | undefined;
    if (them.nhacUrl) {
      nhac = path.join(thuMuc, "nhac");
      await taiVe(them.nhacUrl, nhac);
    }
    let phuDe: string | undefined;
    if (them.phuDe?.some((c) => c && c.trim())) {
      const doDai = doDaiTungCanh(info, soKhung, them.boKhungDau);
      phuDe = path.join(thuMuc, "phu-de.ass");
      const cuoi = them.phuDe[them.phuDe.length - 1];
      await fsp.writeFile(
        phuDe,
        noiDungPhuDe({
          rong: info[0].rong - (info[0].rong % 2) || 720,
          cao: info[0].cao - (info[0].cao % 2) || 1280,
          doDai,
          chu: them.phuDe,
          lich: lichGiongDoc(doDai, giong.map((g) => (g ? { soGiay: g.soGiay } : null))),
          canhCuoiLaKeuGoi: Boolean(cuoi && cuoi.trim()) && them.phuDe.length > 1,
        })
      );
    }
    const ra = path.join(thuMuc, "ra.mp4");
    await chayFfmpeg(lenhGhep(tep, info, soKhung, coTieng, ra, { giong, nhac, phuDe, boKhungDau: them.boKhungDau }));
    return duaLenKho(ra, "video/mp4", ten);
  });
}

/** Số khung hình thật của một tệp (giải mã đếm). Tệp cảnh chỉ vài giây nên nhanh. */
export async function demKhung(tep: string): Promise<number | null> {
  const log = await chayFfmpeg(["-i", tep, "-map", "0:v:0", "-f", "null", "-"], 120_000);
  const m = [...log.matchAll(/frame= *(\d+)/g)].pop();
  return m ? Number(m[1]) : null;
}

/**
 * Độ dài thật của từng cảnh TRONG video ghép (giây): cảnh 2 trở đi đã bỏ khung đầu.
 * Dùng chung cho hình, tiếng, giọng đọc và phụ đề để mọi thứ khớp đúng một mốc.
 */
export function doDaiTungCanh(
  info: ReturnType<typeof docThongTinVideo>[],
  soKhung: (number | null)[],
  boKhungDau?: boolean[]
): number[] {
  return info.map((x, i) => {
    const boDau = boKhungDau ? Boolean(boKhungDau[i]) : i > 0;
    const fps = x.khungMoiGiay ?? 24;
    const k = soKhung[i];
    return k ? (k - (boDau ? 1 : 0)) / fps : Math.max(0, (x.soGiay ?? 0) - (boDau ? 1 / fps : 0));
  });
}

/** Giọng đọc bắt đầu sau đầu cảnh một chút, và phải xong trước cuối cảnh một chút. */
export const GIONG_VAO_SAU = 0.25;
const GIONG_XONG_TRUOC = 0.15;
/** Đọc nhanh hơn tối đa 25% — hơn nữa nghe như tua, thà lố sang cảnh sau một chút. */
export const TEMPO_TOI_DA = 1.25;

export interface LichGiong {
  batDau: number;
  tempo: number;
  /** Lúc giọng đọc xong (giây, tính trong video ghép). */
  xong: number;
}

/** Lịch giọng đọc từng cảnh: bắt đầu lúc nào, phải đọc nhanh lên bao nhiêu để vừa cảnh. */
export function lichGiongDoc(doDai: number[], giong: ({ soGiay: number } | null)[]): (LichGiong | null)[] {
  let moc = 0;
  return doDai.map((d, i) => {
    const dauCanh = moc;
    moc += d;
    const g = giong[i];
    if (!g || g.soGiay <= 0) return null;
    const cho = Math.max(0.5, d - GIONG_VAO_SAU - GIONG_XONG_TRUOC);
    const tempo = g.soGiay > cho ? Math.min(TEMPO_TOI_DA, g.soGiay / cho) : 1;
    const batDau = dauCanh + GIONG_VAO_SAU;
    return { batDau, tempo, xong: batDau + g.soGiay / tempo };
  });
}

function thoiGianAss(giay: number): string {
  const cs = Math.max(0, Math.round(giay * 100));
  const h = Math.floor(cs / 360_000);
  const m = Math.floor((cs % 360_000) / 6_000);
  const s = Math.floor((cs % 6_000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** Chữ đưa vào phụ đề: bỏ ký tự điều khiển của định dạng ASS để không ai chèn được lệnh vẽ. */
export function chuAnToan(chu: string): string {
  return chu.replace(/[{}\\]/g, "").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Phụ đề tiếng Việt in thẳng lên hình (ffmpeg + libass): đúng dấu tuyệt đối,
 * khác hẳn chữ do AI video vẽ (thường sai dấu, sai chữ).
 *
 * Phần lớn người xem video Facebook tắt tiếng, nên lời đọc phải hiện thành chữ.
 * Cảnh cuối là lời kêu gọi hành động: chữ to, đặt giữa khung, có nền.
 */
export function noiDungPhuDe(p: {
  rong: number;
  cao: number;
  doDai: number[];
  chu: (string | null)[];
  lich: (LichGiong | null)[];
  canhCuoiLaKeuGoi: boolean;
}): string {
  const co = Math.round(p.cao * 0.034);
  const coCta = Math.round(p.cao * 0.042);
  /*
   * Vùng an toàn của Meta (Reels): để trống chữ ở 14% trên, 35% dưới, 6% mỗi bên — bị ảnh đại diện,
   * nút kêu gọi che (https://www.facebook.com/business/ads-guide/update/image/instagram-reels).
   * Trước đây phụ đề cách đáy 13%, lời kêu gọi 16% — nằm trong vùng bị che.
   */
  const le = Math.ceil(p.rong * VUNG_AN_TOAN.ben) + 4;
  const cachDay = Math.ceil(p.cao * VUNG_AN_TOAN.duoi) + 8;
  const dong: string[] = [];
  let moc = 0;
  p.doDai.forEach((d, i) => {
    const dauCanh = moc;
    moc += d;
    const chu = chuAnToan(p.chu[i] ?? "");
    if (!chu) return;
    const laCta = p.canhCuoiLaKeuGoi && i === p.doDai.length - 1;
    const g = p.lich[i];
    const batDau = laCta || !g ? dauCanh + 0.1 : g.batDau;
    const ketThuc = laCta || !g ? moc - 0.05 : Math.min(moc + 0.6, Math.max(g.xong + 0.3, batDau + 1.2));
    dong.push(`Dialogue: 0,${thoiGianAss(batDau)},${thoiGianAss(ketThuc)},${laCta ? "KeuGoi" : "Phu"},,0,0,0,,${chu}`);
  });
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${p.rong}`,
    `PlayResY: ${p.cao}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Phu,${PHONG_CHU},${co},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(co * 0.08))},1,2,${le},${le},${cachDay},1`,
    // Căn dưới, ngay trên vùng 35% của Meta: đặt giữa khung thì che mặt nhân vật (đã thấy ở dự án #8).
    `Style: KeuGoi,${PHONG_CHU},${coCta},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,3,${Math.round(coCta * 0.35)},0,2,${le},${le},${cachDay},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dong,
    "",
  ].join("\n");
}

/** Vùng an toàn chữ của Meta cho Reels (tỷ lệ khung). */
export const VUNG_AN_TOAN = { tren: 0.14, duoi: 0.35, ben: 0.06 };

/**
 * Phông chữ phụ đề. Đã thử 02/10/2026 trên máy chủ macOS: libass tìm thấy Arial
 * và in đủ dấu tiếng Việt (ỦNG, ĐƯỢC, nhắn). Chạy trên máy chủ Linux thì phải
 * cài phông có tiếng Việt cùng tên, không thì chữ ra ô vuông.
 */
export const PHONG_CHU = "Arial";

/** Những thứ thêm vào khi ghép: giọng đọc từng cảnh, nhạc nền, phụ đề. */
export interface ThemKhiGhep {
  /** Tệp giọng đọc của từng cảnh (null = cảnh không có lời). */
  giong?: ({ tep: string; soGiay: number } | null)[];
  /** Tệp nhạc nền, dài ít nhất bằng video. */
  nhac?: string;
  /** Tệp phụ đề ASS đã viết sẵn. */
  phuDe?: string;
  /** Cảnh nào bỏ khung đầu (trùng khung cuối cảnh trước). Bỏ trống = mọi cảnh từ cảnh 2 (cách cũ). */
  boKhungDau?: boolean[];
}

/** Âm lượng khi trộn — chọn để lời đọc luôn nổi lên trên. */
export const DO_TO_LUFS = -14;

export const AM_LUONG = { tiengCanhKhiCoLoi: 0.45, nhacKhiCoLoi: 0.32, nhacKhongLoi: 0.75 };

/** Tham số ffmpeg để ghép các tệp cảnh đã tải về. Tách riêng để thử được trên tệp thật, không cần kho. */
export function lenhGhep(
  tep: string[],
  info: ReturnType<typeof docThongTinVideo>[],
  soKhung: (number | null)[],
  coTieng: boolean,
  ra: string,
  them: ThemKhiGhep = {}
): string[] {
  const rong = info[0].rong - (info[0].rong % 2) || 720;
  const cao = info[0].cao - (info[0].cao % 2) || 1280;
  /*
   * Muốn có tiếng mà có cảnh không có tiếng thì chèn khoảng lặng đúng độ dài
   * cảnh đó, KHÔNG bỏ tiếng của cả video. Đã đo: bản trước bỏ sạch tiếng chỉ
   * vì một cảnh thiếu.
   */
  const giuTieng = coTieng && info.some((x) => x.coTieng);
  const doDai = doDaiTungCanh(info, soKhung, them.boKhungDau);
  const tong = doDai.reduce((a, b) => a + b, 0);
  const giong = them.giong ?? [];
  const coGiong = giong.some((g) => g);
  const coNhac = Boolean(them.nhac);

  const loc: string[] = [];
  tep.forEach((_, i) => {
    const boDau = them.boKhungDau ? Boolean(them.boKhungDau[i]) : i > 0;
    const motKhung = 1 / (info[i].khungMoiGiay ?? 24);
    /*
     * Tiếng mỗi cảnh phải dài ĐÚNG bằng hình. Đã đo 02/10/2026: tiếng clip H3 Max
     * dài hơn hình ~0,013 giây; cộng dồn qua các cảnh, bộ ghép chèn một khung
     * lặp ở mối nối → hình đứng một nhịp.
     */
    const daiHinh = doDai[i];
    loc.push(
      `[${i}:v]${boDau ? "trim=start_frame=1,setpts=PTS-STARTPTS," : ""}` +
        `scale=${rong}:${cao}:force_original_aspect_ratio=decrease,` +
        `pad=${rong}:${cao}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`
    );
    if (!giuTieng) return;
    if (info[i].coTieng) {
      loc.push(
        `[${i}:a]${boDau ? `atrim=start=${motKhung.toFixed(6)},asetpts=PTS-STARTPTS,` : ""}` +
          `aresample=44100,aformat=channel_layouts=stereo,apad,atrim=end=${daiHinh.toFixed(6)}[a${i}]`
      );
    } else {
      loc.push(`anullsrc=r=44100:cl=stereo,atrim=0:${daiHinh.toFixed(6)}[a${i}]`);
    }
  });
  const vao = tep.map((_, i) => (giuTieng ? `[v${i}][a${i}]` : `[v${i}]`)).join("");
  loc.push(`${vao}concat=n=${tep.length}:v=1:a=${giuTieng ? 1 : 0}${giuTieng ? "[v][a]" : "[v]"}`);

  // --- Hình: phụ đề in lên sau khi ghép, để chữ theo đúng mốc của cả video.
  let nhanHinh = "[v]";
  if (them.phuDe) {
    loc.push(`[v]ass=filename='${them.phuDe.replace(/'/g, "")}'[vc]`);
    nhanHinh = "[vc]";
  }

  // --- Tiếng: tiếng cảnh + giọng đọc + nhạc nền.
  const dauVaoThem: string[] = [];
  let soVao = tep.length;
  let nhanTieng: string | null = giuTieng ? "[a]" : null;
  if (coGiong || coNhac) {
    const tron: string[] = [];
    if (giuTieng) {
      loc.push(`[a]volume=${AM_LUONG.tiengCanhKhiCoLoi}[nen]`);
      tron.push("[nen]");
    }
    const lich = lichGiongDoc(doDai, giong.map((g) => (g ? { soGiay: g.soGiay } : null)));
    const nhanGiong: string[] = [];
    giong.forEach((g, i) => {
      const l = lich[i];
      if (!g || !l) return;
      dauVaoThem.push("-i", g.tep);
      const ms = Math.round(l.batDau * 1000);
      loc.push(
        `[${soVao}:a]aresample=44100,aformat=channel_layouts=stereo,` +
          `${l.tempo > 1 ? `atempo=${l.tempo.toFixed(4)},` : ""}adelay=${ms}|${ms}[g${i}]`
      );
      nhanGiong.push(`[g${i}]`);
      soVao++;
    });
    if (nhanGiong.length) {
      loc.push(`${nhanGiong.join("")}amix=inputs=${nhanGiong.length}:duration=longest:normalize=0[loi]`);
    }
    if (coNhac) {
      dauVaoThem.push("-i", them.nhac!);
      const tat = Math.max(0, tong - 2.5).toFixed(3);
      loc.push(
        `[${soVao}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:${tong.toFixed(3)},` +
          `afade=t=in:d=0.8,afade=t=out:st=${tat}:d=2.5,` +
          `volume=${nhanGiong.length ? AM_LUONG.nhacKhiCoLoi : AM_LUONG.nhacKhongLoi}[nhac0]`
      );
      soVao++;
      if (nhanGiong.length) {
        // Nhạc tự nhỏ xuống khi có lời đọc (nén theo giọng), lời luôn nghe rõ.
        loc.push("[loi]asplit=2[loiA][loiB]");
        loc.push("[nhac0][loiA]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[nhac]");
        tron.push("[nhac]", "[loiB]");
      } else {
        tron.push("[nhac0]");
      }
    } else if (nhanGiong.length) {
      tron.push("[loi]");
    }
    loc.push(
      `${tron.join("")}amix=inputs=${tron.length}:duration=longest:normalize=0,` +
        // Chuẩn độ to mạng xã hội (~-14 LUFS): đã đo bản trộn đầu tiên chỉ -17,9 LUFS, nghe nhỏ hơn video khác.
        `apad,atrim=0:${tong.toFixed(3)},loudnorm=I=${DO_TO_LUFS}:LRA=11:TP=-1.5,aresample=44100,atrim=0:${tong.toFixed(3)}[am]`
    );
    nhanTieng = "[am]";
  }

  return [
    ...tep.flatMap((t) => ["-i", t]),
    ...dauVaoThem,
    "-filter_complex", loc.join(";"),
    "-map", nhanHinh,
    ...(nhanTieng ? ["-map", nhanTieng, "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    ra,
  ];
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

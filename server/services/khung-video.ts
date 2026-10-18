/**
 * Vẽ KHUNG MỞ ĐẦU cho một cảnh video bằng AI ảnh.
 *
 * Vì sao cần: video quảng cáo có nhiều cảnh khác nhau (vấn đề → giải pháp →
 * kêu gọi), phải CẮT sang góc máy / bối cảnh mới. Cảnh mới không nối từ khung
 * cuối được, mà để mô hình video tự vẽ từ chữ thì mỗi cảnh ra một người khác.
 * Nên vẽ khung đầu của cảnh mới bằng AI ảnh, đưa ẢNH NHÂN VẬT ở cảnh 1 làm mẫu
 * để giữ đúng người, rồi mới cho mô hình video chuyển động từ khung đó.
 */

import type { LuatNoiDung } from "./video-ai.js";
import { loiNhaCungCap } from "./loi-ncc.js";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { layModelKhung, luatAnh, type ChuTrongAnh, type LuaChonVeAnh } from "./image-ai.js";
import { giaAnh } from "./model-anh.js";
import { hoanDiaChiKho } from "./media-proxy.js";
import { ghiLuotAi } from "./so-ai.js";
import { chayFfmpeg, duaLenKho, voiThuMucTam } from "./video-cong-cu.js";
import { chanNeuTaiKhoanKhoa } from "./tai-khoan-mo.js";

/**
 * Giá ước tính một khung khi CHƯA biết mô hình (dự án cũ, phép kiểm). Báo giá thật dùng giá của
 * mô hình người dùng chọn (giaKhungVideo trong image-ai.ts).
 */
export const GIA_KHUNG_UOC_TINH = 0.04;

const CANH_NGAN: Record<string, number> = { "480p": 480, "720p": 720, "768p": 768, "1080p": 1080, "2k": 1440, "4k": 2160 };

/** Kích thước khung đúng tỷ lệ và độ nét (số chẵn). */
export function kichThuocKhung(khung: string, doNet: string): { rong: number; cao: number } {
  const [a, b] = khung.split(":").map(Number);
  const ngan = CANH_NGAN[doNet.toLowerCase()] ?? 720;
  const chan = (n: number) => n - (n % 2);
  if (!a || !b) return { rong: ngan, cao: ngan };
  return a >= b
    ? { rong: chan(Math.round((ngan * a) / b)), cao: ngan }
    : { rong: ngan, cao: chan(Math.round((ngan * b) / a)) };
}

export function deBaiKhung(p: { nhatQuan: string; moTa: string; coAnhMau: boolean; chu?: ChuTrongAnh; luat?: LuatNoiDung }): string {
  return [
    // Phong cách (ảnh thật, hoạt hình…) theo mô tả của dự án — không gài cứng.
    "The OPENING FRAME of a video shot.",
    p.nhatQuan.trim(),
    `This shot: ${p.moTa.trim()}`,
    p.coAnhMau
      ? "Keep the SAME person as in the reference image: identical face, age, hair and outfit; keep the same product look. " +
        "The reference ONLY fixes who the person is: the time of day, lighting, place, pose and camera angle follow THIS shot's description, not the reference image. " +
        "Build the place, the light and the camera angle entirely from this shot's description."
      : "",
    // Khung mở đầu là một khung của video → theo lựa chọn chữ của dự án video.
    luatAnh(p.chu ?? "theo_noi_dung", p.luat),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Đề bài ảnh mẫu nhân vật: người (và sản phẩm) trên nền trơn, ánh sáng trung tính,
 * KHÔNG có nơi chốn — để làm mẫu giữ đúng người mà không kéo theo phòng, đèn, góc máy.
 */
export function deBaiAnhNhanVat(nhatQuan: string, luat: LuatNoiDung = {}): string {
  return [
    "Character reference photo for a video production: the person(s) and the product described below,",
    "full body, standing, facing the camera, neutral expression,",
    "on a plain light-grey studio background with soft, neutral, even daylight.",
    "NO room, NO furniture, NO location, NO props other than the product — ignore any place or time of day described.",
    nhatQuan.trim(),
    // Ảnh mẫu nhân vật là ảnh NỘI BỘ (không đăng): luôn không chữ để chữ không lọt sang video.
    luatAnh("khong", luat),
  ].join("\n\n");
}

/** Vẽ ảnh mẫu nhân vật (một lần mỗi dự án). */
export async function taoAnhNhanVat(p: {
  userId: number;
  nhatQuan: string;
  khung: string;
  doNet: string;
  anhThamChieu: string[];
  ten: string;
  luat?: LuatNoiDung;
  /** Mô hình vẽ ảnh người dùng chọn cho dự án (không cố định). */
  veAnh?: LuaChonVeAnh;
}): Promise<{ url: string; tien: number }> {
  return veAnh({ ...p, deBai: deBaiAnhNhanVat(p.nhatQuan, p.luat), anhMau: p.anhThamChieu });
}

export async function taoKhungVideo(p: {
  userId: number;
  nhatQuan: string;
  moTa: string;
  khung: string;
  doNet: string;
  /** Ảnh mẫu (địa chỉ kho): nhân vật ở cảnh 1, ảnh tham chiếu của chủ shop. */
  anhMau: string[];
  ten: string;
  /** Lựa chọn chữ của dự án video. */
  chu?: ChuTrongAnh;
  /** Hai luật nội dung người dùng bật/tắt của dự án video. */
  luat?: LuatNoiDung;
  /** Mô hình vẽ ảnh người dùng chọn cho dự án (không cố định). */
  veAnh?: LuaChonVeAnh;
}): Promise<{ url: string; tien: number }> {
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI nên chưa vẽ được khung.", 503);
  const deBai = deBaiKhung({ nhatQuan: p.nhatQuan, moTa: p.moTa, coAnhMau: p.anhMau.length > 0, chu: p.chu, luat: p.luat });
  return veAnh({ ...p, deBai });
}

/** Gọi AI ảnh, ghi sổ, cắt đúng khung, lưu kho. Dùng chung cho khung mở đầu và ảnh mẫu nhân vật. */
async function veAnh(p: {
  userId: number;
  deBai: string;
  khung: string;
  doNet: string;
  anhMau: string[];
  ten: string;
  veAnh?: LuaChonVeAnh;
}): Promise<{ url: string; tien: number }> {
  // Mô hình người dùng chọn (dự án cũ chưa chọn → mô hình rẻ nhất nhận ảnh mẫu); ảnh mẫu không quá sức mô hình.
  const { m: model, lc } = await layModelKhung(p.veAnh);
  const anhMau = p.anhMau.map((u) => hoanDiaChiKho(u)).filter((u) => u.startsWith("https://")).slice(0, Math.min(4, model.soAnhThamChieu));
  const deBai = p.deBai;

  // API vẽ ảnh của OpenRouter (POST /api/v1/images), như ảnh bài đăng (image-ai.ts).
  // Lưới tiền (mục f): tài khoản đang khoá thì không gửi yêu cầu trả phí.
  await chanNeuTaiKhoanKhoa(p.userId);
  const r = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouter.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.appUrl,
      "X-Title": "AI Sales",
    },
    body: JSON.stringify({
      model: model.id,
      prompt: deBai,
      n: 1,
      ...(lc.doNet ? { resolution: lc.doNet } : {}),
      ...(lc.chatLuong ? { quality: lc.chatLuong } : {}),
      // Khung của video nếu mô hình làm được; không thì cắt bằng ffmpeg bên dưới.
      ...(model.khung.includes(p.khung) ? { aspect_ratio: p.khung } : {}),
      ...(anhMau.length ? { input_references: anhMau.map((url) => ({ type: "image_url", image_url: { url } })) } : {}),
      user: `tk-${p.userId}`,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = (await r.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
    usage?: { cost?: number };
    data?: { b64_json?: string }[];
  };
  if (!r.ok || data.error) throw new AppError(`Vẽ khung mở đầu thất bại: ${loiNhaCungCap(r.status, data.error?.message)}`, 502);
  const base64 = data.data?.[0]?.b64_json;
  const tien = data.usage?.cost ?? giaAnh(model, { ...lc, soAnhVao: anhMau.length }) ?? GIA_KHUNG_UOC_TINH;
  // Ghi sổ trước mọi bước có thể hỏng phía sau.
  await ghiLuotAi({
    userId: p.userId,
    task: "image",
    viec: "khung_video",
    model: model.id,
    maNcc: data.id ?? null,
    costUsd: base64 ? tien : 0,
    loi: base64 ? null : "Không trả về ảnh nào",
  });
  if (!base64) throw new AppError("AI ảnh không trả về khung mở đầu.", 502);

  // Cắt đúng khung và độ nét của video: ảnh lệch tỷ lệ thì video ra lệch theo (đã đo 3 lần).
  const { rong, cao } = kichThuocKhung(p.khung, p.doNet);
  return voiThuMucTam(async (thuMuc) => {
    const vao = path.join(thuMuc, "vao");
    const ra = path.join(thuMuc, "khung.jpg");
    await fs.writeFile(vao, Buffer.from(base64, "base64"));
    await chayFfmpeg(
      ["-i", vao, "-vf", `scale=${rong}:${cao}:force_original_aspect_ratio=increase,crop=${rong}:${cao}`, "-frames:v", "1", "-q:v", "2", ra],
      60_000
    );
    return { url: await duaLenKho(ra, "image/jpeg", p.ten), tien };
  });
}

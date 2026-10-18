/**
 * Âm thanh AI: giọng đọc tiếng Việt và nhạc nền — để video dài có lời và nhạc
 * xuyên suốt.
 *
 * Vì sao không để mô hình video tự nói: đã tra 02/10/2026 — Veo 3.1 chỉ đánh
 * giá tiếng Anh, tiếng Việt "kết quả không bảo đảm", và không có cách giữ cùng
 * một giọng qua các clip. Mỗi clip một giọng thì nghe như nhiều người đọc. Nên
 * giọng đọc làm RIÊNG một lần bằng mô hình giọng đọc, nhạc làm RIÊNG một bài
 * dài bằng cả video, rồi trộn khi ghép.
 *
 * Mọi lượt đều ghi sổ AI ngay khi nhà cung cấp trả kết quả (xem so-ai.ts).
 */

import { loiNhaCungCap } from "./loi-ncc.js";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { MODEL_GIONG_DOC_DUOC_CHON, MODEL_NHAC_NEN } from "./model-duoc-chon.js";
import { ghiLuotAi } from "./so-ai.js";
import { chanNeuTaiKhoanKhoa } from "./tai-khoan-mo.js";

const GOC_API = "https://openrouter.ai/api/v1";

function dauGoi(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.openrouter.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": env.appUrl,
    "X-Title": "AI Sales",
  };
}

/** Giọng mặc định: giọng nữ ấm, rõ — hợp quảng cáo bán hàng. */
export const GIONG_MAC_DINH = "Kore";

/**
 * Ước tính tiền một lượt giọng đọc trước khi nhà cung cấp chốt số.
 * Gemini TTS tính theo token: chữ vào rẻ, âm thanh ra ~25 token mỗi giây.
 * Số thật lấy từ nhà cung cấp khi đối chiếu sổ.
 */
export function uocTinhTienGiong(model: string, soKyTu: number, soGiayAm: number): number {
  const m = MODEL_GIONG_DOC_DUOC_CHON.find((x) => x.id === model);
  if (!m) return 0;
  return (soKyTu / 4) * m.giaTokenVao + soGiayAm * 25 * m.giaTokenRa;
}

/**
 * Đọc một đoạn tiếng Việt thành giọng nói. Trả về tệp WAV.
 *
 * Gemini TTS CHỈ trả PCM thô (đã thử 02/10/2026: xin mp3 thì bị từ chối HTTP 400):
 * 16-bit, 24 kHz, một kênh — đóng thêm phần đầu WAV để ffmpeg đọc được.
 *
 * KHÔNG gửi lời dặn cách đọc kèm lời đọc. Đã gặp 02/10/2026 (dự án #9, cảnh 7):
 * gửi "Read in Vietnamese as a warm… Read noticeably faster: <lời>" thì giọng
 * AI ĐỌC TO CẢ LỜI DẶN tiếng Anh lên video quảng cáo, dài gấp ba, đè sang cảnh sau.
 */
export async function docThanhGiong(p: {
  userId: number;
  loiDoc: string;
  model?: string;
  giong?: string;
}): Promise<Buffer> {
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI nên chưa tạo được giọng đọc.", 503);
  const loiDoc = p.loiDoc.trim().slice(0, 1_500);
  if (!loiDoc) throw new AppError("Chưa có lời để đọc.", 400);
  const model = p.model ?? MODEL_GIONG_DOC_DUOC_CHON[0].id;
  if (!MODEL_GIONG_DOC_DUOC_CHON.some((m) => m.id === model)) throw new AppError("Mô hình giọng đọc không có trong danh sách.", 400);

  // Lưới tiền (mục f): tài khoản đang khoá thì không gửi yêu cầu trả phí.
  await chanNeuTaiKhoanKhoa(p.userId);
  const r = await fetch(`${GOC_API}/audio/speech`, {
    method: "POST",
    headers: dauGoi(),
    body: JSON.stringify({
      model,
      // Gemini TTS nhận lời dặn cách đọc đặt trước lời đọc.
      input: chuanBiDoc(loiDoc),
      voice: p.giong ?? GIONG_MAC_DINH,
      response_format: "pcm",
      user: `tk-${p.userId}`,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) {
    const loi = await r.text().catch(() => "");
    throw new AppError(`Không tạo được giọng đọc: ${loiNhaCungCap(r.status, loi.slice(0, 300))}`, 502);
  }
  const pcm = Buffer.from(await r.arrayBuffer());
  const soGiayUoc = pcm.length / (PCM_TAN_SO * 2);
  await ghiLuotAi({
    userId: p.userId,
    task: "content",
    viec: "giong_doc",
    model,
    maNcc: r.headers.get("x-generation-id"),
    costUsd: uocTinhTienGiong(model, loiDoc.length, soGiayUoc),
  });
  if (pcm.length < 1_000) throw new AppError("Giọng đọc trả về rỗng.", 502);
  return bocWav(pcm);
}

/**
 * Chuẩn bị lời cho giọng đọc (phụ đề vẫn dùng lời gốc): tách tên viết liền kiểu
 * "BrewManager" thành "Brew Manager". Đã nghe lại 02/10/2026: giọng tiếng Việt đọc
 * chữ viết liền mơ hồ — máy nghe ra "Pro Manager", "Bloom Manager".
 */
export function chuanBiDoc(loi: string): string {
  return loi.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2");
}

/** PCM của Gemini TTS: 16-bit, 24 kHz, một kênh. */
export const PCM_TAN_SO = 24_000;

/** Đóng phần đầu WAV (44 byte) cho PCM 16-bit một kênh. */
export function bocWav(pcm: Buffer, tanSo = PCM_TAN_SO): Buffer {
  const dau = Buffer.alloc(44);
  dau.write("RIFF", 0);
  dau.writeUInt32LE(36 + pcm.length, 4);
  dau.write("WAVE", 8);
  dau.write("fmt ", 12);
  dau.writeUInt32LE(16, 16);
  dau.writeUInt16LE(1, 20); // PCM
  dau.writeUInt16LE(1, 22); // một kênh
  dau.writeUInt32LE(tanSo, 24);
  dau.writeUInt32LE(tanSo * 2, 28);
  dau.writeUInt16LE(2, 32);
  dau.writeUInt16LE(16, 34);
  dau.write("data", 36);
  dau.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([dau, pcm]);
}

/**
 * Tạo một bài nhạc nền không lời. Trả về tệp âm thanh và đuôi tệp.
 *
 * Nhà cung cấp chỉ trả âm thanh qua luồng (stream): gom từng mẩu base64 lại.
 */
export async function taoNhacNen(p: {
  userId: number;
  moTa: string;
  soGiay: number;
  /** Có lời đọc chạy trên nhạc → nhạc chừa chỗ cho giọng (tiêu chí 9: âm thanh rõ, đồng bộ). */
  coLoiDoc?: boolean;
}): Promise<{ am: Buffer; duoi: string; tien: number }> {
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI nên chưa tạo được nhạc.", 503);
  const soGiay = Math.min(180, Math.max(15, Math.round(p.soGiay)));
  const yeuCau =
    `${p.moTa.trim().slice(0, 600)}\n\n` +
    // Không lời (tiêu chí 9: nhạc nền không tranh với lời đọc/lời thoại); thể loại, nhịp do mô tả quyết định.
    `Instrumental only, no vocals, no lyrics. About ${soGiay} seconds long.` +
    (p.coLoiDoc ? " Leaves room for a voice-over." : "");

  // Lưới tiền (mục f): tài khoản đang khoá thì không gửi yêu cầu trả phí.
  await chanNeuTaiKhoanKhoa(p.userId);
  const r = await fetch(`${GOC_API}/chat/completions`, {
    method: "POST",
    headers: dauGoi(),
    body: JSON.stringify({
      model: MODEL_NHAC_NEN.id,
      messages: [{ role: "user", content: yeuCau }],
      modalities: ["text", "audio"],
      audio: { format: "mp3" },
      stream: true,
      usage: { include: true },
      user: `tk-${p.userId}`,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok || !r.body) {
    const loi = await r.text().catch(() => "");
    throw new AppError(`Không tạo được nhạc nền: ${loiNhaCungCap(r.status, loi.slice(0, 300))}`, 502);
  }

  const manh: Buffer[] = [];
  let maNcc: string | null = null;
  let tien: number | null = null;
  let dinhDang = "mp3";
  let du = "";
  const giaiMa = new TextDecoder();
  for await (const khoi of r.body as unknown as AsyncIterable<Uint8Array>) {
    du += giaiMa.decode(khoi, { stream: true });
    const dong = du.split("\n");
    du = dong.pop() ?? "";
    for (const d of dong) {
      if (!d.startsWith("data:")) continue;
      const noi = d.slice(5).trim();
      if (!noi || noi === "[DONE]") continue;
      let j: Record<string, any>;
      try {
        j = JSON.parse(noi);
      } catch {
        continue;
      }
      if (typeof j.id === "string") maNcc = j.id;
      if (j.usage && Number.isFinite(Number(j.usage.cost))) tien = Number(j.usage.cost);
      const audio = j.choices?.[0]?.delta?.audio;
      if (typeof audio?.data === "string" && audio.data) manh.push(Buffer.from(audio.data, "base64"));
      if (typeof audio?.format === "string") dinhDang = audio.format;
    }
  }
  const am = Buffer.concat(manh);
  // Ghi sổ TRƯỚC khi kiểm kết quả: bị tính tiền mà hỏng vẫn là tiền đã mất.
  await ghiLuotAi({
    userId: p.userId,
    task: "content",
    viec: "nhac_nen",
    model: MODEL_NHAC_NEN.id,
    maNcc,
    costUsd: tien ?? MODEL_NHAC_NEN.giaMoiBai,
    loi: am.length < 10_000 ? "Nhạc trả về rỗng" : null,
  });
  if (am.length < 10_000) throw new AppError("Nhạc nền trả về rỗng.", 502);
  return { am, duoi: dinhDang === "wav" ? "wav" : "mp3", tien: tien ?? MODEL_NHAC_NEN.giaMoiBai };
}

/** Mô hình nghe giọng nói thành chữ — để tự kiểm giọng đọc có đọc đúng lời không. */
export const MODEL_NGHE = "google/gemini-3.5-transcribe";

/**
 * Nghe một đoạn âm thanh và trả lại chữ. Dùng để KIỂM giọng đọc: đã gặp
 * 02/10/2026 — một lượt đọc dài gấp đôi bình thường, nghi đọc cả lời dặn.
 */
export async function ngheThanhChu(p: { userId: number; am: Buffer; dinhDang: "wav" | "mp3"; model?: string }): Promise<string> {
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI.", 503);
  // Lưới tiền (mục f): tài khoản đang khoá thì không gửi yêu cầu trả phí.
  await chanNeuTaiKhoanKhoa(p.userId);
  const r = await fetch(`${GOC_API}/audio/transcriptions`, {
    method: "POST",
    headers: dauGoi(),
    body: JSON.stringify({
      model: p.model ?? MODEL_NGHE,
      input_audio: { data: p.am.toString("base64"), format: p.dinhDang },
      language: "vi",
      response_format: "json",
      user: `tk-${p.userId}`,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const j = (await r.json().catch(() => null)) as { text?: string; usage?: { cost?: number }; error?: { message?: string } } | null;
  if (!r.ok || !j) throw new AppError(`Không nghe được: ${loiNhaCungCap(r.status, j?.error?.message)}`, 502);
  await ghiLuotAi({
    userId: p.userId,
    task: "content",
    viec: "nghe_kiem_tra",
    model: p.model ?? MODEL_NGHE,
    maNcc: r.headers.get("x-generation-id"),
    costUsd: Number(j.usage?.cost) || 0,
  });
  return (j.text ?? "").trim();
}

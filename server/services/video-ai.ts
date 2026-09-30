/**
 * AI tạo video cho bài đăng.
 *
 * Đường đi: gửi việc tạo video sang OpenRouter → lưu mã việc → worker hỏi thăm
 * định kỳ → xong thì tải MP4 về và đưa lên kho media, dùng đúng luồng của ảnh
 * chủ shop tự tải lên. Video của nhà cung cấp chỉ giữ trong thời gian ngắn, nên
 * phải tự tải về ngay khi xong, kể cả khi chủ shop đã đóng trang.
 *
 * VỀ CHI PHÍ: video đắt hơn ảnh nhiều lần, và tiền trừ vào tài khoản AI của
 * chủ hệ thống. Nên:
 *   - mặc định TẮT, chủ shop phải tự bật cho từng trang;
 *   - luôn báo giá ước tính TRƯỚC khi tạo;
 *   - mọi lượt đều ghi vào ai_usage để biết shop nào tiêu bao nhiêu.
 */

import { query, queryOne } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { chatJson, asRecord, optionalString } from "./ai.js";
import { hoanDiaChiKho, laDiaChiKho } from "./media-proxy.js";
import * as zernio from "./zernio.js";

const GOC_API = "https://openrouter.ai/api/v1";

/** Một model video, đã chuẩn hoá từ danh sách của OpenRouter. */
export interface ModelVideo {
  id: string;
  ten: string;
  soGiay: number[];
  doNet: string[];
  khung: string[];
  kichThuoc: string[];
  coTieng: boolean;
  anhMoDau: boolean;
  giaSku: Record<string, number>;
}

export interface LuaChonVideo {
  soGiay: number;
  doNet: string;
  khung: string;
  coTieng: boolean;
  coAnhMoDau: boolean;
}

// ---------------------------------------------------------------------------
// Danh sách model — lấy SỐNG từ OpenRouter, giữ 1 giờ
// ---------------------------------------------------------------------------

let boNho: { luc: number; ds: ModelVideo[] } | null = null;
const GIU_DANH_SACH_MS = 60 * 60_000;

function soMang(v: unknown): number[] {
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
}
function chuMang(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function chuanHoaModel(m: Record<string, unknown>): ModelVideo | null {
  const id = typeof m.id === "string" ? m.id : "";
  if (!id) return null;
  const giaSku: Record<string, number> = {};
  for (const [k, v] of Object.entries(asRecord(m.pricing_skus))) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) giaSku[k] = n;
  }
  return {
    id,
    ten: typeof m.name === "string" ? m.name : id,
    soGiay: soMang(m.supported_durations).sort((a, b) => a - b),
    doNet: chuMang(m.supported_resolutions),
    khung: chuMang(m.supported_aspect_ratios),
    kichThuoc: chuMang(m.supported_sizes),
    coTieng: m.generate_audio === true,
    anhMoDau: chuMang(m.supported_frame_images).includes("first_frame"),
    giaSku,
  };
}

export async function layDanhSachModel(): Promise<ModelVideo[]> {
  if (boNho && Date.now() - boNho.luc < GIU_DANH_SACH_MS) return boNho.ds;
  if (!env.openrouter.apiKey) {
    throw new AppError("Chưa cấu hình khoá AI nên chưa tạo được video.", 503);
  }
  try {
    const r = await fetch(`${GOC_API}/videos/models`, {
      headers: { Authorization: `Bearer ${env.openrouter.apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { data?: unknown[] } | unknown[];
    const tho = Array.isArray(j) ? j : (j.data ?? []);
    const ds = tho
      .map((m) => chuanHoaModel(asRecord(m)))
      .filter((m): m is ModelVideo => m !== null && m.soGiay.length > 0);
    boNho = { luc: Date.now(), ds };
    return ds;
  } catch (error) {
    // Mất mạng thoáng qua thì dùng tạm danh sách cũ, còn hơn tắt hẳn tính năng.
    if (boNho) return boNho.ds;
    throw new AppError(
      `Chưa lấy được danh sách model video: ${error instanceof Error ? error.message : String(error)}`,
      502
    );
  }
}

// ---------------------------------------------------------------------------
// Tính giá
// ---------------------------------------------------------------------------

/** Cạnh ngắn của khung hình theo độ nét. */
const CANH_NGAN: Record<string, number> = {
  "480p": 480, "720p": 720, "768p": 768, "1080p": 1080, "1k": 1080, "2k": 1440, "4k": 2160,
};

/**
 * Số điểm ảnh mỗi khung hình. Ưu tiên kích thước model tự khai; không có thì
 * suy từ độ nét và tỷ lệ khung.
 */
export function dienTich(model: ModelVideo, doNet: string, khung: string): number | null {
  const ngan = CANH_NGAN[doNet.toLowerCase()];
  if (!ngan) return null;
  const [a, b] = khung.split(":").map(Number);
  if (!a || !b) return null;
  for (const kt of model.kichThuoc) {
    const [w, h] = kt.split("x").map(Number);
    if (!w || !h) continue;
    if (Math.min(w, h) === ngan && Math.abs(w / h - a / b) < 0.03) return w * h;
  }
  const dai = Math.round((ngan * Math.max(a, b)) / Math.min(a, b));
  return ngan * dai;
}

/**
 * Giá mỗi giây (USD) cho một lựa chọn, hoặc null nếu bảng giá không có mục
 * khớp — khi đó giao diện ghi "chưa rõ giá", không đoán bừa.
 *
 * Hai kiểu bảng giá:
 *   - theo giây: duration_seconds[_with_audio|_without_audio][_<độ nét>]
 *   - theo video token: token/giây = rộng × cao × 24 / 1024.
 *     Đã đối chiếu: ra đúng giá niêm yết 480p của Seedance 2.0, 2.0 Fast,
 *     2.0 Mini và 2.5 (0,0673 / 0,0403 / 0,0336 / 0,1028 USD mỗi giây).
 */
export function giaMoiGiay(model: ModelVideo, lc: LuaChonVideo): number | null {
  const g = model.giaSku;
  const net = lc.doNet.toLowerCase();
  const tieng = lc.coTieng && model.coTieng;
  const kieu = lc.coAnhMoDau ? "image_to_video" : "text_to_video";
  const thuTu = [
    ...(tieng
      ? [`duration_seconds_with_audio_${net}`, "duration_seconds_with_audio"]
      : [`duration_seconds_without_audio_${net}`, "duration_seconds_without_audio"]),
    `${kieu}_duration_seconds_${net}`,
    `duration_seconds_${net}`,
    "duration_seconds",
  ];
  for (const k of thuTu) if (g[k] !== undefined) return g[k];

  const giaToken =
    g[`video_tokens_${net}`] ??
    (!tieng ? g.video_tokens_without_audio : undefined) ??
    g.video_tokens;
  if (giaToken === undefined) return null;
  const dt = dienTich(model, lc.doNet, lc.khung);
  if (!dt) return null;
  return ((dt * 24) / 1024) * giaToken;
}

/** Lý do model không làm được lựa chọn này, hoặc null nếu làm được. */
export function lyDoKhongHop(model: ModelVideo, lc: LuaChonVideo): string | null {
  if (!model.soGiay.includes(lc.soGiay)) {
    return `chỉ làm ${model.soGiay[0]}–${model.soGiay[model.soGiay.length - 1]} giây` +
      (model.soGiay.length < model.soGiay[model.soGiay.length - 1] - model.soGiay[0] + 1
        ? ` (${model.soGiay.join(", ")} giây)`
        : "");
  }
  if (!model.doNet.includes(lc.doNet)) return `không có độ nét ${lc.doNet} (có ${model.doNet.join(", ")})`;
  if (!model.khung.includes(lc.khung)) return `không có khung ${lc.khung} (có ${model.khung.join(", ")})`;
  if (lc.coAnhMoDau && !model.anhMoDau) return "không nhận ảnh làm khung mở đầu";
  if (lc.coTieng && !model.coTieng) return "không tạo được tiếng";
  return null;
}

// ---------------------------------------------------------------------------
// Bật / tắt theo trang
// ---------------------------------------------------------------------------

export async function videoDangBat(trangId: number | null): Promise<boolean> {
  if (!trangId) return false;
  const row = await queryOne<{ settings: Record<string, unknown> | null }>(
    "SELECT settings FROM ai_configs WHERE trang_id = $1 AND kind = 'content'",
    [trangId]
  );
  return row?.settings?.videoBat === true;
}

// ---------------------------------------------------------------------------
// Trợ lý viết lời mô tả video
// ---------------------------------------------------------------------------

export const MUC_DICH_VIDEO: Record<string, string> = {
  khoe_san_pham: "khoe sản phẩm: cận cảnh chất liệu, chi tiết, xoay quanh sản phẩm",
  mo_hop: "mở hộp: tay người mở bao bì, lấy sản phẩm ra, cảm giác mới tinh",
  truoc_sau: "trước và sau khi dùng: vấn đề ban đầu rồi kết quả sau khi dùng sản phẩm",
  khuyen_mai: "khuyến mãi: nhịp nhanh, năng động, cảm giác cơ hội không nên bỏ lỡ",
  doi_thuong: "đời thường: người bình thường dùng sản phẩm tự nhiên trong cuộc sống hằng ngày",
};

/**
 * Luật an toàn, áp cho MỌI video, người dùng không sửa được.
 *
 * Model video viết chữ tiếng Việt gần như luôn sai dấu, sai chữ; và tự bịa nhãn
 * hiệu, huy hiệu chứng nhận thì thành quảng cáo sai sự thật — cùng lý do như
 * luật ảnh trong image-ai.ts.
 */
export const LUAT_VIDEO =
  "Strict rules: no on-screen text, captions, subtitles, numbers, logos, brand names, " +
  "watermarks, certification badges or award seals anywhere in the video. " +
  "Do not depict celebrities or any real identifiable person.";

export async function vietLoiMoTaVideo(params: {
  userId: number;
  noiDung: string;
  mucDich: string;
  soGiay: number;
  coAnhMoDau: boolean;
}): Promise<{ loiMoTa: string; tomTat: string }> {
  const noiDung = params.noiDung.trim().slice(0, 1_200);
  if (!noiDung) throw new AppError("Cần nội dung bài viết để AI biết video nói về gì.", 400);
  const mucDich = MUC_DICH_VIDEO[params.mucDich] ?? MUC_DICH_VIDEO.khoe_san_pham;
  const soCanh = params.soGiay <= 8 ? "ONE continuous shot" : params.soGiay <= 15 ? "2 shots" : "3 shots";

  const kq = await chatJson({
    task: "content",
    validate: (v) => {
      const o = asRecord(v);
      return { loiMoTa: optionalString(o.loiMoTa), tomTat: optionalString(o.tomTat) };
    },
    userId: params.userId,
    temperature: 0.7,
    maxTokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "You write prompts for AI video generation models, for short sales videos on Facebook.",
          "Return JSON: {\"loiMoTa\": English video prompt, \"tomTat\": one Vietnamese sentence describing the video}.",
          "Prompt rules:",
          `- Exactly ${params.soGiay} seconds, ${soCanh}.`,
          "- The first 2 seconds must grab attention (striking motion or close-up).",
          "- Describe subject, action, setting, camera movement, lighting and mood concretely.",
          "- Commercial quality, realistic, Vietnamese everyday context when people or places appear.",
          params.coAnhMoDau
            ? "- The video STARTS from the provided product photo: keep the product exactly as in the photo, animate from it."
            : "- Keep product packaging plain and unbranded.",
          "- Never ask for on-screen text, captions, logos or brand names.",
          "- Max 110 words. No markdown.",
        ].join("\n"),
      },
      { role: "user", content: `Video goal: ${mucDich}.\n\nSales post:\n"""${noiDung}"""` },
    ],
  });
  const loiMoTa = kq.output.loiMoTa;
  if (!loiMoTa) throw new AppError("AI chưa viết được lời mô tả video, thử lại.", 502);
  return { loiMoTa: loiMoTa.slice(0, 2_000), tomTat: kq.output.tomTat ?? "" };
}

// ---------------------------------------------------------------------------
// Tạo việc
// ---------------------------------------------------------------------------

export interface ViecVideo {
  id: number;
  model: string;
  loi_mo_ta: string;
  so_giay: number;
  do_net: string;
  khung: string;
  co_tieng: boolean;
  trang_thai: "dang_tao" | "xong" | "loi";
  gia_uoc_tinh: string | null;
  gia_thuc: string | null;
  url: string | null;
  loi: string | null;
  created_at: string;
  xong_at: string | null;
}

export const COT_VIEC =
  "id, model, loi_mo_ta, so_giay, do_net, khung, co_tieng, trang_thai, gia_uoc_tinh, gia_thuc, url, loi, created_at, xong_at";

/** Loại 401/403 của nhà cung cấp thành 502 — xem lý do ở image-ai.ts. */
function maLoi(status: number): number {
  return status === 401 || status === 403 ? 502 : status >= 400 && status < 500 ? status : 502;
}

export async function taoVideo(params: {
  userId: number;
  trangId: number;
  model: string;
  loiMoTa: string;
  lc: LuaChonVideo;
  anhMoDau?: string;
}): Promise<ViecVideo> {
  if (!(await videoDangBat(params.trangId))) {
    throw new AppError("Tạo video AI đang tắt. Bật trong phần soạn bài trước khi tạo.", 409);
  }
  const loiMoTa = params.loiMoTa.trim().slice(0, 2_000);
  if (!loiMoTa) throw new AppError("Cần lời mô tả video.", 400);

  const model = (await layDanhSachModel()).find((m) => m.id === params.model);
  if (!model) throw new AppError("Model video này không có hoặc đã ngừng.", 400);

  // Chỉ nhận ảnh trong kho của mình — không chuyển tiếp địa chỉ lạ cho bên AI.
  let anhMoDau: string | undefined;
  if (params.anhMoDau) {
    const that = hoanDiaChiKho(params.anhMoDau);
    if (!laDiaChiKho(that)) throw new AppError("Ảnh mở đầu không hợp lệ.", 400);
    anhMoDau = that;
  }
  const lc = { ...params.lc, coAnhMoDau: Boolean(anhMoDau) };
  const lyDo = lyDoKhongHop(model, lc);
  if (lyDo) throw new AppError(`Model này ${lyDo}.`, 400);

  const moiGiay = giaMoiGiay(model, lc);
  const giaUocTinh = moiGiay === null ? null : moiGiay * lc.soGiay;

  const than: Record<string, unknown> = {
    model: model.id,
    prompt: `${loiMoTa}\n\n${LUAT_VIDEO}`,
    duration: lc.soGiay,
    resolution: lc.doNet,
    aspect_ratio: lc.khung,
  };
  if (model.coTieng) than.generate_audio = lc.coTieng;
  if (anhMoDau) {
    than.frame_images = [{ type: "image_url", image_url: { url: anhMoDau }, frame_type: "first_frame" }];
  }

  let r: Response;
  try {
    r = await fetch(`${GOC_API}/videos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openrouter.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.appUrl,
      },
      body: JSON.stringify(than),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new AppError(
      `Không gọi được dịch vụ tạo video: ${error instanceof Error ? error.message : String(error)}`,
      502
    );
  }
  const j = asRecord(await r.json().catch(() => ({})));
  const maViec = optionalString(j.id);
  if (!r.ok || !maViec) {
    const loi = optionalString(asRecord(j.error).message) ?? `HTTP ${r.status}`;
    throw new AppError(`Tạo video thất bại: ${loi}`, maLoi(r.status));
  }

  const row = await queryOne<ViecVideo>(
    `INSERT INTO video_ai
       (user_id, trang_id, model, loi_mo_ta, so_giay, do_net, khung, co_tieng, anh_mo_dau, ma_viec, gia_uoc_tinh)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${COT_VIEC}`,
    [params.userId, params.trangId, model.id, loiMoTa, lc.soGiay, lc.doNet, lc.khung,
      model.coTieng && lc.coTieng, anhMoDau ?? null, maViec, giaUocTinh]
  );
  return row!;
}

// ---------------------------------------------------------------------------
// Worker: hỏi thăm việc đang tạo, xong thì cất video vào kho
// ---------------------------------------------------------------------------

/** Quá lâu vẫn chưa xong thì coi như hỏng, không hỏi mãi. */
const TOI_DA_PHUT = 40;

async function ketThuc(id: number, loi: string): Promise<void> {
  await query(
    `UPDATE video_ai SET trang_thai = 'loi', loi = $2, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [id, loi.slice(0, 500)]
  );
}

async function xuLyMotViec(v: { id: number; user_id: number; ma_viec: string; model: string; qua_han: boolean }): Promise<void> {
  const r = await fetch(`${GOC_API}/videos/${encodeURIComponent(v.ma_viec)}`, {
    headers: { Authorization: `Bearer ${env.openrouter.apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  const j = asRecord(await r.json().catch(() => ({})));
  const trangThai = optionalString(j.status) ?? "";

  if (trangThai === "failed" || trangThai === "cancelled" || trangThai === "expired") {
    const loi = optionalString(j.error) ?? optionalString(asRecord(j.error).message) ?? trangThai;
    await ketThuc(v.id, `Nhà cung cấp AI báo lỗi: ${loi}`);
    return;
  }
  if (trangThai !== "completed") {
    if (v.qua_han) await ketThuc(v.id, `Quá ${TOI_DA_PHUT} phút vẫn chưa tạo xong.`);
    return;
  }

  const dsUrl = Array.isArray(j.unsigned_urls) ? j.unsigned_urls : [];
  const nguon = typeof dsUrl[0] === "string" ? dsUrl[0] : `${GOC_API}/videos/${encodeURIComponent(v.ma_viec)}/content?index=0`;
  const tai = await fetch(nguon, {
    headers: { Authorization: `Bearer ${env.openrouter.apiKey}` },
    signal: AbortSignal.timeout(300_000),
  });
  if (!tai.ok) throw new Error(`tải video về hỏng: HTTP ${tai.status}`);
  const tep = Buffer.from(await tai.arrayBuffer());
  if (tep.length === 0) throw new Error("video tải về rỗng");

  const presign = await zernio.presignMedia({
    filename: `video-ai-${v.user_id}-${v.id}.mp4`,
    contentType: "video/mp4",
    size: tep.length,
  });
  const dua = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: new Uint8Array(tep),
    signal: AbortSignal.timeout(300_000),
  });
  if (!dua.ok) throw new Error(`đưa video lên kho hỏng: HTTP ${dua.status}`);

  const gia = Number(asRecord(j.usage).cost);
  const giaThuc = Number.isFinite(gia) ? gia : null;
  await query(
    `UPDATE video_ai SET trang_thai = 'xong', url = $2, gia_thuc = $3, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [v.id, presign.publicUrl, giaThuc]
  );
  await query(
    `INSERT INTO ai_usage (user_id, task, model, cost_usd) VALUES ($1, 'video', $2, $3)`,
    [v.user_id, v.model, giaThuc ?? 0]
  ).catch((error) => console.error("[video AI] Không ghi được tiền AI:", error));
}

/** Gọi định kỳ từ worker. Trả về số việc đã chốt (xong hoặc hỏng). */
export async function runDueVideoJobs(): Promise<number> {
  if (!env.openrouter.apiKey) return 0;
  /*
   * Nhận việc bằng một câu UPDATE có điều kiện: hai tiến trình (máy dev và máy
   * thật chung database) không bao giờ cùng tải một video. Việc bỏ dở quá 10
   * phút được nhận lại.
   */
  const viec = await query<{ id: number; user_id: number; ma_viec: string; model: string; qua_han: boolean }>(
    `UPDATE video_ai SET dang_xu_ly_tu = now()
      WHERE id IN (
        SELECT id FROM video_ai
         WHERE trang_thai = 'dang_tao' AND ma_viec IS NOT NULL
           AND updated_at < now() - interval '15 seconds'
           AND (dang_xu_ly_tu IS NULL OR dang_xu_ly_tu < now() - interval '10 minutes')
         ORDER BY created_at LIMIT 5)
     RETURNING id, user_id, ma_viec, model, created_at < now() - interval '${TOI_DA_PHUT} minutes' AS qua_han`
  );
  let daChot = 0;
  for (const v of viec.rows) {
    try {
      await xuLyMotViec(v);
    } catch (error) {
      console.error(`[video AI] Việc ${v.id}:`, error instanceof Error ? error.message : error);
    } finally {
      const con = await queryOne<{ trang_thai: string }>(
        `UPDATE video_ai SET dang_xu_ly_tu = NULL, updated_at = now()
          WHERE id = $1 AND trang_thai = 'dang_tao' RETURNING trang_thai`,
        [v.id]
      );
      if (!con) daChot++;
    }
  }
  return daChot;
}

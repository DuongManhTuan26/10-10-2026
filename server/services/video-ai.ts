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
import { chatJson, asRecord, banGhi, optionalString } from "./ai.js";
import { ghiLuotAi, type Viec } from "./so-ai.js";
import { MODEL_VIDEO_DUOC_CHON } from "./model-duoc-chon.js";
import { hoanDiaChiKho, laDiaChiKho } from "./media-proxy.js";
import * as zernio from "./zernio.js";
import { anhTheoKhung } from "./video-cong-cu.js";

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
  /** Phân khúc và thứ hạng — để khách thấy vì sao mô hình này được chọn. */
  phanKhuc?: string;
  xepHang?: string;
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
  for (const [k, v] of Object.entries(banGhi(m.pricing_skus))) {
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
    /*
     * CHỈ những mô hình đã chọn theo xếp hạng (model-duoc-chon.ts), theo đúng
     * thứ tự phân khúc. Nhà cung cấp gỡ mô hình nào thì nó tự biến khỏi danh sách.
     * Đã thấy: hiện cả 30 mô hình, gồm Sora 2 Pro đã bị OpenAI tắt và nhiều mô
     * hình hạng bét.
     */
    const tatCa = tho.map((m) => chuanHoaModel(banGhi(m))).filter((m): m is ModelVideo => m !== null && m.soGiay.length > 0);
    const ds = MODEL_VIDEO_DUOC_CHON.flatMap((c) => {
      const m = tatCa.find((x) => x.id === c.id);
      return m ? [{ ...m, phanKhuc: c.phanKhuc, xepHang: c.xepHang }] : [];
    });
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
 * Số điểm ảnh mỗi khung hình mà nhà cung cấp TÍNH TIỀN ở một độ nét.
 *
 * Lấy theo khung 16:9 cùng độ nét, cho MỌI khung hình. Đã đo ngày 01/10/2026
 * với Seedance 1.5 Pro 480p, 4 giây: khung nào cũng ra lượng điểm ảnh gần như
 * nhau, bất kể kích thước model tự khai (khai 480×480 mà trả 640×640):
 *   1:1  → 640×640 = 409.600   tiền thật 0,04656 USD
 *   3:4  → 560×752 = 421.120   tiền thật 0,04787 USD
 *   21:9 → 992×432 = 428.544   tiền thật 0,04871 USD
 *   9:16 → 496×864 = 428.544
 * Trước đây tính theo kích thước khai của từng khung thì báo giá lệch từ −44%
 * (1:1) tới +24% (21:9). Tính theo 16:9 (480×854 = 409.920) thì lệch dưới 5%.
 */
export function dienTichTinhTien(model: ModelVideo, doNet: string): number | null {
  const ngan = CANH_NGAN[doNet.toLowerCase()];
  if (!ngan) return null;
  for (const kt of model.kichThuoc) {
    const [w, h] = kt.split("x").map(Number);
    if (w && h && Math.min(w, h) === ngan && Math.abs(Math.max(w, h) / Math.min(w, h) - 16 / 9) < 0.03) return w * h;
  }
  return ngan * Math.round((ngan * 16) / 9);
}

/**
 * Kích thước chính xác model tự khai cho (độ nét, khung), ví dụ "480x854".
 *
 * Gửi kèm để ÉP đúng khung. Đã đo: có ảnh mở đầu hoặc ảnh tham chiếu vuông mà
 * chỉ gửi aspect_ratio 9:16 thì Seedance vẫn trả video vuông 640×640.
 */
export function kichThuocKhop(model: ModelVideo, doNet: string, khung: string): string | null {
  const ngan = CANH_NGAN[doNet.toLowerCase()];
  const [a, b] = khung.split(":").map(Number);
  if (!ngan || !a || !b) return null;
  const doc = a < b;
  for (const kt of model.kichThuoc) {
    const [w, h] = kt.split("x").map(Number);
    if (!w || !h) continue;
    if (Math.min(w, h) === ngan && Math.abs(w / h - a / b) < 0.03 && (w < h) === doc) return kt;
  }
  return null;
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
  const dt = dienTichTinhTien(model, lc.doNet);
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
    viec: "mo_ta_video",
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
  /** true nếu là video → video (sửa video có sẵn). */
  la_sua_video: boolean;
}

export const COT_VIEC =
  "id, model, loi_mo_ta, so_giay, do_net, khung, co_tieng, trang_thai, gia_uoc_tinh, gia_thuc, url, loi, created_at, xong_at, (video_nguon IS NOT NULL) AS la_sua_video";

/** Loại 401/403 của nhà cung cấp thành 502 — xem lý do ở image-ai.ts. */
function maLoi(status: number): number {
  return status === 401 || status === 403 ? 502 : status >= 400 && status < 500 ? status : 502;
}

/** Nhận một địa chỉ kho (dạng /media/… hoặc gốc), trả địa chỉ gốc; địa chỉ lạ thì từ chối. */
export function diaChiKhoHopLe(u: string, ten: string): string {
  const that = hoanDiaChiKho(u);
  if (!laDiaChiKho(that)) throw new AppError(`${ten} không hợp lệ.`, 400);
  return that;
}

/**
 * Gửi MỘT việc tạo video sang nhà cung cấp và ghi vào video_ai.
 *
 * Dùng chung cho video một cảnh, từng cảnh của video dài và video → video, để
 * mọi đường đều qua cùng luật an toàn, cùng cách ghi giá, cùng worker.
 */
export async function guiViecVideo(p: {
  userId: number;
  trangId: number;
  model: ModelVideo;
  loiMoTa: string;
  lc: LuaChonVideo;
  /** Địa chỉ gốc trong kho (đã kiểm). */
  anhMoDau?: string;
  anhThamChieu?: string[];
  duAnId?: number;
  thuTu?: number;
}): Promise<ViecVideo> {
  const lc = { ...p.lc, coAnhMoDau: Boolean(p.anhMoDau) };
  const moiGiay = giaMoiGiay(p.model, lc);
  const giaUocTinh = moiGiay === null ? null : moiGiay * lc.soGiay;

  const than: Record<string, unknown> = {
    model: p.model.id,
    prompt: `${p.loiMoTa}\n\n${LUAT_VIDEO}`,
    duration: lc.soGiay,
    resolution: lc.doNet,
    aspect_ratio: lc.khung,
  };
  const kichThuoc = kichThuocKhop(p.model, lc.doNet, lc.khung);
  if (kichThuoc) than.size = kichThuoc;
  if (p.model.coTieng) than.generate_audio = lc.coTieng;
  if (p.anhMoDau) {
    than.frame_images = [{ type: "image_url", image_url: { url: p.anhMoDau }, frame_type: "first_frame" }];
  } else if (p.anhThamChieu?.length) {
    // Có khung mở đầu thì nhà cung cấp bỏ qua ảnh tham chiếu, nên chỉ gửi khi không có.
    than.input_references = p.anhThamChieu.map((url) => ({ type: "image_url", image_url: { url } }));
  }

  const maViec = await goiTaoViec(than);
  const row = await queryOne<ViecVideo>(
    `INSERT INTO video_ai
       (user_id, trang_id, model, loi_mo_ta, so_giay, do_net, khung, co_tieng, anh_mo_dau,
        anh_tham_chieu, ma_viec, gia_uoc_tinh, du_an_id, thu_tu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)
     RETURNING ${COT_VIEC}`,
    [p.userId, p.trangId, p.model.id, p.loiMoTa, lc.soGiay, lc.doNet, lc.khung,
      p.model.coTieng && lc.coTieng, p.anhMoDau ?? null, JSON.stringify(p.anhThamChieu ?? []),
      maViec, giaUocTinh, p.duAnId ?? null, p.thuTu ?? null]
  );
  return row!;
}

/** POST /videos, trả mã việc. Lỗi của nhà cung cấp thành AppError tiếng Việt. */
export async function goiTaoViec(than: Record<string, unknown>): Promise<string> {
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
  const j = banGhi(await r.json().catch(() => ({})));
  const maViec = optionalString(j.id);
  if (!r.ok || !maViec) {
    const loi = optionalString(banGhi(j.error).message) ?? optionalString(j.error) ?? `HTTP ${r.status}`;
    throw new AppError(`Tạo video thất bại: ${loi}`, maLoi(r.status));
  }
  return maViec;
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
  const anhMoDau = params.anhMoDau ? diaChiKhoHopLe(params.anhMoDau, "Ảnh mở đầu") : undefined;
  const lc = { ...params.lc, coAnhMoDau: Boolean(anhMoDau) };
  const lyDo = lyDoKhongHop(model, lc);
  if (lyDo) throw new AppError(`Model này ${lyDo}.`, 400);

  const anhDungKhung = anhMoDau
    ? await anhTheoKhung(anhMoDau, lc.khung, lc.doNet, `mo-dau-${params.userId}-${Date.now()}.jpg`)
    : undefined;
  return guiViecVideo({ userId: params.userId, trangId: params.trangId, model, loiMoTa, lc, anhMoDau: anhDungKhung });
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

export interface ViecDangTao {
  id: number;
  user_id: number;
  ma_viec: string;
  model: string;
  qua_han: boolean;
  du_an_id: number | null;
  la_sua: boolean;
}

/** Video này sinh ra từ tính năng nào — để sao kê ghi đúng việc. */
export function viecCua(v: Pick<ViecDangTao, "la_sua" | "du_an_id">): Viec {
  if (v.la_sua) return "sua_video";
  if (v.du_an_id !== null) return "tao_canh_video_dai";
  return "tao_video";
}

/**
 * Ghi sổ ngay khi nhà cung cấp chốt việc — TRƯỚC bước tải về và đưa lên kho.
 * Đã thấy: ghi sau hai bước đó thì kho hỏng là video đã mất tiền mà sổ không
 * có dòng nào. Mã việc là duy nhất nên lần hỏi lại sau không ghi trùng.
 */
async function ghiTienVideo(v: ViecDangTao, j: Record<string, unknown>, loi: string | null): Promise<number | null> {
  const gia = Number(banGhi(j.usage).cost);
  const giaThuc = Number.isFinite(gia) ? gia : null;
  if (giaThuc !== null || !loi) {
    await ghiLuotAi({
      userId: v.user_id,
      task: "video",
      viec: viecCua(v),
      model: v.model,
      maNcc: v.ma_viec,
      costUsd: giaThuc ?? 0,
      loi,
    });
  }
  return giaThuc;
}

async function xuLyMotViec(v: ViecDangTao): Promise<void> {
  const r = await fetch(`${GOC_API}/videos/${encodeURIComponent(v.ma_viec)}`, {
    headers: { Authorization: `Bearer ${env.openrouter.apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  const j = banGhi(await r.json().catch(() => ({})));
  const trangThai = optionalString(j.status) ?? "";

  if (trangThai === "failed" || trangThai === "cancelled" || trangThai === "expired") {
    const loi = optionalString(j.error) ?? optionalString(banGhi(j.error).message) ?? trangThai;
    // Việc hỏng mà nhà cung cấp vẫn báo có tính tiền thì vẫn phải vào sổ.
    await ghiTienVideo(v, j, `Nhà cung cấp báo hỏng: ${loi}`.slice(0, 300));
    await ketThuc(v.id, `Nhà cung cấp AI báo lỗi: ${loi}`);
    return;
  }
  if (trangThai !== "completed") {
    if (v.qua_han) await ketThuc(v.id, `Quá ${TOI_DA_PHUT} phút vẫn chưa tạo xong.`);
    return;
  }

  const giaThuc = await ghiTienVideo(v, j, null);

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

  await query(
    `UPDATE video_ai SET trang_thai = 'xong', url = $2, gia_thuc = $3, dang_xu_ly_tu = NULL,
            updated_at = now(), xong_at = now() WHERE id = $1`,
    [v.id, presign.publicUrl, giaThuc]
  );
}

/** Gọi định kỳ từ worker. Trả về số việc đã chốt (xong hoặc hỏng). */
export async function runDueVideoJobs(): Promise<number> {
  if (!env.openrouter.apiKey) return 0;
  /*
   * Nhận việc bằng một câu UPDATE có điều kiện: hai tiến trình (máy dev và máy
   * thật chung database) không bao giờ cùng tải một video. Việc bỏ dở quá 10
   * phút được nhận lại.
   */
  const viec = await query<ViecDangTao>(
    `UPDATE video_ai SET dang_xu_ly_tu = now()
      WHERE id IN (
        SELECT id FROM video_ai
         WHERE trang_thai = 'dang_tao' AND ma_viec IS NOT NULL
           AND updated_at < now() - interval '15 seconds'
           AND (dang_xu_ly_tu IS NULL OR dang_xu_ly_tu < now() - interval '10 minutes')
         ORDER BY created_at LIMIT 5)
     RETURNING id, user_id, ma_viec, model, created_at < now() - interval '${TOI_DA_PHUT} minutes' AS qua_han,
               du_an_id, video_nguon IS NOT NULL AS la_sua`
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

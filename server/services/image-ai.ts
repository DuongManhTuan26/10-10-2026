/**
 * AI tạo ảnh minh hoạ cho bài đăng.
 *
 * Đường đi: gọi model sinh ảnh qua OpenRouter → nhận ảnh dạng base64 → tải
 * thẳng lên kho media của nhà cung cấp → trả về địa chỉ công khai để gắn vào
 * mediaItems của bài, dùng đúng luồng mà ảnh chủ shop tự tải lên vẫn đi.
 *
 * VỀ VIDEO: đã kiểm tra danh sách model thật ngày 14/09/2026 — có 11 model
 * sinh được ảnh, KHÔNG có model nào sinh được video. Nên phần này chỉ làm ảnh.
 *
 * VỀ CHI PHÍ: mỗi ảnh tốn tiền thật của chủ hệ thống (lượt thử đầu tiên hết
 * 0,0387 USD). Vì thế không bao giờ tự sinh ảnh ngầm — luôn phải do chủ shop
 * bấm, hoặc bật rõ trong lịch tự đăng.
 */

import type { LuatNoiDung } from "./video-ai.js";
import { chuanHoaModelAnh, giaAnh, MODEL_ANH_DUOC_CHON, type LuaChonAnh, type ModelAnh } from "./model-anh.js";
import { loiNhaCungCap } from "./loi-ncc.js";
import { query, queryOne } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { hoanDiaChiKho } from "./media-proxy.js";
import { ghiLuotAi } from "./so-ai.js";
import * as zernio from "./zernio.js";

/**
 * Mô hình vẽ khung mở đầu / ảnh mẫu nhân vật của VIDEO DÀI (việc nội bộ, khung-video.ts).
 * Ảnh bài đăng thì người dùng tự chọn mô hình (model-anh.ts), không dùng hằng số này.
 */
export const MODEL_ANH = "google/gemini-2.5-flash-image";

const GOC_API = "https://openrouter.ai/api/v1";

// ---------------------------------------------------------------------------
// Danh sách mô hình vẽ ảnh — lấy SỐNG từ OpenRouter, giữ 1 giờ
// ---------------------------------------------------------------------------

let boNhoAnh: { luc: number; ds: ModelAnh[] } | null = null;
const GIU_DANH_SACH_MS = 60 * 60_000;

/**
 * Chỉ những mô hình trong MODEL_ANH_DUOC_CHON, theo thứ tự rẻ tới đắt. Nhà cung cấp gỡ mô hình
 * nào (hoặc không còn nơi chạy) thì nó tự biến khỏi danh sách.
 */
export async function layDanhSachModelAnh(): Promise<ModelAnh[]> {
  if (boNhoAnh && Date.now() - boNhoAnh.luc < GIU_DANH_SACH_MS) return boNhoAnh.ds;
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI nên chưa tạo được ảnh.", 503);
  const dau = { Authorization: `Bearer ${env.openrouter.apiKey}` };
  try {
    const r = await fetch(`${GOC_API}/images/models`, { headers: dau, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { data?: Record<string, unknown>[] };
    const tatCa = j.data ?? [];
    const ds = (
      await Promise.all(
        MODEL_ANH_DUOC_CHON.map(async (c) => {
          const tho = tatCa.find((m) => m.id === c.id);
          if (!tho) return null;
          const re = await fetch(`${GOC_API}/images/models/${c.id}/endpoints`, { headers: dau, signal: AbortSignal.timeout(20_000) });
          if (!re.ok) return null;
          const ep = ((await re.json()) as { endpoints?: Record<string, unknown>[] }).endpoints?.[0];
          return ep ? chuanHoaModelAnh(tho, ep, c) : null;
        })
      )
    ).filter((m): m is ModelAnh => m !== null && giaAnh(m) !== null);
    boNhoAnh = { luc: Date.now(), ds };
    return ds;
  } catch (error) {
    // Mất mạng thoáng qua thì dùng tạm danh sách cũ, còn hơn tắt hẳn tính năng.
    if (boNhoAnh) return boNhoAnh.ds;
    throw new AppError(`Chưa lấy được danh sách mô hình vẽ ảnh: ${error instanceof Error ? error.message : String(error)}`, 502);
  }
}

/** Lựa chọn vẽ ảnh của người dùng — kiểm theo đúng khả năng mô hình, mục nào mô hình không có thì bỏ. */
export interface LuaChonVeAnh {
  model: string;
  doNet?: string;
  chatLuong?: string;
  khung?: string;
}

/**
 * Mô hình vẽ khung mở đầu / ảnh mẫu nhân vật của video dài: người dùng chọn; dự án cũ chưa chọn thì
 * lấy mô hình RẺ NHẤT nhận ảnh mẫu (chủ dự án: việc thường ngày dùng mô hình rẻ).
 */
export async function layModelKhung(veAnh: LuaChonVeAnh | undefined): Promise<{ m: ModelAnh; lc: LuaChonAnh }> {
  if (veAnh?.model) return layModelAnh(veAnh);
  const re = (await layDanhSachModelAnh())
    .filter((m) => m.soAnhThamChieu > 0)
    .sort((a, b) => (giaAnh(a, { soAnhVao: 2 }) ?? Infinity) - (giaAnh(b, { soAnhVao: 2 }) ?? Infinity))[0];
  if (!re) throw new AppError("Chưa có mô hình vẽ ảnh nào nhận ảnh mẫu để vẽ khung mở đầu.", 502);
  return layModelAnh({ model: re.id });
}

/** Giá một khung mở đầu (USD): mô hình đã chọn, kèm 2 ảnh mẫu (ảnh mẫu nhân vật + ảnh tham chiếu). */
export async function giaKhungVideo(veAnh: LuaChonVeAnh | undefined): Promise<number> {
  const { m, lc } = await layModelKhung(veAnh);
  return giaAnh(m, { ...lc, soAnhVao: Math.min(2, m.soAnhThamChieu) }) ?? 0;
}

export async function layModelAnh(lc: LuaChonVeAnh): Promise<{ m: ModelAnh; lc: LuaChonAnh }> {
  const m = (await layDanhSachModelAnh()).find((x) => x.id === lc.model);
  if (!m) throw new AppError("Mô hình vẽ ảnh này không có hoặc đã ngừng. Chọn mô hình khác.", 400);
  return {
    m,
    lc: {
      doNet: lc.doNet && m.doNet.includes(lc.doNet) ? lc.doNet : m.doNet[0],
      chatLuong: lc.chatLuong && m.chatLuong.includes(lc.chatLuong) ? lc.chatLuong : m.chatLuong[0],
      khung: lc.khung && m.khung.includes(lc.khung) ? lc.khung : undefined,
    },
  };
}

/**
 * Luật an toàn, áp cho mọi ảnh và không ai đổi được.
 *
 * Lượt thử đầu tiên model tự bịa tên thương hiệu "NATURE'S SOFTNESS" và huy
 * hiệu "ORGANIC & CRUELTY-FREE" lên hũ kem. Chủ shop đăng ảnh đó lên là quảng
 * cáo sai sự thật, đủ để bị khách kiện và bị nền tảng phạt.
 *
 * Ở đây CHỈ có luật an toàn. Phong cách là quyền của chủ shop — bản trước tôi
 * nhét luôn "ảnh chụp đời thường, bối cảnh Việt Nam" vào đây, và ảnh ra phẳng
 * lì, không có chiều sâu, không hút mắt.
 */
/**
 * Luật khi vẽ lại từ ẢNH MẪU của chủ shop.
 *
 * Khác hẳn vẽ từ chữ. Đã thử thật: đưa ảnh có chữ "Chatbot AI" và watermark
 * "dienthoaivui" vào, model xoá watermark nhưng GIỮ chữ lớn trong ảnh — hợp
 * lý, vì chữ đó là một phần của bố cục được yêu cầu giữ nguyên.
 *
 * Nên ở chế độ này không cấm chữ sạch trơn: chữ trên bao bì thật của shop là
 * chữ THẬT, xoá đi mới là sai. Chỉ cấm model TỰ THÊM nhãn hiệu mới.
 */
const LUAT_ANH_TU_MAU = [
  "LUẬT BẮT BUỘC, không được phong cách nào ghi đè:",
  "Giữ đúng chủ thể và bố cục chính của ảnh mẫu, chỉ đổi phong cách và chất lượng.",
  "TUYỆT ĐỐI không THÊM chữ nào không có trong ảnh mẫu.",
  // Tiêu chí 4 (nhất quán): vẽ lại từ ảnh mẫu thì người trong ảnh vẫn là người đó.
  "Không đổi mặt người trong ảnh thành người khác.",
].join(" ");

/**
 * Chữ trong ảnh do NGƯỜI DÙNG chọn (chủ dự án 03/10/2026: "có chữ hay không là do prompt điều hướng,
 * không phải mặc định") — cùng kiểu lựa chọn với video (ChuTrongVideo).
 *   - "khong": ảnh trống chữ hoàn toàn (LUAT_ANH, như trước).
 *   - "theo_noi_dung": chỉ có chữ ở chỗ yêu cầu nêu rõ, viết đúng y như yêu cầu.
 * Luật nội dung (nhãn hiệu, người thật, watermark) là lựa chọn riêng — xem LuatNoiDung.
 */
export type ChuTrongAnh = "theo_noi_dung" | "khong";

/**
 * Hai luật nội dung NGƯỜI DÙNG bật/tắt — không gài cứng (chủ dự án 03/10/2026, xem LuatNoiDung
 * trong video-ai.ts và căn cứ: Điều 32 BLDS 2015, chính sách quảng cáo Meta).
 */
export const LUAT_NHAN_HIEU_GIA_ANH =
  "TUYỆT ĐỐI không bịa tên thương hiệu, logo, con dấu, huy hiệu chứng nhận hay giải thưởng không có trong yêu cầu.";
export const LUAT_NGUOI_THAT_ANH = "Không ghép ảnh người nổi tiếng, không vẽ mặt người thật có thể nhận ra.";
/** Chỉ có nghĩa khi vẽ lại từ ảnh mẫu. */
export const LUAT_XOA_WATERMARK = "Xoá watermark và chữ chèn thêm của người khác.";

function luatThem(luat: LuatNoiDung, tuMau = false): string {
  return [
    luat.chanNhanHieuGia ? LUAT_NHAN_HIEU_GIA_ANH : "",
    luat.chanNguoiThat ? LUAT_NGUOI_THAT_ANH : "",
    tuMau && luat.xoaWatermark ? LUAT_XOA_WATERMARK : "",
  ].filter(Boolean).join(" ");
}

export function luatAnh(chu: ChuTrongAnh, luat: LuatNoiDung = {}): string {
  const chuLuat =
    chu === "khong"
      ? LUAT_ANH
      : "LUẬT BẮT BUỘC, không được phong cách nào ghi đè: chỉ có chữ ở đúng chỗ yêu cầu nêu rõ, viết đúng y từng chữ " +
        "và đúng dấu như yêu cầu; không thêm chữ nào khác.";
  const them = luatThem(luat);
  return them ? `${chuLuat} ${them}` : chuLuat;
}

export function luatAnhTuMau(chu: ChuTrongAnh, luat: LuatNoiDung = {}): string {
  const chuLuat =
    chu === "khong"
      ? LUAT_ANH_TU_MAU
      : [
          "LUẬT BẮT BUỘC, không được phong cách nào ghi đè:",
          "Giữ đúng chủ thể và bố cục chính của ảnh mẫu, chỉ đổi phong cách và chất lượng.",
          "Chỉ thêm chữ khi yêu cầu nêu rõ, viết đúng y chữ đó.",
          "Không đổi mặt người trong ảnh thành người khác.",
        ].join(" ");
  const them = luatThem(luat, true);
  return them ? `${chuLuat} ${them}` : chuLuat;
}

/** "Không có chữ": ảnh trống chữ hoàn toàn (cả tên thương hiệu, nhãn trên bao bì — đều là chữ). */
export const LUAT_ANH = [
  "LUẬT BẮT BUỘC, không được phong cách nào ghi đè:",
  "Ảnh phải TRỐNG CHỮ hoàn toàn — không chữ, không số, không nhãn dán, không khung chữ,",
  "KỂ CẢ ở hậu cảnh và kể cả khi bị làm mờ. Không vẽ tên thương hiệu hay logo. Bao bì trong ảnh phải trơn, không nhãn.",
].join(" ");

/**
 * Phong cách dùng khi chủ shop chưa đặt gì.
 *
 * Viết theo hướng ảnh thương mại có chiều sâu, vì mục đích của ảnh là kéo
 * người ta dừng lại đọc bài.
 */
export const PHONG_CACH_MAC_DINH =
  "Ảnh sản phẩm thương mại chất lượng cao: ánh sáng dịu có hướng rõ ràng, " +
  "hậu cảnh mờ sâu tách khỏi chủ thể, bố cục có điểm nhấn, màu sắc giàu và ấm, " +
  "chi tiết sắc nét, cảm giác sang và sạch, tỷ lệ vuông.";

export interface AnhDaTao {
  /** Địa chỉ công khai để gắn vào mediaItems của bài đăng. */
  url: string;
  type: "image";
  model: string;
  costUsd: number;
  /** Lời nhắc đã gửi cho model, để chủ shop biết ảnh dựa trên gì. */
  moTa: string;
  /** Phong cách đã dùng cho lượt này. */
  phongCach: string;
  /** true nếu ảnh được vẽ lại từ ảnh mẫu của chủ shop. */
  tuAnhMau: boolean;
}

/**
 * Tạo một ảnh minh hoạ từ nội dung bài viết.
 *
 * `noiDung` là chính bài đăng. Cắt ngắn trước khi gửi: model sinh ảnh chỉ cần
 * biết chủ đề, đưa cả bài dài chỉ làm nhiễu và tốn thêm tiền.
 */
/** Phong cách chủ shop đã lưu làm mặc định. */
export async function docPhongCachDaLuu(trangId: number | null): Promise<string> {
  if (!trangId) return PHONG_CACH_MAC_DINH;
  const row = await queryOne<{ settings: Record<string, unknown> | null }>(
    "SELECT settings FROM ai_configs WHERE trang_id = $1 AND kind = 'content'",
    [trangId]
  );
  const luu = row?.settings?.anhPhongCach;
  return typeof luu === "string" && luu.trim() !== "" ? luu.trim() : PHONG_CACH_MAC_DINH;
}

export async function taoAnhChoBai(params: {
  userId: number;
  /** Trang để lấy phong cách ảnh đã lưu. */
  trangId: number | null;
  noiDung: string;
  /** Mô tả riêng của chủ shop, nếu có thì ưu tiên hơn nội dung bài. */
  yeuCau?: string;
  /** Phong cách cho riêng lượt này. Bỏ trống thì lấy phong cách đã lưu. */
  phongCach?: string;
  /**
   * Ảnh mẫu của chủ shop. Có thì AI vẽ lại chính ảnh đó theo phong cách mới,
   * giữ nguyên chủ thể — thay vì bịa ra một cảnh hoàn toàn mới.
   */
  anhMau?: string;
  /** Người dùng chọn có chữ theo yêu cầu hay không chữ. */
  chuTrongAnh?: ChuTrongAnh;
  /** Người dùng bật/tắt luật nội dung. */
  luat?: LuatNoiDung;
  /** Mô hình và thông số do người dùng chọn (model-anh.ts) — không cố định. */
  veAnh: LuaChonVeAnh;
  /** Việc ghi sổ: bấm tay hoặc lịch tự đăng. */
  viec?: "tao_anh" | "tao_anh_tu_dong";
}): Promise<AnhDaTao> {
  if (!env.openrouter.apiKey) {
    throw new AppError("Chưa cấu hình khoá AI nên chưa tạo được ảnh.", 503);
  }

  const anhMau = params.anhMau ? hoanDiaChiKho(params.anhMau) : undefined;
  if (anhMau && !anhMau.startsWith("https://") && !anhMau.startsWith("data:image/")) {
    throw new AppError("Ảnh mẫu không hợp lệ.", 400);
  }

  const goc = (params.yeuCau?.trim() || params.noiDung.trim()).slice(0, 600);
  // Có ảnh mẫu thì bản thân ảnh đã là đề bài, không bắt buộc phải có chữ.
  if (!goc && !anhMau) {
    throw new AppError("Chưa có nội dung để AI dựa vào mà tạo ảnh.", 400);
  }

  const phongCach =
    params.phongCach?.trim() || (await docPhongCachDaLuu(params.trangId));

  /*
   * Thứ tự có chủ đích: phong cách đứng TRƯỚC để định hướng toàn bộ ảnh, nội
   * dung bài đứng giữa, luật an toàn đứng cuối để không bị phong cách ghi đè.
   */
  // Mô tả riêng (tạo ảnh độc lập, không theo bài) thì vẽ đúng mô tả, không gói thành "minh hoạ cho bài".
  const tuMoTa = Boolean(params.yeuCau?.trim());
  const deBai = anhMau
    ? goc
      ? tuMoTa
        ? `Vẽ lại ảnh mẫu kèm theo, theo mô tả sau: "${goc}".`
        : `Vẽ lại ảnh mẫu kèm theo, trong bối cảnh bài bán hàng sau: "${goc}".`
      : "Vẽ lại ảnh mẫu kèm theo theo phong cách trên."
    : tuMoTa
      ? `Vẽ ảnh theo mô tả sau: "${goc}".`
      : `Ảnh minh hoạ cho bài bán hàng sau: "${goc}".`;

  const { m: model, lc } = await layModelAnh(params.veAnh);
  if (anhMau && model.soAnhThamChieu < 1) {
    throw new AppError(`${model.ten} không nhận ảnh mẫu. Chọn mô hình khác để vẽ lại từ ảnh mẫu.`, 400);
  }

  const chu: ChuTrongAnh = params.chuTrongAnh === "khong" ? "khong" : "theo_noi_dung";
  const moTa = `${phongCach}\n\n${deBai}\n\n${anhMau ? luatAnhTuMau(chu, params.luat) : luatAnh(chu, params.luat)}`;

  let response: Response;
  try {
    /*
     * API vẽ ảnh của OpenRouter (POST /api/v1/images — tài liệu "Image generation"):
     * model, prompt, resolution, aspect_ratio, quality, input_references [{type:"image_url"…}];
     * trả data[0].b64_json + media_type, usage.cost.
     */
    response = await fetch(`${GOC_API}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openrouter.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.appUrl,
        "X-Title": "Zernio AI Sales",
      },
      body: JSON.stringify({
        model: model.id,
        prompt: moTa,
        n: 1,
        ...(lc.doNet ? { resolution: lc.doNet } : {}),
        ...(lc.khung ? { aspect_ratio: lc.khung } : {}),
        ...(lc.chatLuong ? { quality: lc.chatLuong } : {}),
        ...(anhMau ? { input_references: [{ type: "image_url", image_url: { url: anhMau } }] } : {}),
        user: `tk-${params.userId}`,
      }),
      // Sinh ảnh lâu hơn sinh chữ nhiều.
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new AppError(
      `Không gọi được dịch vụ tạo ảnh: ${error instanceof Error ? error.message : String(error)}`,
      502
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
    usage?: { cost?: number };
    data?: { b64_json?: string; media_type?: string; url?: string }[];
  };

  if (!response.ok || data.error) {
    /*
     * 401/403 ở đây là nhà cung cấp từ chối KHOÁ của hệ thống, không phải
     * phiên của người dùng hết hạn. Đã đo: chuyển nguyên 401 ra ngoài thì giao
     * diện coi là hết phiên và đá người dùng về màn hình đăng nhập — đổi khoá
     * AI mà dán nhầm là mọi người bấm tạo ảnh đều bị đăng xuất.
     */
    const ma =
      response.status === 401 || response.status === 403
        ? 502
        : response.status >= 400 && response.status < 500
          ? response.status
          : 502;
    throw new AppError(`Tạo ảnh thất bại: ${loiNhaCungCap(response.status, data.error?.message)}`, ma);
  }

  const anh = data.data?.[0];
  const duLieu = anh?.b64_json ? `data:${anh.media_type ?? "image/png"};base64,${anh.b64_json}` : undefined;
  // Nhà cung cấp không báo tiền thì ghi theo bảng giá — sổ không bao giờ để 0 cho ảnh đã tính tiền.
  const tien = data.usage?.cost ?? giaAnh(model, { ...lc, soAnhVao: anhMau ? 1 : 0 }) ?? 0;

  /*
   * Ghi sổ NGAY khi nhà cung cấp đã tính tiền — trước mọi bước có thể hỏng
   * phía sau. Đã thấy: ghi sau bước đưa lên kho thì kho hỏng là ảnh đã mất
   * tiền mà sổ không có dòng nào.
   */
  await ghiLuotAi({
    userId: params.userId,
    task: "image",
    viec: params.viec ?? "tao_anh",
    model: model.id,
    maNcc: data.id ?? null,
    costUsd: duLieu ? tien : 0,
    loi: duLieu?.startsWith("data:") ? null : "Không trả về ảnh nào",
  });

  if (!duLieu?.startsWith("data:")) {
    throw new AppError(
      "Dịch vụ tạo ảnh không trả về ảnh nào. Thử lại, hoặc đổi cách mô tả.",
      502
    );
  }

  const [phanDau, base64] = duLieu.split(",", 2);
  const contentType = /^data:([^;]+)/.exec(phanDau ?? "")?.[1] ?? "image/png";
  if (!base64) throw new AppError("Ảnh trả về không đọc được.", 502);

  const tep = Buffer.from(base64, "base64");

  // Đi đúng luồng của ảnh chủ shop tự tải lên: xin địa chỉ tạm rồi PUT thẳng.
  const duoi = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] || "png";
  const presign = await zernio.presignMedia({
    filename: `ai-${params.userId}-${Date.now()}.${duoi}`,
    contentType,
    size: tep.length,
  });

  const dua = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(tep),
    signal: AbortSignal.timeout(120_000),
  });
  if (!dua.ok) {
    throw new AppError(`Không tải được ảnh vừa tạo lên kho (HTTP ${dua.status}).`, 502);
  }

  return {
    url: presign.publicUrl,
    type: "image",
    model: model.id,
    costUsd: tien,
    moTa: goc,
    phongCach,
    tuAnhMau: Boolean(anhMau),
  };
}

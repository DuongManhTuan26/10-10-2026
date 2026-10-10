/**
 * Mô hình VẼ ẢNH được phép gọi — cùng quy tắc với video (model-duoc-chon.ts):
 * CHỈ BỎ mô hình hạng bét / không ai dùng / bản cũ đã có bản mới tốt hơn mà rẻ bằng hoặc
 * rẻ hơn; GIỮ mọi mô hình nổi tiếng, tốt. Người dùng chọn từ rẻ tới đắt (chủ dự án 03/10/2026:
 * "bình thường để AI tạo tự động đăng hàng ngày chỉ cần mô hình rẻ… khi cần tạo đẹp mới chuyển").
 *
 * Nguồn xếp hạng: Artificial Analysis AA-Image-T2I v2.0 (bỏ phiếu mù của người thật), đo 03/10/2026.
 * Nguồn danh mục + giá: OpenRouter /api/v1/images/models và /endpoints (lấy sống, giữ 1 giờ).
 *
 * Đã bỏ (lý do):
 *   - Bản cũ có bản mới tốt hơn, rẻ bằng/hơn: Gemini 2.5 Flash Image (hạng 58, 0,039) → 3.1 Flash Lite
 *     (hạng 13, 0,034); GPT Image 1 / GPT Image 2 / GPT-5 Image / GPT-5 Image Mini / GPT-5.4 Image 2 →
 *     GPT Image 2.5 cùng giá; MAI-Image-2.5 và 2.5-Pro → 2.6; Seedream 4.5 → 5.0; Grok Imagine Image
 *     Quality → 2.0; FLUX.2 flex (tính cả tiền ảnh vào) → FLUX.2 pro / max.
 *   - Chuyên vẽ logo / vector, không hợp ảnh bài đăng: Recraft V3, V4, V4 Pro, các bản vector, styles.
 *   - Không có giá trên nhà cung cấp (không báo giá được): Krea 2 (Large / Medium / Turbo).
 *   - Không có nơi chạy: Meta Muse Image (danh mục có, không có endpoint).
 *   - Ít tên tuổi, không có trên bảng xếp hạng: Riverflow, Ming-Image, FLUX.2 klein 4B.
 *   - KHÔNG VẼ ĐƯỢC TIẾNG VIỆT: MAI-Image 2.6 và 2.6 Flash (Microsoft). Đo thật 03/10/2026 qua đúng
 *     đường app: lời nhắc tiếng Việt bị chặn 3/3 lần ("Response content blocked by label
 *     'DallEBlockList'") — kể cả câu vô hại "Túi cà phê rang xay 500g trên bàn gỗ" — ở cả hai bản;
 *     tiếng Anh vẽ được 1/1. Cùng bài đó, GPT Image 1 Mini, Seedream 5.0 Flash, Nano Banana 2 Lite
 *     đều vẽ được. Bài đánh giá ngoài ghi dòng MAI-Image chỉ nhận lời nhắc tiếng Anh.
 */

export const NGUON_XEP_HANG_ANH = "Artificial Analysis AA-Image-T2I v2.0, đo 03/10/2026";

export interface ModelAnhDuocChon {
  id: string;
  xepHang: string;
  /**
   * Mô hình tính tiền theo TOKEN: số token ra của một ảnh, theo độ nét hoặc chất lượng.
   * Khoá "" = một mức chung. Nguồn ghi ở từng mô hình.
   */
  tokenMoiAnh?: Record<string, number>;
}

/** Thứ tự = rẻ tới đắt theo giá thấp nhất (đo 03/10/2026); app luôn tính lại giá sống. */
export const MODEL_ANH_DUOC_CHON: ModelAnhDuocChon[] = [
  // ~0,002 (thấp) / 0,008 (vừa) / 0,033 (cao). Token: OpenAI, ảnh 1024×1024 — 272 / 1056 / 4160.
  { id: "openai/gpt-image-1-mini", xepHang: "Hạng 89 (chất lượng vừa)", tokenMoiAnh: { low: 272, medium: 1056, high: 4160 } },
  // 0,007.
  { id: "recraft/recraft-v4.1-flash", xepHang: "Hạng 75" },
  // 0,018. Mới (02/10/2026), chưa lên bảng.
  { id: "bytedance-seed/seedream-5-0-flash", xepHang: "Chưa xếp hạng (mô hình mới)" },
  // 0,03 / megapixel.
  { id: "black-forest-labs/flux.2-pro", xepHang: "Hạng 41" },
  // 0,03.
  { id: "qwen/qwen-image-3", xepHang: "Hạng 16" },
  // 0,0336. Token: Google — 1.120 token / ảnh 1K.
  { id: "google/gemini-3.1-flash-lite-image", xepHang: "Hạng 13", tokenMoiAnh: { "1K": 1120 } },
  // 0,035, 2K/4K.
  { id: "bytedance-seed/seedream-5-0-lite", xepHang: "Hạng 36" },
  // 0,035.
  { id: "recraft/recraft-v4.1-utility", xepHang: "Hạng 25" },
  // 0,04 (1K) / 0,075 (2K).
  { id: "qwen/qwen-image-3-pro", xepHang: "Hạng 14" },
  // 0,04–0,08.
  { id: "x-ai/grok-imagine-image-2.0", xepHang: "Hạng 4" },
  // 0,041 (768) – 0,607 (4K). Mới, chưa lên bảng.
  { id: "black-forest-labs/flux-3-image", xepHang: "Chưa xếp hạng (mô hình mới)" },
  // 0,045 / 0,09 (độ nét cao).
  { id: "bytedance-seed/seedream-5-0-pro", xepHang: "Hạng 15" },
  // 0,045 (512) – 0,151 (4K). Token: Google — 747 / 1.120 / 1.680 / 2.520.
  { id: "google/gemini-3.1-flash-image", xepHang: "Hạng 6", tokenMoiAnh: { "512": 747, "1K": 1120, "2K": 1680, "4K": 2520 } },
  // 0,07 / megapixel.
  { id: "black-forest-labs/flux.2-max", xepHang: "Hạng 28" },
  // 0,134 (1K/2K) / 0,24 (4K). Token: Google — 1.120 / 1.120 / 2.000.
  { id: "google/gemini-3-pro-image", xepHang: "Hạng 11", tokenMoiAnh: { "1K": 1120, "2K": 1120, "4K": 2000 } },
  // 0,006 (thấp) / 0,053 (vừa) / 0,211 (cao), ảnh 1024×1024 — theo bảng giá GPT Image 2 (bản 2.5 cùng bảng giá).
  { id: "openai/gpt-image-2.5-flare", xepHang: "Hạng 2 (chất lượng cao nhất)", tokenMoiAnh: { low: 200, medium: 1767, high: 7033 } },
  { id: "openai/gpt-image-2.5-sunburst", xepHang: "Hạng 1 (chất lượng cao nhất)", tokenMoiAnh: { low: 200, medium: 1767, high: 7033 } },
];

/** Một mục giá của nhà cung cấp (OpenRouter /images/models/:id/endpoints → pricing). */
export interface MucGia {
  billable: string;
  unit: string;
  cost_usd: number;
  variant?: string;
}

export interface ModelAnh {
  id: string;
  ten: string;
  xepHang: string;
  /** Độ nét chọn được (1K, 2K, 4K…). Rỗng = mô hình tự quyết. */
  doNet: string[];
  /** Chất lượng chọn được (low, medium, high). Rỗng = không có tuỳ chọn. */
  chatLuong: string[];
  khung: string[];
  /** Số ảnh tham chiếu tối đa (vẽ lại từ ảnh mẫu). 0 = không nhận ảnh. */
  soAnhThamChieu: number;
  gia: MucGia[];
  tokenMoiAnh?: Record<string, number>;
}

export interface LuaChonAnh {
  doNet?: string;
  chatLuong?: string;
  khung?: string;
  /** Số ảnh mẫu đưa vào. */
  soAnhVao?: number;
}

/** Chất lượng không đưa ra cho người dùng: "auto" (không biết trước giá), xhigh/max (chưa có giá công bố). */
const CHAT_LUONG_BAO_GIA_DUOC = ["low", "medium", "high"];

/** Megapixel của một ảnh theo độ nét (mặc định 1024×1024 ≈ 1,05 MP). */
const MEGAPIXEL: Record<string, number> = { "512": 0.26, "768": 0.59, "1K": 1.05, "1.5K": 2.36, "2K": 4.19, "4K": 16.78 };

/**
 * Giá MỘT ảnh (USD) theo đúng lựa chọn, hoặc null nếu không báo giá được.
 *
 * Ba kiểu bảng giá của nhà cung cấp:
 *   - theo ảnh (unit "image"), có thể chia biến thể: "1k", "2k", "low_1k", "high_resolution"…;
 *   - theo megapixel;
 *   - theo token: × số token ra của một ảnh (tokenMoiAnh — tài liệu hãng).
 * Cộng thêm tiền ảnh mẫu đưa vào nếu mô hình tính theo ảnh vào.
 */
export function giaAnh(m: ModelAnh, lc: LuaChonAnh = {}): number | null {
  const doNet = lc.doNet ?? m.doNet[0];
  const chatLuong = lc.chatLuong ?? m.chatLuong[0];
  const ra = m.gia.filter((g) => g.billable === "output_image");
  if (!ra.length) return null;

  let gia: number | null = null;
  const theoAnh = ra.filter((g) => g.unit === "image");
  if (theoAnh.length) {
    const khoa = [chatLuong && doNet ? `${chatLuong}_${doNet}` : "", doNet ?? "", chatLuong ?? ""]
      .filter(Boolean)
      .map((k) => k.toLowerCase());
    const dung = theoAnh.find((g) => g.variant && khoa.includes(g.variant.toLowerCase()));
    const cao = theoAnh.find((g) => g.variant === "high_resolution");
    const goc = theoAnh.find((g) => !g.variant);
    // "high_resolution" = mọi độ nét trên mức thấp nhất (Seedream 5.0 Pro: 1K thường, 2K cao).
    gia = (dung ?? (cao && doNet && m.doNet.indexOf(doNet) > 0 ? cao : goc) ?? theoAnh[0]).cost_usd;
  } else {
    const mp = ra.find((g) => g.unit === "megapixel");
    const tk = ra.find((g) => g.unit === "token");
    if (mp) gia = mp.cost_usd * (MEGAPIXEL[doNet ?? "1K"] ?? MEGAPIXEL["1K"]);
    else if (tk && m.tokenMoiAnh) {
      const so = m.tokenMoiAnh[chatLuong ?? ""] ?? m.tokenMoiAnh[doNet ?? ""] ?? m.tokenMoiAnh[""];
      if (so !== undefined) gia = tk.cost_usd * so;
    }
  }
  if (gia === null) return null;

  const vao = m.gia.find((g) => g.billable === "input_image" && g.unit === "image");
  return gia + (vao ? vao.cost_usd * (lc.soAnhVao ?? 0) : 0);
}

/** Phân khúc theo GIÁ THẬT của đúng lựa chọn (USD/ảnh). */
export function phanKhucAnh(usd: number): string {
  if (usd < 0.02) return "Tiết kiệm";
  if (usd < 0.06) return "Tầm trung";
  return "Cao cấp";
}

function banGhi(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function chuMang(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Đọc một mô hình từ danh mục + endpoint đầu tiên của nhà cung cấp. */
export function chuanHoaModelAnh(tho: Record<string, unknown>, ep: Record<string, unknown>, c: ModelAnhDuocChon): ModelAnh {
  const tham = banGhi(ep.supported_parameters);
  const gia = (Array.isArray(ep.pricing) ? ep.pricing : [])
    .map(banGhi)
    .filter((g) => typeof g.billable === "string" && typeof g.unit === "string" && Number.isFinite(Number(g.cost_usd)))
    .map((g) => ({
      billable: String(g.billable),
      unit: String(g.unit),
      cost_usd: Number(g.cost_usd),
      ...(typeof g.variant === "string" ? { variant: g.variant } : {}),
    }));
  const chatLuong = chuMang(banGhi(tham.quality).values).filter((q) => CHAT_LUONG_BAO_GIA_DUOC.includes(q));
  return {
    id: c.id,
    ten: typeof tho.name === "string" ? tho.name : c.id,
    xepHang: c.xepHang,
    doNet: chuMang(banGhi(tham.resolution).values),
    // Mô hình tính theo token có chất lượng: chỉ giữ mức có số token công bố (không thì không báo giá được).
    chatLuong: c.tokenMoiAnh ? chatLuong.filter((q) => c.tokenMoiAnh![q] !== undefined) : chatLuong,
    khung: chuMang(banGhi(tham.aspect_ratio).values).filter((k) => k !== "auto"),
    soAnhThamChieu: Math.max(0, Number(banGhi(tham.input_references).max) || 0),
    gia,
    ...(c.tokenMoiAnh ? { tokenMoiAnh: c.tokenMoiAnh } : {}),
  };
}

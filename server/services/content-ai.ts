/**
 * AI viết bài đăng.
 *
 * Tách khỏi route /ai/generate-post vì bộ tự động cũng phải viết bài, mà nó
 * chạy trong worker nên không có req/res để mượn. Cả hai nơi gọi cùng một hàm
 * thì lời huấn luyện và tài liệu của shop luôn được áp dụng như nhau — bài AI
 * tự viết lúc 8 giờ sáng đọc lên phải giống hệt bài chủ shop bấm viết tay.
 */

import { query, queryOne } from "../db.js";
import { coTaiLieu, docTaiLieu } from "./knowledge.js";
import { moTaGiong } from "./giong-dieu.js";
import { chatJson, asRecord, stringArray } from "./ai.js";
import { boMarkdown, DAN_KHONG_MARKDOWN } from "./text.js";

export const GOAL_INSTRUCTIONS: Record<string, string> = {
  sales:
    "Mục tiêu BÁN HÀNG: nêu bật lợi ích, tạo lý do mua ngay, kết bằng lời kêu gọi hành động rõ ràng.",
  engagement:
    "Mục tiêu TĂNG TƯƠNG TÁC: đặt câu hỏi mở hoặc tạo tình huống khiến người đọc muốn bình luận.",
  announcement:
    "Mục tiêu THÔNG BÁO: truyền đạt thông tin rõ ràng, ngắn gọn, chuyên nghiệp.",
};

export interface GeneratedContent {
  options: string[];
  usage: { costUsd: number };
}

/**
 * Viết `count` phương án cho một chủ đề.
 *
 * `tranhLap` là vài bài gần đây của chính shop. Không có nó thì AI viết cùng
 * một chủ đề hai tuần liên tiếp sẽ ra hai bài na ná nhau — và Zernio chặn
 * trùng nội dung trong 24 giờ, còn Facebook thì coi việc đăng lặp là dấu hiệu
 * của tài khoản máy.
 */
/*
 * H15 (24/10/2026): AI Nội dung BỊA cam kết khi cửa hàng chưa có tài liệu — đo thật (cửa hàng 12, 0 tài liệu): "mỗi sản phẩm
 * được team tự tay dùng thử", "hỗ trợ đổi trả nếu lỗi do nhà sản xuất", "mẫu hot có hạn vì khách đặt liên tục", đoán shop
 * bán "đồ gia dụng" từ tên Fanpage. AI Bán hàng đã có nhánh tương đương (CHUA_CO_TAI_LIEU, mục C). Cùng chỗ quyết định
 * coTaiLieu (knowledge.ts).
 */
export const CHUA_CO_TAI_LIEU_BAI_VIET = [
  "CỬA HÀNG CHƯA NẠP TÀI LIỆU SẢN PHẨM NÀO.",
  "Chỉ viết đúng theo chủ đề chủ shop đưa ra; KHÔNG đoán cửa hàng bán mặt hàng gì ngoài chủ đề đó (kể cả đoán từ tên Fanpage).",
  "Được viết: giới thiệu chung, câu chuyện, lợi ích thường thấy của loại hàng trong chủ đề, mời khách nhắn tin để được tư vấn.",
  "TUYỆT ĐỐI KHÔNG viết (không có tài liệu thì mọi câu loại này đều là bịa):",
  "- giá, khuyến mãi, chiết khấu, quà tặng, ưu đãi",
  "- còn hàng / sắp hết / số lượng có hạn / khách đặt nhiều",
  "- phí hay thời gian giao hàng, đổi trả, bảo hành, hoàn tiền",
  "- thành phần, công dụng cụ thể, xuất xứ, giấy chứng nhận, đã kiểm định, đã dùng thử",
].join("\n");

/** Khối tài liệu của lời dặn viết bài: có tài liệu → nội dung + chỉ cam kết những gì có trong đó; chưa có → nhánh cấm. */
export function khoiTaiLieuBaiViet(tl: { noiDung: string }): string {
  return coTaiLieu(tl)
    ? "\n\nTHÔNG TIN SẢN PHẨM VÀ VĂN PHONG CỦA SHOP:\n" + tl.noiDung +
        "\n\nGiá, khuyến mãi, chính sách và cam kết CHỈ được viết khi có trong phần thông tin trên; không có thì không viết."
    : "\n\n" + CHUA_CO_TAI_LIEU_BAI_VIET;
}

/** Tên Fanpage của cửa hàng (nguyên văn, ưu tiên Facebook đang nối) — để AI viết đúng tên riêng. Không có → null. */
export async function tenFanpageCuaCuaHang(trangId: number | null): Promise<string | null> {
  if (trangId == null) return null;
  const r = await queryOne<{ ten: string }>(
    `SELECT coalesce(nullif(display_name, ''), username) AS ten FROM social_accounts
      WHERE trang_id = $1 AND connected = TRUE AND go_luc IS NULL AND platform <> 'metaads'
      ORDER BY (platform = 'facebook') DESC, created_at LIMIT 1`,
    [trangId]
  );
  return r?.ten?.trim() || null;
}

export function dongTenFanpage(ten: string): string {
  return `Tên Fanpage của cửa hàng: "${ten}" — khi nhắc tên thì viết đúng nguyên văn như vậy.`;
}

export async function generatePostContent(params: {
  userId: number;
  /*
   * Trang viết bài cho. Vai trò và tài liệu viết nội dung gắn theo TRANG:
   * Trang bán quần lót và Trang bán bột sắn dây phải viết khác nhau, và Meta
   * còn phạt nội dung trùng lặp giữa các Trang.
   */
  trangId: number | null;
  topic: string;
  goal?: string;
  count?: number;
  tranhLap?: string[];
  /** Viết tay hay viết tự động theo lịch — sao kê tách riêng hai khoản. */
  viec: "viet_bai" | "viet_bai_tu_dong";
  /**
   * Trần độ dài của kênh khó tính nhất trong số sẽ đăng.
   *
   * Không truyền vào thì AI viết dài tuỳ ý, rồi lệnh đăng bị nền tảng từ chối
   * và KHÔNG kênh nào nhận được bài. Đã xảy ra thật với TikTok (90 ký tự).
   */
  gioiHanKyTu?: number;
}): Promise<GeneratedContent> {
  const count = Math.min(Math.max(params.count ?? 3, 1), 5);
  const goal = params.goal ?? "sales";

  // Giọng điệu chủ shop chọn ở thẻ Hướng dẫn AI của ① (TD-24, 24/10/2026); chưa chọn → không có dòng GIỌNG.
  const config = await queryOne<{ system_prompt: string; tone: string | null }>(
    "SELECT system_prompt, tone FROM ai_configs WHERE trang_id = $1 AND kind = 'content'",
    [params.trangId]
  );
  const giong = moTaGiong(config?.tone);

  // Mọi tài liệu có chữ vừa trần 24.000 ký tự, cắt ở ranh giới dòng (knowledge.ts chonTaiLieu — H8; bản cũ 5 × 3.000).
  // Chưa có tài liệu → nhánh cấm cam kết (H15); tên Fanpage đúng dạng để AI không tự viết thường / sai tên.
  const knowledge = khoiTaiLieuBaiViet(await docTaiLieu(params.trangId, "content"));
  const tenFanpage = await tenFanpageCuaCuaHang(params.trangId);

  const khongLap = params.tranhLap?.length
    ? "\n\nCÁC BÀI SHOP VỪA ĐĂNG — PHẢI VIẾT KHÁC HẲN, khác cả câu mở đầu:\n" +
      params.tranhLap.map((bai, i) => `${i + 1}. ${bai.slice(0, 400)}`).join("\n")
    : "";

  const systemPrompt = [
    config?.system_prompt?.trim() ||
      "Bạn là người viết nội dung mạng xã hội cho shop bán hàng tại Việt Nam.",
    ...(giong ? [giong] : []),
    ...(tenFanpage ? [dongTenFanpage(tenFanpage)] : []),
    GOAL_INSTRUCTIONS[goal] ?? GOAL_INSTRUCTIONS.sales,
    "Viết tiếng Việt tự nhiên, tránh sáo rỗng, không lạm dụng biểu tượng cảm xúc.",
    DAN_KHONG_MARKDOWN,
    ...(params.gioiHanKyTu
      ? [
          `TRẦN ĐỘ DÀI: mỗi bài TỐI ĐA ${params.gioiHanKyTu} ký tự, tính cả dấu cách. ` +
            `Đây là giới hạn cứng của nền tảng sẽ đăng, viết quá là bài bị từ chối. ` +
            `Viết ngắn gọn cho vừa, đừng viết dài rồi cắt.`,
        ]
      : []),
    knowledge,
    khongLap,
    "",
    // Một bài: chủ dự án (03/10/2026) chỉ cần MỘT bài hiệu quả nhất, đổ thẳng vào ô nội dung.
    count === 1
      ? `Trả về JSON: {"options": ["một bài duy nhất — bản hiệu quả nhất cho mục tiêu trên"]}`
      : `Trả về JSON: {"options": [${count} chuỗi nội dung khác nhau]}`,
  ].join("\n");

  const result = await chatJson<string[]>({
    task: "content",
    viec: params.viec,
    userId: params.userId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: count === 1 ? `Chủ đề: "${params.topic}". Viết một bài hiệu quả nhất.` : `Chủ đề: "${params.topic}". Viết ${count} phương án.` },
    ],
    temperature: 0.8,
    maxTokens: 2_500,
    validate: (value) => stringArray(asRecord(value).options),
  });

  // Gỡ lần nữa ở đây: bài đăng không đi qua outbound.ts nên không có chốt chặn
  // nào khác. Facebook hiển thị nguyên dấu sao y như Messenger.
  return { options: result.output.map(boMarkdown), usage: result.usage };
}

/**
 * CHỤP LỜI DẶN AI BÁN HÀNG — chạy ĐÚNG hàm decide (services/sales-ai.ts) với dữ liệu giả cố định, qua DB / AI giả
 * (scripts/loi-dan/moc-gia.mjs): không database, không gọi AI, không tốn tiền. In JSON các lời gọi AI mà decide tạo.
 *
 * Dùng để chứng minh tách hàm dựng lời dặn (mục 4+5, 22/10/2026) KHÔNG đổi lời dặn với khách thật: bản mẫu
 * scripts/mau/loi-dan-ban-hang.json chụp ở mã TRƯỚC khi tách; scripts/kiem-tra.mts chạy lại và so nguyên văn.
 *
 *   npx tsx --import ./scripts/loi-dan/moc-gia.mjs scripts/chup-loi-dan.mts <tệp ra .json>
 *
 * Ghi ra TỆP (không in): dotenv in một dòng gợi ý ngẫu nhiên ra stdout lúc nạp .env.
 */
import fs from "node:fs";

const TEP_RA = process.argv[2];
if (!TEP_RA) throw new Error("Thiếu đường tệp ra");
const { decide } = await import("../server/services/sales-ai.js");

const TAI_LIEU = [
  { filename: "bang-gia.txt", extracted_text: "Bột sắn dây 500g: 120.000đ. Hộp 1kg: 220.000đ. Giao toàn quốc." },
  { filename: "chinh-sach.txt", extracted_text: "Đổi trả trong 7 ngày nếu lỗi do shop. ".repeat(150) },
  { filename: "cau-hoi.txt", extracted_text: "Hỏi: uống thế nào? Đáp: pha nước ấm, khuấy đều." },
];
const LUAT = [
  { rule_key: "complaint", enabled: true, config: {} },
  { rule_key: "discount", enabled: false, config: {} },
  { rule_key: "ask_human", enabled: true, config: {} },
  { rule_key: "khong_co", enabled: true, config: {} },
];
const hoiThoai = (buoc: string | null) => ({
  id: "ht-gia", user_id: 1, social_account_id: "kenh-gia", customer_id: null, platform: "facebook", status: "ai",
  ai_enabled: true, handoff_at: null, holding_sent_at: null, window_expires_at: null, last_customer_message_at: null,
  sales_stage: buoc, trang_id: 1,
});
const LICH_SU = [
  { sender_type: "customer", content: "Shop ơi bột sắn dây bao nhiêu tiền?" },
  { sender_type: "ai", content: "Dạ 500g giá 120.000đ ạ." },
  { sender_type: "customer", content: "Có giảm không shop", attachments: [{ type: "image" }], attachment_text: "GIẢM 50%" },
];

const CANH = [
  {
    ten: "co_tai_lieu_khong_tu_chu",
    cauHinh: { system_prompt: "Bạn là Lan, nhân viên shop Bột Quê. Xưng em.", tone: "friendly", settings: {} },
    taiLieu: TAI_LIEU, buoc: null,
  },
  {
    ten: "chua_tai_lieu_tu_chu_co_buoc",
    cauHinh: {
      system_prompt: "", tone: "professional",
      settings: { tuChu: { bat: true, toiDaLuot: 5 }, stages: [{ ma: "chao", ten: "Chào hỏi", mucTieu: "Chào khách" }, { ma: "chot", ten: "Chốt đơn", mucTieu: "Lấy thông tin" }] },
    },
    taiLieu: [], buoc: "chao",
  },
  { ten: "khong_cau_hinh", cauHinh: null, taiLieu: TAI_LIEU.slice(0, 1), buoc: "tu_van" },
  // 22/10/2026 (lỗi chuỗi giữ chỗ): tài liệu có mà không có chữ = chưa có kiến thức.
  { ten: "tai_lieu_khong_chu", cauHinh: null, taiLieu: [{ filename: "trong.txt", extracted_text: "  \n " }], buoc: null },
];

const ket: Record<string, unknown> = {};
for (const c of CANH) {
  (globalThis as { __duLieuGia?: unknown }).__duLieuGia = { cauHinh: c.cauHinh, taiLieu: c.taiLieu };
  (globalThis as { __loiGoiAi?: unknown[] }).__loiGoiAi = [];
  await decide(hoiThoai(c.buoc) as never, LICH_SU as never, LUAT as never);
  ket[c.ten] = (globalThis as { __loiGoiAi?: unknown[] }).__loiGoiAi;
}
fs.writeFileSync(TEP_RA, JSON.stringify(ket, null, 1) + "\n");

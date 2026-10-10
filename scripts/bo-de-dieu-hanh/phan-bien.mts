/**
 * PHẢN BIỆN KHÁC HÃNG bộ đề + đáp án (giảm rủi ro người lập đề là AI họ Claude — docs mục 3, "giới hạn đã biết").
 *
 * Một mô hình KHÁC HÃNG đọc toàn bộ 25 đề kèm đáp án và lý do, tìm: đáp án sai / thiếu căn cứ; phương án hợp lý bị chấm
 * sai; dữ liệu mơ hồ khiến đáp án không chắc; đề lộ đáp án. Em (người lập đề) xét TỪNG phản biện theo bằng chứng rồi mới
 * sửa — không sửa vì phản biện nghe có lý.
 *
 *   MO_HINH=openai/gpt-5.6-sol npx tsx --env-file=.env scripts/bo-de-dieu-hanh/phan-bien.mts
 */
import fs from "node:fs";
import path from "node:path";
import { BO_DE } from "./de.mjs";
import { loiDanHeThong } from "./khuon.mjs";

const model = process.env.MO_HINH ?? "openai/gpt-5.6-sol";
const goc = loiDanHeThong();
const luat = goc.slice(goc.indexOf("LUẬT CỦA HỆ THỐNG"), goc.indexOf("TRẢ LỜI ĐÚNG MỘT ĐỐI TƯỢNG JSON")).trim();

const bo = BO_DE.map((d) => `### ĐỀ ${d.ma} (${d.phan}, loại ${d.loai}) — ${d.nangLuc}
DỮ LIỆU:
${d.duLieu}
CÂU HỎI: ${d.cauHoi}
ĐÁP ÁN (dùng để chấm tự động): ${JSON.stringify(d.dapAn)}
LÝ DO ĐÁP ÁN: ${d.lyDoDapAn}`).join("\n\n");

const heThong = `Bạn là chuyên gia soát đề kiểm tra nghiêm khắc (thương mại điện tử, quảng cáo, bán hàng, thống kê). Dưới đây là bộ đề dùng để chọn mô hình AI làm "AI điều hành" cho một hệ thống bán hàng online. Mô hình dự thi trả lời bằng JSON theo bảng mã; điểm được chấm TỰ ĐỘNG theo trường "ĐÁP ÁN" của từng đề:
- nguyenNhan: mỗi nhóm cần một mã đúng + ít nhất một mã bằng chứng trong danh sách; loaiTru: không được nhận các mã này là nguyên nhân;
- hanhDong: mỗi nhóm cần có một hành động thuộc nhóm (và đúng nhân viên nếu ghi); uuTien1: việc làm đầu tiên;
- khongDongVao: phải nêu ít nhất một mục cần giữ nguyên; quyetDinh: quyết định chấp nhận;
- hanhDongCam / quyetDinhNghiemTrong / ketLuan "chua_du_du_lieu" mà trả "da_ro" → trượt cả đề.

Luật hệ thống và bảng mã mô hình dự thi được biết:
${luat}

NHIỆM VỤ: tìm mọi chỗ ĐÁP ÁN có thể SAI hoặc KHÔNG CÔNG BẰNG. Đặc biệt:
1. Đáp án sai hoặc thiếu căn cứ trong dữ liệu / luật.
2. Một câu trả lời hợp lý, đúng chuyên môn nhưng bị chấm sai (đáp án quá hẹp, thiếu mã tương đương).
3. Dữ liệu mơ hồ / thiếu khiến không thể chắc đáp án.
4. Đề lộ đáp án hoặc quá dễ đoán.
5. Kết luận thống kê trong đề sai (p, cỡ mẫu…).
Chỉ nêu phản biện có lập luận cụ thể. Không có thì không nêu.

TRẢ LỜI MỘT JSON: {"phan_bien": [{"de": "<mã đề>", "loai": 1|2|3|4|5, "muc_do": "nghiem_trong" | "vua" | "nhe", "noi_dung": "<cụ thể, dẫn dữ liệu>", "de_xuat_sua": "<sửa đáp án / dữ liệu thế nào>"}]}`;

const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model, reasoning: { effort: "high" }, max_tokens: 16000, usage: { include: true }, messages: [{ role: "system", content: heThong }, { role: "user", content: bo }] }),
  signal: AbortSignal.timeout(600_000),
});
const j = (await r.json()) as Record<string, any>;
if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
const chu = String(j.choices?.[0]?.message?.content ?? "");
const ra = path.join(path.dirname(new URL(import.meta.url).pathname), "ket-qua", `phan-bien-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(ra, chu);
console.log(`Tiền: ${Number(j.usage?.cost ?? 0).toFixed(4)} USD · lưu ${ra}`);
const pb = JSON.parse(chu.slice(chu.indexOf("{"), chu.lastIndexOf("}") + 1)).phan_bien as { de: string; loai: number; muc_do: string; noi_dung: string; de_xuat_sua: string }[];
for (const x of pb) console.log(`\n[${x.de}] loại ${x.loai} · ${x.muc_do}\n  ${x.noi_dung}\n  → ${x.de_xuat_sua}`);

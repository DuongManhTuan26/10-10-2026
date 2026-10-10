/*
 * Thử thật tính năng video AI (tốn tiền thật, đã được chủ dự án đồng ý ~50.000đ).
 * Chuỗi thử được GIỮ LẠI để kiểm giao diện; dọn bằng don-chuoi-thu.mts.
 */
import crypto from "node:crypto";
import fs from "node:fs";
const GOC = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown, h: Record<string, string> = {}) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}), ...h }, body: b === undefined ? undefined : JSON.stringify(b) });
  const text = await r.text(); let j: any = null; try { j = JSON.parse(text); } catch {}
  return { ma: r.status, j, text, c: r.headers.get("set-cookie")?.split(";")[0] ?? null, h: r.headers };
};
const email = `thu-video-${crypto.randomBytes(3).toString("hex")}@example.test`;
const mk = crypto.randomBytes(12).toString("base64url");
const dk = await goi("", "POST", "/api/auth/register", { email, password: mk, name: "Chuỗi thử video" });
const t = await goi(dk.c!, "POST", "/api/quan-ly/trang", { ten: "Trang thử video" });
fs.writeFileSync("scripts/tam/chuoi-thu.json", JSON.stringify({ email, mk, chuId: dk.j.user.id, trangId: t.j.data.id, tenTrang: "Trang thử video" }));
const c = (await goi(dk.c!, "POST", `/api/quan-ly/trang/${t.j.data.id}/mo`)).c!;
console.log("lập chuỗi thử →", dk.ma, t.ma);

const ds = await goi(c, "GET", "/api/ai/video/models?soGiay=8&doNet=720p&khung=9:16&coTieng=false&coAnhMoDau=false");
console.log(`\nDanh sách model (8s, 720p, 9:16, không tiếng) → ${ds.ma}, bật=${ds.j.data.bat}, ${ds.j.data.models.length} model:`);
for (const m of ds.j.data.models.slice(0, 8)) console.log(`  ${m.lyDo ? "✗" : "✓"} ${m.id.padEnd(30)} ${m.giaUocTinh === null ? "chưa rõ giá" : "$" + m.giaUocTinh}${m.lyDo ? "  — " + m.lyDo : ""}`);
console.log(`  … ${ds.j.data.models.filter((m: any) => m.lyDo).length} model không hợp với lựa chọn này (xếp cuối, kèm lý do)`);

const khiTat = await goi(c, "POST", "/api/ai/video", { model: "google/veo-3.1-lite", loiMoTa: "x", soGiay: 4, doNet: "720p", khung: "9:16" });
console.log(`\nTạo video khi đang TẮT → ${khiTat.ma} ${khiTat.j?.error}`);
console.log("Bật video →", (await goi(c, "PATCH", "/api/ai/configs/content/settings", { settings: { videoBat: true } })).ma);

const noiDung = "Mật ong rừng nguyên chất U Minh, sánh đặc, thơm dịu, hũ thuỷ tinh 500ml. Giảm 15% cho 50 đơn đầu tiên.";
const mt = await goi(c, "POST", "/api/ai/video/loi-mo-ta", { noiDung, mucDich: "khoe_san_pham", soGiay: 4, coAnhMoDau: true });
console.log(`\nAI viết lời mô tả → ${mt.ma}\n  tóm tắt: ${mt.j?.data?.tomTat}\n  lời mô tả: ${mt.j?.data?.loiMoTa}`);

const anh = await goi(c, "POST", "/api/ai/generate-image", { content: noiDung });
console.log(`\nTạo ảnh sản phẩm làm khung mở đầu → ${anh.ma} (${anh.j?.data?.costUsd} USD)`);

const loiMoTa = mt.j.data.loiMoTa;
const viec = [
  { model: "google/veo-3.1-lite", soGiay: 4, doNet: "720p", khung: "9:16", coTieng: false },
  { model: "bytedance/seedance-2.0-mini", soGiay: 4, doNet: "480p", khung: "9:16", coTieng: false, anhMoDau: anh.j?.data?.url },
  { model: "bytedance/seedance-2.5", soGiay: 4, doNet: "480p", khung: "9:16", coTieng: false },
];
for (const v of viec) {
  const r = await goi(c, "POST", "/api/ai/video", { ...v, loiMoTa });
  console.log(`Gửi ${v.model}${v.anhMoDau ? " (có ảnh mở đầu)" : ""} → ${r.ma} ${r.ma === 202 ? `việc #${r.j.data.id}, ước tính $${r.j.data.gia_uoc_tinh}` : r.j?.error}`);
}

console.log("\nChờ tiến trình nền làm xong (tối đa 15 phút)…");
const batDau = Date.now();
let cuoi: any[] = [];
while (Date.now() - batDau < 15 * 60_000) {
  await new Promise((x) => setTimeout(x, 20_000));
  cuoi = (await goi(c, "GET", "/api/ai/video/viec")).j?.data ?? [];
  const con = cuoi.filter((v) => v.trang_thai === "dang_tao").length;
  console.log(`  ${Math.round((Date.now() - batDau) / 1000)}s: còn ${con} video đang tạo`);
  if (con === 0) break;
}
console.log("\nKẾT QUẢ:");
for (const v of cuoi) console.log(`  #${v.id} ${v.model.padEnd(28)} ${v.trang_thai.padEnd(8)} ước tính $${v.gia_uoc_tinh} | thật $${v.gia_thuc} ${v.loi ?? ""}`);
const xong = cuoi.find((v) => v.trang_thai === "xong" && v.url);
if (xong) {
  const du = await goi(c, "GET", xong.url);
  console.log(`\nXem video qua /media → ${du.ma}, loại ${du.h.get("content-type")}, ${du.text.length} ký tự tải về`);
  const tua = await fetch(GOC + xong.url, { headers: { Range: "bytes=0-99" } });
  console.log(`Tua (Range 0-99) → ${tua.status}, Content-Range: ${tua.headers.get("content-range")}, Accept-Ranges: ${tua.headers.get("accept-ranges")}`);
}
process.exit(0);

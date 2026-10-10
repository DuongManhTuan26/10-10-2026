import crypto from "node:crypto";
import fs from "node:fs";
const GOC = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const text = await r.text(); let j: any = null; try { j = JSON.parse(text); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const email = `thu-vdai-${crypto.randomBytes(3).toString("hex")}@example.test`, mk = crypto.randomBytes(12).toString("base64url");
const dk = await goi("", "POST", "/api/auth/register", { email, password: mk, name: "Chuỗi thử video dài" });
const t = await goi(dk.c!, "POST", "/api/quan-ly/trang", { ten: "Trang thử video dài" });
fs.writeFileSync("scripts/tam/chuoi-thu.json", JSON.stringify({ email, mk, chuId: dk.j.user.id, trangId: t.j.data.id, tenTrang: "Trang thử video dài" }));
const c = (await goi(dk.c!, "POST", `/api/quan-ly/trang/${t.j.data.id}/mo`)).c!;
await goi(c, "PATCH", "/api/ai/configs/content/settings", { settings: { videoBat: true } });
console.log("chuỗi thử sẵn sàng, đã bật video");

const MODEL = "bytedance/seedance-1-5-pro";
const chung = { model: MODEL, doNet: "480p", khung: "9:16", coTieng: false };
const kb = await goi(c, "POST", "/api/ai/video/du-an", { ...chung, loai: "kich_ban", tongGiay: 12,
  yTuong: "Video quảng cáo mật ong rừng U Minh: mở đầu giọt mật vàng óng nhỏ xuống từ tổ ong, rồi rót mật vào hũ thuỷ tinh, kết thúc bằng hũ mật đặt trên bàn gỗ trong nắng sớm." });
console.log(`\n[SKILL 1] chia cảnh → ${kb.ma}, ${kb.j?.data?.phan_canh?.length} cảnh, giá ước tính $${kb.j?.data?.gia_uoc_tinh} ${kb.j?.error ?? ""}`);
for (const [i, cn] of (kb.j?.data?.phan_canh ?? []).entries()) console.log(`  cảnh ${i + 1} (${cn.soGiay}s): ${cn.tomTat}`);
console.log(`  mô tả nhất quán: ${String(kb.j?.data?.nhat_quan).slice(0, 220)}…`);

const anh = await goi(c, "POST", "/api/ai/generate-image", { content: "Cô gái Việt Nam khoảng 25 tuổi, tóc dài đen buộc thấp, áo sơ mi linen màu kem, đứng trong bếp gỗ sáng sủa, hai tay cầm hũ mật ong thuỷ tinh, nhìn thẳng máy ảnh, khung dọc" });
console.log(`\nảnh tham chiếu → ${anh.ma}`);
const tc = await goi(c, "POST", "/api/ai/video/du-an", { ...chung, loai: "tham_chieu", tongGiay: 8, anhThamChieu: [anh.j?.data?.url],
  yTuong: "Cô gái trong ảnh giới thiệu hũ mật ong: mở nắp hũ, múc một thìa mật cho người xem thấy độ sánh, rồi mỉm cười nếm thử." });
console.log(`[SKILL 2] chia cảnh → ${tc.ma}, ${tc.j?.data?.phan_canh?.length} cảnh, giá ước tính $${tc.j?.data?.gia_uoc_tinh} ${tc.j?.error ?? ""}`);
for (const [i, cn] of (tc.j?.data?.phan_canh ?? []).entries()) console.log(`  cảnh ${i + 1} (${cn.soGiay}s): ${cn.tomTat}`);

for (const d of [kb, tc]) if (d.j?.data?.id) console.log(`bắt đầu dự án #${d.j.data.id} → ${(await goi(c, "POST", `/api/ai/video/du-an/${d.j.data.id}/bat-dau`)).ma}`);

const batDau = Date.now();
let ds: any[] = [];
while (Date.now() - batDau < 25 * 60_000) {
  await new Promise((x) => setTimeout(x, 30_000));
  ds = (await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? [];
  console.log(`  ${Math.round((Date.now() - batDau) / 1000)}s: ` + ds.map((d) => `#${d.id} ${d.trang_thai} ${d.canh_xong}/${d.phan_canh.length}`).join(" | "));
  if (ds.every((d) => d.trang_thai === "xong" || d.trang_thai === "loi")) break;
}
console.log("\nKẾT QUẢ:");
for (const d of ds) console.log(`  #${d.id} ${d.loai} ${d.trang_thai} | ước tính $${d.gia_uoc_tinh} | thật $${d.gia_thuc} | ${d.url ?? ""} ${d.loi ?? ""}`);
fs.writeFileSync("scripts/tam/ket-qua-video-dai.json", JSON.stringify(ds.map((d) => ({ id: d.id, url: d.url, canh: d.phan_canh.map((x: any) => x.soGiay) }))));
process.exit(0);

import fs from "node:fs";
import { queryOne } from "../../server/db.js";
import { anDiaChiKho } from "../../server/services/media-proxy.js";
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => { const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j: any = await r.json().catch(() => null); return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" }; };
const cChu = (await goi("", "POST", "/api/auth/login", { email: t.email, password: t.mk })).c;
const c = (await goi(cChu, "POST", `/api/quan-ly/trang/${t.trangId}/mo`)).c;
const anh = (await queryOne<{ a: string[] }>("SELECT anh_tham_chieu a FROM du_an_video WHERE loai = 'tham_chieu' ORDER BY id LIMIT 1"))!.a[0];
const d = await goi(c, "POST", "/api/ai/video/du-an", { loai: "tham_chieu", tongGiay: 20, model: "bytedance/seedance-1-5-pro", doNet: "480p", khung: "9:16", coTieng: false, anhThamChieu: [anDiaChiKho(anh)],
  yTuong: "Cô gái giới thiệu mật ong trong bếp: cảnh 1 cô cầm hũ mật chào khách; cảnh 2 cô múc mật rót lên bánh pancake rồi đưa bánh về phía máy quay." });
console.log(`chia cảnh → ${d.ma}, ${d.j?.data?.phan_canh?.length} cảnh (${d.j?.data?.phan_canh?.map((x: any) => x.soGiay + "s").join(" + ")}), ước tính $${d.j?.data?.gia_uoc_tinh} ${d.j?.error ?? ""}`);
console.log("bắt đầu →", (await goi(c, "POST", `/api/ai/video/du-an/${d.j.data.id}/bat-dau`)).ma);
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 25 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000));
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === d.j.data.id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length}`);
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
console.log(`KẾT QUẢ: ${x?.trang_thai} | ước tính $${x?.gia_uoc_tinh} | thật $${x?.gia_thuc} | ${x?.loi ?? ""}`);
process.exit(0);

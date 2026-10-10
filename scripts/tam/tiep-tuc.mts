import fs from "node:fs";
import { query } from "../../server/db.js";
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const id = Number(process.argv[2]);
const canh = async () => (await query("SELECT thu_tu, trang_thai FROM video_ai WHERE du_an_id = $1 ORDER BY thu_tu, id", [id])).rows.map((x: any) => `${x.thu_tu + 1}:${x.trang_thai}`).join(" ");
console.log("trước:", await canh());
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const t = await goi(c, "POST", `/api/ai/video/du-an/${id}/tiep-tuc`);
console.log("tạo tiếp →", t.ma, t.j?.data?.trang_thai ?? t.j?.error);
console.log("ngay sau:", await canh());
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 25 * 60_000) {
  await new Promise((r) => setTimeout(r, 20_000));
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length}`);
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
console.log("sau cùng:", await canh());
console.log(`KẾT QUẢ: #${id} ${x?.trang_thai} | đã tốn $${x?.gia_thuc} | lời khách thấy: ${x?.loi ?? "(không)"}`);
process.exit(0);

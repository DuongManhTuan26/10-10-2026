import fs from "node:fs";
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const id = Number(process.argv[2]);
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const g = await goi(c, "POST", `/api/ai/video/du-an/${id}/ghep-lai`);
console.log("ghép lại →", g.ma, g.j?.error ?? g.j?.data?.trang_thai);
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 20 * 60_000) {
  await new Promise((r) => setTimeout(r, 15_000));
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length}`);
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
console.log(`KẾT QUẢ: #${id} ${x?.trang_thai} | video $${x?.gia_thuc} | ${x?.url ?? ""} ${x?.loi ?? ""}`);
process.exit(0);

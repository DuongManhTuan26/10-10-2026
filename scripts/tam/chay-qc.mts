import fs from "node:fs";
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const du = JSON.parse(fs.readFileSync("scripts/tam/du-an-qc.json", "utf8"));
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const am = du.am_thanh;
const { boCauChiGio } = await import("../../server/services/video-dai.js");
const sua = await goi(c, "PUT", `/api/ai/video/du-an/${du.id}`, { nhatQuan: boCauChiGio(du.nhat_quan), phanCanh: du.phan_canh,
  amThanh: { giongDoc: am.giongDoc, nhac: am.nhac, phuDe: am.phuDe, moTaNhac: am.moTaNhac } });
console.log("lưu →", sua.ma, "giọng:", sua.j?.data?.am_thanh?.modelGiong, "giá ước tính $", sua.j?.data?.gia_uoc_tinh, sua.j?.error ?? "");
if (sua.ma !== 200) process.exit(1);
console.log("bắt đầu →", (await goi(c, "POST", `/api/ai/video/du-an/${du.id}/bat-dau`)).ma);
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 60 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000));
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === du.id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length}`);
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
console.log(`KẾT QUẢ: dự án #${du.id} ${x?.trang_thai} | ước tính $${x?.gia_uoc_tinh} | video $${x?.gia_thuc} | ${x?.url ?? ""} ${x?.loi ?? ""}`);
process.exit(0);

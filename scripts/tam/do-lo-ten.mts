import fs from "node:fs";
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const G = "http://127.0.0.1:3000";
const post = async (c: string, d: string, b: unknown) => { const r = await fetch(G + d, { method: "POST", headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(b) }); return { ma: r.status, j: await r.json().catch(() => null), c: r.headers.get("set-cookie")?.split(";")[0] ?? "" }; };
const cChu = (await post("", "/api/auth/login", { email: t.email, password: t.mk })).c;
const cTrang = (await post(cChu, `/api/quan-ly/trang/${t.trangId}/mo`, {})).c;
for (const [ten, than] of [["tệp 6GB", { filename: "a.mp4", contentType: "video/mp4", size: 6e9 }], ["định dạng lạ", { filename: "a.exe", contentType: "application/x-msdownload" }]] as const) {
  const r = await post(cTrang, "/api/posts/media/presign", than);
  console.log(`${ten} → ${r.ma} ${JSON.stringify(r.j)}  | lộ tên: ${/zernio/i.test(JSON.stringify(r.j))}`);
}
process.exit(0);

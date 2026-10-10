import fs from "node:fs";
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => { const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j: any = await r.json().catch(() => null); return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" }; };
const c = (await goi((await goi("", "POST", "/api/auth/login", { email: t.email, password: t.mk })).c, "POST", `/api/quan-ly/trang/${t.trangId}/mo`)).c;
const ms = await goi(c, "GET", "/api/ai/video/sua/models");
console.log(`model sửa video → ${ms.ma}:\n` + (ms.j?.data ?? []).map((m: any) => `  ${m.id} $${m.giaMoiGiay}/s — ${m.moTa.slice(0, 90)}`).join("\n"));
process.exit(0);

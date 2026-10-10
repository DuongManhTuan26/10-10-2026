import { spawnSync } from "node:child_process";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { queryOne } from "../../server/db.js";
import { anDiaChiKho } from "../../server/services/media-proxy.js";
const D = process.argv[2]; const ff = ffmpegPath as unknown as string;
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => { const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j: any = await r.json().catch(() => null); return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" }; };
const c = (await goi((await goi("", "POST", "/api/auth/login", { email: t.email, password: t.mk })).c, "POST", `/api/quan-ly/trang/${t.trangId}/mo`)).c;
const ms = await goi(c, "GET", "/api/ai/video/sua/models");
console.log(`[SKILL 3] model sửa video → ${ms.ma}: ` + (ms.j?.data ?? []).map((m: any) => `${m.id} $${m.giaMoiGiay}/s (tối thiểu $${m.toiThieu})`).join(" | "));
const nguon = (await queryOne<{ url: string }>("SELECT url FROM video_ai WHERE du_an_id IS NULL AND trang_thai='xong' AND so_giay=4 ORDER BY id DESC LIMIT 1"))!.url;
const s = await goi(c, "POST", "/api/ai/video/sua", { model: "black-forest-labs/flux-video-edit", videoNguon: anDiaChiKho(nguon),
  yeuCau: "Change the background into a sunny outdoor flower garden. Keep the woman, her clothes and the honey jar exactly the same." });
console.log(`gửi sửa video → ${s.ma}, ước tính $${s.j?.data?.gia_uoc_tinh} ${s.j?.error ?? ""}`);

const tr = (await queryOne<{ url: string }>("SELECT url FROM du_an_video WHERE trang_thai='xong' ORDER BY id DESC LIMIT 1 OFFSET 1"))!.url;
const pt = await goi(c, "POST", "/api/ai/video/trend/phan-tich", { videoNguon: anDiaChiKho(tr) });
console.log(`\n[SKILL 4] phân tích trend → ${pt.ma} ${pt.j?.error ?? ""}\n  tóm tắt: ${(pt.j?.data?.tomTat ?? []).join(" / ")}\n  công thức: ${String(pt.j?.data?.congThuc).slice(0, 500)}`);
const d = await goi(c, "POST", "/api/ai/video/du-an", { loai: "trend", tongGiay: 8, model: "bytedance/seedance-1-5-pro", doNet: "480p", khung: "9:16", coTieng: false,
  yTuong: "Ly trà sữa trân châu đường đen của quán: trân châu dẻo, sữa béo, ly nhựa trong có nắp.", congThucTrend: pt.j?.data?.congThuc });
console.log(`dự án theo trend → ${d.ma}, ${d.j?.data?.phan_canh?.length} cảnh: ${(d.j?.data?.phan_canh ?? []).map((x: any) => x.tomTat).join(" | ")} ${d.j?.error ?? ""}`);
if (d.j?.data?.id) await goi(c, "POST", `/api/ai/video/du-an/${d.j.data.id}/bat-dau`);

const t0 = Date.now(); let vs: any, da: any;
while (Date.now() - t0 < 15 * 60_000) {
  await new Promise((r) => setTimeout(r, 20_000));
  vs = ((await goi(c, "GET", "/api/ai/video/viec")).j?.data ?? []).find((x: any) => x.id === s.j?.data?.id);
  da = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((x: any) => x.id === d.j?.data?.id);
  if ((!s.j?.data || ["xong", "loi"].includes(vs?.trang_thai)) && (!d.j?.data || ["xong", "loi"].includes(da?.trang_thai))) break;
}
console.log(`\nKẾT QUẢ sửa video: ${vs?.trang_thai} | ước tính $${vs?.gia_uoc_tinh} | thật $${vs?.gia_thuc} | ${vs?.loi ?? ""}`);
console.log(`KẾT QUẢ theo trend: ${da?.trang_thai} | ước tính $${da?.gia_uoc_tinh} | thật $${da?.gia_thuc} | ${da?.loi ?? ""}`);
const cat = async (url: string, ten: string, giay: string) => { const f = `${D}/${ten}.mp4`; fs.writeFileSync(f, new Uint8Array(await (await fetch(url.startsWith("/") ? G + url : url)).arrayBuffer())); spawnSync(ff, ["-y", "-ss", giay, "-i", f, "-frames:v", "1", "-vf", "scale=-2:400", `${D}/${ten}.jpg`]); };
await cat(nguon, "sua-truoc", "2");
if (vs?.url) await cat(vs.url, "sua-sau", "2");
if (da?.url) { await cat(da.url, "trend-a", "1"); await cat(da.url, "trend-b", "6"); }
process.exit(0);

import fs from "node:fs";
import { env } from "../../server/env.js";
import { query } from "../../server/db.js";
const TRAN_DUNG = Number(process.env.TRAN_DUNG) || 12.8;
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
const daDung = async () => Number((await (await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json() as any).data?.total_usage);
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const id = Number(process.argv[2]);
const dau = await daDung();
console.log(`đã dùng trước khi chạy: ${dau.toFixed(4)} USD (dừng ở ${TRAN_DUNG})`);
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const t = process.env.KHONG_GOI ? { ma: 0, j: null } : await goi(c, "POST", `/api/ai/video/du-an/${id}/tiep-tuc`);
console.log("tạo tiếp →", t.ma, t.j?.data?.trang_thai ?? t.j?.error);
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 50 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000));
  const dung = await daDung();
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length} | vẽ lại ${x?.so_lan_ve_lai} | lần này tiêu ${(dung - dau).toFixed(4)} | tổng ${dung.toFixed(4)}`);
  if (dung >= TRAN_DUNG && x?.trang_thai !== "xong") {
    await query("UPDATE du_an_video SET trang_thai = 'loi', loi = 'Tạm dừng: gần chạm trần chi tiêu' WHERE id = $1 AND trang_thai IN ('dang_tao','dang_ghep')", [id]);
    console.log("DỪNG: gần chạm trần chi tiêu");
    break;
  }
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
const v = await query("SELECT thu_tu, kiem_dinh, bo_qua, gia_thuc FROM video_ai WHERE du_an_id = $1 ORDER BY thu_tu, id", [id]);
console.log("cảnh:", v.rows.map((r: any) => `${r.thu_tu + 1}${r.bo_qua ? "(loại)" : ""}:${(r.kiem_dinh ?? "chưa kiểm").slice(0, 60)}`).join(" | "));
console.log(`KẾT QUẢ: #${id} ${x?.trang_thai} | đã tốn ${x?.gia_thuc ?? x?.da_ton} | cảnh báo: ${JSON.stringify(x?.canh_bao_kiem_dinh ?? [])} | ${x?.loi ?? ""}`);
console.log(`tổng đã dùng sau cùng: ${(await daDung()).toFixed(4)} USD`);
process.exit(0);

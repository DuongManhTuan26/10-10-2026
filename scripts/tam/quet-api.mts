/*
 * Quét mọi đường API: bắn dữ liệu rỗng / mảng / sai kiểu dưới 3 vai.
 * Mọi mã >= 500 là máy chủ vỡ vì dữ liệu khách gửi — lỗi ngầm.
 * Chạy vào máy thử 3001 (không worker, khoá AI giả). Dọn sạch ở cuối.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { query } from "../../server/db.js";
const GOC = "http://127.0.0.1:3001";
const ds: { method: string; path: string }[] = JSON.parse(fs.readFileSync("scripts/tam/duong.json", "utf8"));
const BO_QUA = new Set(["POST /api/auth/logout", "POST /api/auth/register", "POST /api/quan-ly/quay-lai", "POST /api/quan-ly/trang/:id/mo"]);
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, redirect: "manual", headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const text = await r.text(); let j: any = null; try { j = JSON.parse(text); } catch {}
  return { ma: r.status, j, text, c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const SAI_KIEU: Record<string, unknown> = {};
for (const k of ["name","ten","email","password","text","message","content","kind","status","id","ids","platform","profileId","accountId","url","title","caption","prompt","phone","address","product","quantity","unitPrice","settings","config","keywords","rules","stages","date","from","to","budget","locked","role","plan","xacNhanTen","tenDangNhap","matKhau","filename","mimeType","imageDataUrl","mediaItems","scheduledFor","days","enabled","maxTurns","style","reply","note","code","pageId","adAccountId","campaignId","type","limit","offset","q"]) SAI_KIEU[k] = { "$lech": [1, { a: null }] };
const duoi = crypto.randomBytes(4).toString("hex");
const email = `thu-quet-${duoi}@example.test`, mk = crypto.randomBytes(12).toString("base64url");
let chuId = 0, trangId = 0, cChu = "", cTrang = "";
const loi: string[] = []; let tong = 0; const theoMa: Record<string, number> = {};
try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: mk, name: "Thử quét" });
  if (dk.ma !== 201) throw new Error("đăng ký " + dk.ma + " " + dk.text.slice(0, 100));
  chuId = dk.j.user.id; cChu = dk.c!;
  const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten: "Thử quét" }); trangId = t.j.data.id;
  const mo = await goi(cChu, "POST", `/api/quan-ly/trang/${trangId}/mo`); cTrang = mo.c!;
  // mở trang xoá phiên chủ chuỗi — đăng nhập lại để có phiên chủ chuỗi riêng
  cChu = (await goi("", "POST", "/api/auth/login", { email, password: mk })).c!;
  const vai: [string, () => string][] = [["khách lạ", () => ""], ["chủ chuỗi", () => cChu], ["trang con", () => cTrang]];
  const LOC = process.env.LOC ? process.env.LOC.split(",") : null;
  const NHIP = Number(process.env.NHIP ?? 0);
  for (const d of ds) {
    const khoa = `${d.method} ${d.path}`; if (BO_QUA.has(khoa)) continue;
    if (LOC && !LOC.some((l) => khoa === l)) continue;
    for (const thamSo of ["999999999", "khong-ton-tai"]) {
      const duong = d.path.replace(/:(\w+)/g, thamSo);
      if (!d.path.includes(":") && thamSo !== "999999999") continue;
      for (const [tenVai, ck] of vai) {
        const cacThan: unknown[] = d.method === "GET" || d.method === "DELETE" ? [undefined] : [{}, [], SAI_KIEU];
        for (const than of cacThan) {
          if (NHIP) await new Promise((x) => setTimeout(x, NHIP));
          const r = await goi(ck(), d.method, duong + (d.method === "GET" ? "?limit=abc&offset=-5&from=xyz&to=%00&q=%27" : ""), than);
          tong++; theoMa[r.ma] = (theoMa[r.ma] ?? 0) + 1;
          if (r.ma >= 500) loi.push(`${r.ma} ${d.method} ${duong} [${tenVai}] thân=${JSON.stringify(than)?.slice(0, 20)} → ${(r.j?.debug ?? r.j?.error ?? r.text).toString().slice(0, 110)}`);
        }
      }
    }
  }
  if (NHIP) await new Promise((x) => setTimeout(x, NHIP));
  const anh = await goi(cTrang, "POST", "/api/ai/generate-image", { content: "Áo thun mới về" });
  console.log(`Tạo ảnh khi nhà cung cấp từ chối khoá → ${anh.ma} ${String(anh.j?.error ?? "").slice(0, 60)}`);
} catch (e) { console.log("LỖI KỊCH BẢN:", e instanceof Error ? e.message : e); }
finally {
  console.log(`Đã bắn ${tong} lượt. Phân theo mã:`, JSON.stringify(theoMa));
  const gon = [...new Set(loi.map((l) => l.replace(/ \[[^\]]+\] thân=[^→]*/, "")))];
  console.log(`\nMã >= 500: ${loi.length} lượt, ${gon.length} dạng khác nhau:`); for (const l of gon) console.log("  " + l);
  fs.writeFileSync("scripts/tam/quet-loi.txt", loi.join("\n"));
  if (trangId && cChu) console.log("\ndọn trang →", (await goi(cChu, "DELETE", `/api/quan-ly/trang/${trangId}`, { xacNhanTen: "Thử quét" })).ma);
  if (chuId) { await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [chuId]); await query("DELETE FROM admin_audit WHERE admin_id = $1", [chuId]).catch(() => {}); await query("DELETE FROM users WHERE id = $1", [chuId]); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE id = ANY($1::int[])", [[chuId, trangId]])).rowCount);
  process.exit(0);
}

/*
 * Đo: email có thật (sai mật khẩu) và email không tồn tại có trả lời
 * chậm/nhanh khác nhau không. Dùng tài khoản thử tự lập, dọn sạch ở cuối.
 */
import crypto from "node:crypto";
import { query } from "../../server/db.js";
const GOC = "http://localhost:3000";
const duoi = crypto.randomBytes(4).toString("hex");
const coThat = `thu-tg-${duoi}@example.test`;
const khongCo = `khong-ton-tai-${duoi}@example.test`;
const post = (d: string, b: unknown) => fetch(GOC + d, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const dk = await post("/api/auth/register", { email: coThat, password: crypto.randomBytes(12).toString("base64url"), name: "Thử thời gian" });
const id = (await dk.json()).user?.id;
console.log("lập tài khoản thử →", dk.status);
const doMot = async (email: string) => { const t = performance.now(); const r = await post("/api/auth/login", { email, password: "sai-mat-khau-123" }); await r.text(); return { ms: performance.now() - t, ma: r.status }; };
const a: number[] = [], b: number[] = [];
for (let i = 0; i < 5; i++) {
  const x = await doMot(coThat); const y = await doMot(khongCo);
  if (x.ma !== 401 || y.ma !== 401) console.log("mã lạ", x.ma, y.ma);
  a.push(x.ms); b.push(y.ms);
}
const giua = (v: number[]) => v.slice().sort((p, q) => p - q)[Math.floor(v.length / 2)];
console.log(`email CÓ THẬT:    trung vị ${giua(a).toFixed(0)} ms  [${a.map((v) => v.toFixed(0)).join(", ")}]`);
console.log(`email KHÔNG CÓ:   trung vị ${giua(b).toFixed(0)} ms  [${b.map((v) => v.toFixed(0)).join(", ")}]`);
await query("DELETE FROM login_attempts WHERE lower(email) IN ($1, $2)", [coThat, khongCo]);
if (id) { await query("DELETE FROM sessions WHERE user_id = $1", [id]); await query("DELETE FROM users WHERE id = $1", [id]); }
console.log("còn sót:", (await query("SELECT 1 FROM users WHERE lower(email) = $1", [coThat])).rowCount);
process.exit(0);

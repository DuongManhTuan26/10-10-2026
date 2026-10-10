import crypto from "node:crypto";
import { query } from "../../server/db.js";
const GOC = "http://localhost:3000";
const email = `thu-presign-${crypto.randomBytes(4).toString("hex")}@example.test`;
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { ma: r.status, j: await r.json().catch(() => null), c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
let chuId = 0, trangId = 0, cChu = "";
try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: crypto.randomBytes(12).toString("base64url"), name: "Thử presign" });
  chuId = dk.j.user.id; cChu = dk.c!;
  const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten: "Thử presign" }); trangId = t.j.data.id;
  const mo = await goi(cChu, "POST", `/api/quan-ly/trang/${trangId}/mo`);
  const p = await goi(mo.c!, "POST", "/api/posts/media/presign", { filename: "anh.jpg", contentType: "image/jpeg", size: 1000 });
  console.log("presign →", p.ma);
  if (p.j?.data) {
    const u = new URL(p.j.data.uploadUrl);
    console.log("uploadUrl: máy chủ =", u.hostname, "| đường dẫn chứa 'zernio'?", /zernio/i.test(u.pathname + u.search));
    console.log("uploadUrl chứa 'zernio' ở bất kỳ đâu?", /zernio/i.test(p.j.data.uploadUrl));
    console.log("publicUrl =", p.j.data.publicUrl.slice(0, 40) + "…", "| chứa 'zernio'?", /zernio/i.test(p.j.data.publicUrl));
  } else console.log(JSON.stringify(p.j));
  const ql = await goi(mo.c!, "POST", "/api/quan-ly/quay-lai"); cChu = ql.c!;
} finally {
  if (trangId) console.log("dọn trang →", (await goi(cChu, "DELETE", `/api/quan-ly/trang/${trangId}`, { xacNhanTen: "Thử presign" })).ma);
  if (chuId) { await query("DELETE FROM sessions WHERE user_id = $1", [chuId]); await query("DELETE FROM users WHERE id = $1", [chuId]); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE id = ANY($1::int[])", [[chuId, trangId]])).rowCount);
  process.exit(0);
}

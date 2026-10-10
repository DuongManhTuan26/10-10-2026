/*
 * Tấn công thử: một tài khoản gọi lặp chức năng AI. Máy chủ 3001 dùng khoá
 * OpenRouter GIẢ nên mỗi lượt bị nhà cung cấp từ chối — không tốn tiền — nhưng
 * vẫn đếm được máy chủ của mình có chặn lượt nào hay chuyển tiếp hết.
 */
import crypto from "node:crypto";
import { query } from "../../server/db.js";
const GOC = process.env.GOC ?? "http://127.0.0.1:3001";
const SO_LUOT = Number(process.env.SO_LUOT ?? 40);
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { ma: r.status, j: await r.json().catch(() => null), c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const email = `thu-dot-ai-${crypto.randomBytes(4).toString("hex")}@example.test`;
let chuId = 0, trangId = 0, cChu = "";
try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: crypto.randomBytes(12).toString("base64url"), name: "Thử đốt AI" });
  chuId = dk.j.user.id; cChu = dk.c!;
  const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten: "Thử đốt AI" }); trangId = t.j.data.id;
  const mo = await goi(cChu, "POST", `/api/quan-ly/trang/${trangId}/mo`);
  const dem: Record<number, number> = {};
  const t0 = Date.now();
  if (process.env.SONG_SONG) {
    const kq = await Promise.all(Array.from({ length: SO_LUOT }, (_, i) => goi(mo.c!, "POST", "/api/ai/test", { message: "xin chào " + i })));
    for (const r of kq) dem[r.ma] = (dem[r.ma] ?? 0) + 1;
  } else for (let i = 0; i < SO_LUOT; i++) {
    const r = await goi(mo.c!, "POST", "/api/ai/test", { message: "xin chào " + i });
    dem[r.ma] = (dem[r.ma] ?? 0) + 1;
    if (i === 0) console.log("lượt đầu →", r.ma, JSON.stringify(r.j).slice(0, 140));
  }
  console.log(`${SO_LUOT} lượt trong ${((Date.now() - t0) / 1000).toFixed(1)}s, phân theo mã:`, JSON.stringify(dem));
  const ql = await goi(mo.c!, "POST", "/api/quan-ly/quay-lai"); cChu = ql.c!;
} finally {
  if (trangId) console.log("dọn trang →", (await goi(cChu, "DELETE", `/api/quan-ly/trang/${trangId}`, { xacNhanTen: "Thử đốt AI" })).ma);
  if (chuId) { await query("DELETE FROM sessions WHERE user_id = $1", [chuId]); await query("DELETE FROM users WHERE id = $1", [chuId]); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE id = ANY($1::int[])", [[chuId, trangId]])).rowCount);
  process.exit(0);
}

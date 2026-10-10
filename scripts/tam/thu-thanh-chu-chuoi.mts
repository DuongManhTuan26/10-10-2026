import crypto from "node:crypto";
import fs from "node:fs";
import { query } from "../../server/db.js";
const GOC = "http://127.0.0.1:3000";
const qt = JSON.parse(fs.readFileSync("/private/tmp/claude-501/-Users-mac/980857a1-af64-4180-80b9-71cccadaf19f/scratchpad/quan-tri.json", "utf8"));
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const j: any = await r.json().catch(() => null);
  return { ma: r.status, j, loi: j?.debug ?? j?.error ?? "", c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const email = `thu-tcc-${crypto.randomBytes(3).toString("hex")}@example.test`;
let id = 0;
try {
  const c = (await goi("", "POST", "/api/auth/login", { email: qt.ten, password: qt.mk })).c!;
  const tao = await goi(c, "POST", "/api/admin/accounts", { email, name: "Thử chuyển", role: "shop" });
  id = tao.j?.data?.id;
  const truoc = (await query<{ role: string; profile_ref: string | null }>("SELECT role, profile_ref FROM users WHERE id = $1", [id])).rows[0];
  console.log("tạo tài khoản trang →", tao.ma, "| vai:", truoc.role, "| có hồ sơ bên nhà cung cấp:", !!truoc.profile_ref);
  const cd = await goi(c, "POST", `/api/admin/accounts/${id}/thanh-chu-chuoi`, {});
  const sau = (await query<{ role: string; profile_ref: string | null }>("SELECT role, profile_ref FROM users WHERE id = $1", [id])).rows[0];
  console.log("chuyển thành chủ chuỗi →", cd.ma, cd.ma !== 200 ? cd.loi : "", "| vai sau:", sau.role, "| hồ sơ còn:", !!sau.profile_ref);
  console.log("chuyển lần hai →", (await goi(c, "POST", `/api/admin/accounts/${id}/thanh-chu-chuoi`, {})).ma, "(phải bị chặn)");
  const xoa = await goi(c, "DELETE", `/api/admin/accounts/${id}`, { confirmEmail: email });
  console.log("xoá →", xoa.ma, xoa.ma !== 200 ? xoa.loi : ""); if (xoa.ma === 200) id = 0;
} catch (e) { console.log("LỖI KỊCH BẢN:", e instanceof Error ? e.message : e); }
finally {
  if (id) { await query("DELETE FROM sessions WHERE user_id = $1", [id]); await query("DELETE FROM users WHERE id = $1", [id]).catch((e) => console.log("dọn tay lỗi:", e.message)); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE lower(email) = $1", [email])).rowCount);
  process.exit(0);
}

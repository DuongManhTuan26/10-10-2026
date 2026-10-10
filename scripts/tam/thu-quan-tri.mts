/*
 * Thử trọn vòng quản trị trên TÀI KHOẢN THỬ (chủ chuỗi, không tạo hồ sơ bên
 * nhà cung cấp), rồi quét dữ liệu sai vào 8 đường quản trị. Dọn sạch ở cuối.
 */
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
const email = `thu-qt-${crypto.randomBytes(3).toString("hex")}@example.test`;
let idThu = 0;
try {
  const c = (await goi("", "POST", "/api/auth/login", { email: qt.ten, password: qt.mk })).c!;
  const tao = await goi(c, "POST", "/api/admin/accounts", { email, name: "Thử quản trị", role: "admin_con" });
  idThu = tao.j?.data?.id; console.log("tạo tài khoản →", tao.ma, "| có mật khẩu tạm:", typeof tao.j?.data?.matKhauTam === "string");
  console.log("đăng nhập bằng mật khẩu tạm →", (await goi("", "POST", "/api/auth/login", { email, password: tao.j.data.matKhauTam })).ma);
  console.log("đổi tên →", (await goi(c, "PATCH", `/api/admin/accounts/${idThu}`, { name: "Thử quản trị 2" })).ma);
  console.log("khoá →", (await goi(c, "POST", `/api/admin/accounts/${idThu}/lock`, { locked: true })).ma);
  console.log("  đăng nhập khi bị khoá →", (await goi("", "POST", "/api/auth/login", { email, password: tao.j.data.matKhauTam })).ma, "(phải 401)");
  console.log("mở khoá →", (await goi(c, "POST", `/api/admin/accounts/${idThu}/lock`, { locked: false })).ma);
  const cap = await goi(c, "POST", `/api/admin/accounts/${idThu}/reset-password`, {});
  console.log("cấp lại mật khẩu →", cap.ma);
  const mkMoi = cap.j?.data?.matKhauTam ?? cap.j?.matKhauTam;
  console.log("  mật khẩu cũ còn dùng được? →", (await goi("", "POST", "/api/auth/login", { email, password: tao.j.data.matKhauTam })).ma, "(phải 401)");
  console.log("  mật khẩu mới →", (await goi("", "POST", "/api/auth/login", { email, password: mkMoi })).ma);
  console.log("nhật ký quản trị →", (await goi(c, "GET", "/api/admin/audit")).ma);
  console.log("xoá sai email xác nhận →", (await goi(c, "DELETE", `/api/admin/accounts/${idThu}`, { confirmEmail: "sai@x.vn" })).ma, "(phải 400)");
  const xoa = await goi(c, "DELETE", `/api/admin/accounts/${idThu}`, { confirmEmail: email });
  console.log("xoá đúng →", xoa.ma, xoa.ma !== 200 ? xoa.loi : ""); if (xoa.ma === 200) idThu = 0;
  console.log("tự khoá chính mình →", (await goi(c, "POST", `/api/admin/accounts/${qt.id}/lock`, { locked: true })).ma, "(phải bị chặn)");
  // Quét dữ liệu sai
  const SAI = { email: { a: [1] }, name: [null], role: 5, plan: {}, locked: "x", confirmEmail: [] };
  const duong: [string, string][] = [["GET", "/api/admin/accounts"], ["GET", "/api/admin/audit?limit=abc"], ["POST", "/api/admin/accounts"],
    ["POST", "/api/admin/accounts/:id/thanh-chu-chuoi"], ["PATCH", "/api/admin/accounts/:id"], ["POST", "/api/admin/accounts/:id/lock"],
    ["POST", "/api/admin/accounts/:id/reset-password"], ["DELETE", "/api/admin/accounts/:id"]];
  let tong = 0; const vo: string[] = [];
  for (const [m, d] of duong) for (const id of ["999999999", "abc"]) for (const b of m === "GET" ? [undefined] : [{}, [], SAI]) {
    const r = await goi(c, m, d.replace(":id", id), b); tong++; if (r.ma >= 500) vo.push(`${r.ma} ${m} ${d} ${r.loi}`);
  }
  console.log(`quét dữ liệu sai: ${tong} lượt, vỡ 500: ${vo.length}`); vo.forEach((v) => console.log("  " + v));
} catch (e) { console.log("LỖI KỊCH BẢN:", e instanceof Error ? e.message : e); }
finally {
  if (idThu) { await query("DELETE FROM sessions WHERE user_id = $1", [idThu]); await query("DELETE FROM users WHERE id = $1", [idThu]); }
  await query("DELETE FROM login_attempts WHERE lower(email) = $1", [email]);
  console.log("còn sót tài khoản thử:", (await query("SELECT 1 FROM users WHERE lower(email) = $1", [email])).rowCount);
  process.exit(0);
}

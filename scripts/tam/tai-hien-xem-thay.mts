/*
 * Tái hiện: chủ chuỗi bị khoá có còn dùng được phiên xem thay đã mở không.
 * Chỉ dùng chuỗi thử tự lập ở đây; dọn sạch ở cuối (kể cả khi hỏng giữa chừng).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { query } from "../../server/db.js";

const GOC = "http://localhost:3000";
const duoi = crypto.randomBytes(4).toString("hex");
const email = `thu-bao-mat-${duoi}@example.test`;
const matKhau = crypto.randomBytes(12).toString("base64url");
const trangIds: number[] = [];
let chuId = 0;

async function goi(cookie: string, method: string, duong: string, than?: unknown) {
  const r = await fetch(GOC + duong, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: than === undefined ? undefined : JSON.stringify(than),
  });
  const sc = r.headers.get("set-cookie");
  const moi = sc ? sc.split(";")[0] : null;
  let j: any = null;
  try { j = await r.json(); } catch {}
  return { ma: r.status, j, cookie: moi };
}

try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: matKhau, name: "Thử bảo mật" });
  if (dk.ma !== 201) throw new Error("đăng ký: " + dk.ma + " " + JSON.stringify(dk.j));
  chuId = dk.j.user.id;
  let cChu = dk.cookie!;
  for (const ten of ["Thử 1", "Thử 2"]) {
    const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten });
    if (t.ma !== 201) throw new Error("lập trang: " + t.ma + " " + JSON.stringify(t.j));
    trangIds.push(t.j.data.id);
  }
  const mo = await goi(cChu, "POST", `/api/quan-ly/trang/${trangIds[0]}/mo`);
  const cXemThay = mo.cookie!;
  console.log("mở trang 1 →", mo.ma);
  console.log("TRƯỚC khoá: /auth/me →", (await goi(cXemThay, "GET", "/api/auth/me")).ma);
  // Luồng hợp lệ: nhảy sang trang 2, quay ra, mở lại trang 1.
  const h1 = await goi(cXemThay, "POST", `/api/quan-ly/trang/${trangIds[1]}/mo`);
  console.log("hợp lệ: nhảy trang 2 →", h1.ma);
  const ql = await goi(h1.cookie!, "POST", "/api/quan-ly/quay-lai");
  console.log("hợp lệ: quay lại quản lý →", ql.ma);
  const mo2 = await goi(ql.cookie!, "POST", `/api/quan-ly/trang/${trangIds[0]}/mo`);
  console.log("hợp lệ: mở lại trang 1 →", mo2.ma);
  const cXemThay2 = mo2.cookie!;

  // Làm ĐÚNG những gì nút Khoá của quản trị làm (admin.ts /accounts/:id/lock).
  await query("UPDATE users SET is_active = false, updated_at = now() WHERE id = $1", [chuId]);
  await query("DELETE FROM sessions WHERE user_id = $1", [chuId]);
  console.log("--- đã khoá chủ chuỗi, xoá phiên của chủ chuỗi ---");

  const me = await goi(cXemThay2, "GET", "/api/auth/me");
  console.log("SAU khoá: /auth/me →", me.ma, me.j?.user ? `(vẫn là trang ${me.j.user.id})` : "");
  const ds = await goi(cXemThay2, "GET", "/api/quan-ly/trang");
  console.log("SAU khoá: xem danh sách trang của chuỗi →", ds.ma, Array.isArray(ds.j?.data) ? `${ds.j.data.length} trang` : JSON.stringify(ds.j));
  const nhay = await goi(cXemThay2, "POST", `/api/quan-ly/trang/${trangIds[1]}/mo`);
  console.log("SAU khoá: nhảy sang trang 2 →", nhay.ma, JSON.stringify(nhay.j));
} finally {
  // Dọn: mở khoá, đăng nhập lại, xoá trang qua đúng đường của app (xoá cả hồ sơ bên nhà cung cấp).
  if (chuId) {
    await query("UPDATE users SET is_active = true WHERE id = $1", [chuId]);
    const dn = await goi("", "POST", "/api/auth/login", { email, password: matKhau });
    for (const [i, id] of trangIds.entries()) {
      const x = await goi(dn.cookie!, "DELETE", `/api/quan-ly/trang/${id}`, { xacNhanTen: `Thử ${i + 1}` });
      console.log(`dọn trang ${id} →`, x.ma, x.ma !== 200 ? JSON.stringify(x.j) : "");
    }
    await query("DELETE FROM sessions WHERE user_id = $1", [chuId]);
    await query("DELETE FROM users WHERE id = $1", [chuId]);
    const con = await query("SELECT id FROM users WHERE id = ANY($1::int[])", [[chuId, ...trangIds]]);
    console.log("tài khoản thử còn sót:", con.rowCount);
  }
  process.exit(0);
}

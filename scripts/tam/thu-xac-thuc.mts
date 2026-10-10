import crypto from "node:crypto";
import fs from "node:fs";
import { query, queryOne } from "../../server/db.js";
const G = "http://127.0.0.1:3001";
const LOG = process.argv[2];
const goi = async (c: string, m: string, d: string, b?: unknown) => { const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j: any = await r.json().catch(() => null); return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" }; };
const maCuaVe = async (ve: string) => { for (let i = 0; i < 20; i++) { const m = new RegExp(`mã cho vé ${ve.slice(0, 8)}…: (\\d{6})`).exec(fs.readFileSync(LOG, "utf8")); if (m) return m[1]; await new Promise((r) => setTimeout(r, 300)); } throw new Error("không thấy mã trong nhật ký"); };
const nguoiNhan = (ve: string) => { const ds = fs.readFileSync(LOG, "utf8").split("\n"); const i = ds.findIndex((d) => d.includes(`mã cho vé ${ve.slice(0, 8)}`)); return /tới (\S+):/.exec(ds[i - 1] ?? "")?.[1]; };
const sai = (ma: string) => String((Number(ma) + 1) % 1_000_000).padStart(6, "0");
const email = `thu-otp-${crypto.randomBytes(3).toString("hex")}@example.test`, mk = crypto.randomBytes(12).toString("base64url");
let chuId = 0, trangId = 0;
try {
  // Đăng ký: phải có mã mới có phiên
  const dk = await goi("", "POST", "/api/auth/register", { email, password: mk, name: "Thử xác thực" });
  console.log(`1. Đăng ký → ${dk.ma}, cần mã=${dk.j?.canMa}, có cookie phiên=${dk.c.startsWith("zn_session")}, gửi tới ${dk.j?.guiToi}`);
  chuId = (await queryOne<{ id: number }>("SELECT id FROM users WHERE email = $1", [email]))!.id;
  const xdk = await goi("", "POST", "/api/auth/xac-thuc", { ve: dk.j.ve, ma: await maCuaVe(dk.j.ve) });
  const daXacThuc = (await queryOne<{ x: string | null }>("SELECT email_xac_thuc_at x FROM users WHERE id = $1", [chuId]))!.x;
  console.log(`2. Gõ đúng mã đăng ký → ${xdk.ma}, có phiên=${xdk.c.startsWith("zn_session")}, email đã xác thực=${!!daXacThuc}`);

  // Đăng nhập: mật khẩu đúng chưa có phiên
  const dn = await goi("", "POST", "/api/auth/login", { email, password: mk });
  console.log(`3. Mật khẩu đúng → ${dn.ma}, cần mã=${dn.j?.canMa}, có cookie phiên=${dn.c.startsWith("zn_session")}`);
  const ma = await maCuaVe(dn.j.ve);
  const s1 = await goi("", "POST", "/api/auth/xac-thuc", { ve: dn.j.ve, ma: sai(ma) });
  console.log(`4. Gõ sai mã → ${s1.ma} "${s1.j?.error}"`);
  const ok = await goi("", "POST", "/api/auth/xac-thuc", { ve: dn.j.ve, ma });
  console.log(`5. Gõ đúng mã → ${ok.ma}, có phiên=${ok.c.startsWith("zn_session")}, /auth/me → ${(await goi(ok.c, "GET", "/api/auth/me")).ma}`);
  console.log(`6. Dùng lại vé vừa xong → ${(await goi("", "POST", "/api/auth/xac-thuc", { ve: dn.j.ve, ma })).ma}`);

  // Đoán song song 20 mã sai rồi mới gõ mã đúng
  const dn2 = await goi("", "POST", "/api/auth/login", { email, password: mk });
  const ma2 = await maCuaVe(dn2.j.ve);
  const bắn = await Promise.all(Array.from({ length: 20 }, (_, i) => goi("", "POST", "/api/auth/xac-thuc", { ve: dn2.j.ve, ma: sai(String(Number(ma2) + i)) })));
  const sauDoan = await goi("", "POST", "/api/auth/xac-thuc", { ve: dn2.j.ve, ma: ma2 });
  console.log(`7. Bắn song song 20 mã sai → các mã: ${JSON.stringify(bắn.reduce((t: any, r) => ({ ...t, [r.ma]: (t[r.ma] ?? 0) + 1 }), {}))}; sau đó gõ ĐÚNG mã → ${sauDoan.ma} (phải bị chặn)`);
  const lanSai = (await queryOne<{ s: number }>("SELECT so_lan_sai s FROM ma_xac_thuc WHERE id = $1", [dn2.j.ve]))?.s;
  console.log(`   số lượt thực sự được so: ${lanSai} (tối đa 5)`);

  // Vé hết hạn
  const dn3 = await goi("", "POST", "/api/auth/login", { email, password: mk });
  const ma3 = await maCuaVe(dn3.j.ve);
  await query("UPDATE ma_xac_thuc SET het_han = now() - interval '1 second' WHERE id = $1", [dn3.j.ve]);
  console.log(`8. Mã đúng nhưng vé hết hạn → ${(await goi("", "POST", "/api/auth/xac-thuc", { ve: dn3.j.ve, ma: ma3 })).ma}`);

  // Bị khoá giữa hai bước
  const dn4 = await goi("", "POST", "/api/auth/login", { email, password: mk });
  const ma4 = await maCuaVe(dn4.j.ve);
  await query("UPDATE users SET is_active = false WHERE id = $1", [chuId]);
  console.log(`9. Bị khoá sau khi nhận mã → ${(await goi("", "POST", "/api/auth/xac-thuc", { ve: dn4.j.ve, ma: ma4 })).ma}`);
  await query("UPDATE users SET is_active = true WHERE id = $1", [chuId]);

  // Xin mã quá nhiều (đã dùng 5 mã trong giờ: đăng ký + 4 lần đăng nhập)
  const dn5 = await goi("", "POST", "/api/auth/login", { email, password: mk });
  console.log(`10. Xin mã lần thứ 6 trong giờ → ${dn5.ma} "${dn5.j?.error ?? ""}"`);

  // Trang con: mã về email chủ chuỗi
  await query("DELETE FROM ma_xac_thuc WHERE user_id = $1", [chuId]);
  const dn6 = await goi("", "POST", "/api/auth/login", { email, password: mk });
  const cChu = (await goi("", "POST", "/api/auth/xac-thuc", { ve: dn6.j.ve, ma: await maCuaVe(dn6.j.ve) })).c;
  const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten: "Trang thử OTP" });
  trangId = t.j.data.id;
  const dnTrang = await goi("", "POST", "/api/auth/login", { email: t.j.data.tenDangNhap, password: t.j.data.matKhauTam });
  await maCuaVe(dnTrang.j.ve);
  console.log(`11. Trang con đăng nhập thẳng → ${dnTrang.ma}, cần mã=${dnTrang.j?.canMa}, mã gửi tới: ${nguoiNhan(dnTrang.j.ve)} (phải là email chủ chuỗi ${email})`);
  console.log(`12. Mật khẩu sai → ${(await goi("", "POST", "/api/auth/login", { email, password: "sai-mat-khau-123" })).ma} (không gửi mã)`);
} catch (e) { console.log("LỖI KỊCH BẢN:", e instanceof Error ? e.message : e); }
finally {
  if (trangId) await query("DELETE FROM users WHERE id = $1", [trangId]).catch(() => {});
  if (chuId) { await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [chuId]); await query("DELETE FROM users WHERE id = $1", [chuId]).catch((e) => console.log("dọn:", e.message)); }
  await query("DELETE FROM login_attempts WHERE email LIKE 'thu-otp-%'");
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE id = ANY($1::int[])", [[chuId, trangId]])).rowCount);
  process.exit(0);
}

/*
 * Xoá mọi tài khoản trừ tài khoản quản trị tổng của chủ hệ thống.
 * Chạy "xem" để xem trước; chạy "xoa" mới xoá thật.
 */
import { query, queryOne } from "../../server/db.js";
import * as zernio from "../../server/services/zernio.js";
const GIU = "hoangtuan3310tn@gmail.com";
const che = process.argv[2] === "xoa" ? "xoa" : "xem";
const giu = (await queryOne<{ id: number }>("SELECT id FROM users WHERE lower(email) = $1 AND role = 'admin'", [GIU]))!;
const hoSoCuaGiu = new Set((await query<{ r: string }>(
  "SELECT profile_ref r FROM users WHERE id = $1 AND profile_ref IS NOT NULL UNION SELECT profile_ref FROM trang WHERE user_id = $1", [giu.id])).rows.map((x) => x.r));
// Trang con trước (có parent_id), rồi tới tài khoản khác.
const ds = (await query<{ id: number; email: string; parent_id: number | null }>(
  "SELECT id, email, parent_id FROM users WHERE id <> $1 ORDER BY (parent_id IS NULL), id", [giu.id])).rows;
console.log(`Giữ: #${giu.id} ${GIU} (hồ sơ được bảo vệ: ${hoSoCuaGiu.size})\nSẽ xoá ${ds.length} tài khoản (${che === "xoa" ? "XOÁ THẬT" : "chỉ xem trước"}):`);
let loi = 0;
for (const u of ds) {
  const hoSo = (await query<{ r: string }>(
    "SELECT profile_ref r FROM users WHERE id = $1 AND profile_ref IS NOT NULL UNION SELECT profile_ref FROM trang WHERE user_id = $1", [u.id])).rows
    .map((x) => x.r).filter((r) => !hoSoCuaGiu.has(r));
  console.log(`  #${u.id} ${u.email} — hồ sơ bên nhà cung cấp cần dọn: ${hoSo.length}`);
  if (che !== "xoa") continue;
  await query("DELETE FROM users WHERE id = $1", [u.id]);
  for (const r of hoSo) {
    try { await zernio.xoaHoSo(r); } catch (e) { loi++; console.log(`     ⚠ chưa dọn được hồ sơ ${r}: ${e instanceof Error ? e.message : e}`); }
  }
  await query(
    `INSERT INTO admin_audit (admin_id, target_id, target_email, action, detail) VALUES ($1, NULL, $2, 'xoa_tai_khoan', $3::jsonb)`,
    [giu.id, u.email, JSON.stringify({ lyDo: "Chủ hệ thống yêu cầu chỉ giữ một tài khoản quản trị", hoSo })]
  ).catch((e) => console.log("     (không ghi được nhật ký:", e.message, ")"));
}
if (che === "xoa") {
  console.log(`\nCòn lại: ${JSON.stringify((await query("SELECT id, email, role FROM users ORDER BY id")).rows)} | lỗi dọn hồ sơ: ${loi}`);
}
process.exit(0);

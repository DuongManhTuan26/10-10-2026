import { query, queryOne } from "../../server/db.js";
import { hashPassword, verifyPassword } from "../../server/auth.js";
const EMAIL = "hoangtuan3310tn@gmail.com";
const u = await queryOne<{ id: number; role: string; is_active: boolean }>("SELECT id, role, is_active FROM users WHERE lower(email) = $1", [EMAIL]);
console.log("trước:", u);
if (process.argv[2] === "dat" && u) {
  await query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [u.id, await hashPassword(EMAIL)]);
  // Mật khẩu đổi thì mọi phiên cũ phải chết, kể cả phiên xem thay đã mở.
  await query("DELETE FROM sessions WHERE user_id = $1 OR mo_boi = $1", [u.id]);
  await query("DELETE FROM login_attempts WHERE lower(email) = $1", [EMAIL]);
  const sau = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [u.id]);
  console.log("đã đặt mật khẩu mới, khớp:", await verifyPassword(EMAIL, sau!.password_hash));
}
process.exit(0);

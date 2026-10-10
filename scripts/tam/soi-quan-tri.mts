import fs from "node:fs";
import { queryOne } from "../../server/db.js";
import { verifyPassword } from "../../server/auth.js";
const qt = JSON.parse(fs.readFileSync("/private/tmp/claude-501/-Users-mac/980857a1-af64-4180-80b9-71cccadaf19f/scratchpad/quan-tri.json", "utf8"));
const u = await queryOne<{ id: number; email: string; role: string; is_active: boolean; password_hash: string }>(
  "SELECT id, email, role, is_active, password_hash FROM users WHERE lower(email) = $1", [qt.ten]);
console.log(u ? `còn tài khoản: ${u.email} | vai: ${u.role} | đang hoạt động: ${u.is_active} | mật khẩu khớp: ${await verifyPassword(qt.mk, u.password_hash)}` : "KHÔNG CÒN tài khoản");
process.exit(0);

import { query } from "../../server/db.js";
const u = (await query(`SELECT id, email, role, updated_at, password_hash IS NOT NULL co_mk FROM users WHERE id = 5`)).rows[0];
console.log({ id: u?.id, email: u?.email, role: u?.role, updated_at: u?.updated_at, co_mk: u?.co_mk });
console.log((await query(`SELECT count(*)::int n, max(created_at) cuoi FROM login_attempts WHERE created_at > now() - interval '1 hour'`).catch((e) => ({ rows: [String(e)] }))).rows);
console.log((await query(`SELECT action, created_at FROM admin_audit_log WHERE created_at > now() - interval '1 day' ORDER BY created_at DESC LIMIT 5`).catch((e) => ({ rows: [String(e).slice(0, 80)] }))).rows);
process.exit(0);

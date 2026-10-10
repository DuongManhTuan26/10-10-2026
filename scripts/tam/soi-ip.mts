import "dotenv/config";
import { pool } from "../../server/db.js";
const r = await pool.query("SELECT ip FROM login_attempts WHERE email = 'xff-sau-16009@vidu.com' ORDER BY created_at");
console.log("IP máy chủ ghi nhận:", r.rows.map((x) => x.ip).join(", "));
await pool.query("DELETE FROM login_attempts WHERE email = 'xff-sau-16009@vidu.com'");
await pool.end();

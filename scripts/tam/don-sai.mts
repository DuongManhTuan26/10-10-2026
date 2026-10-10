import "dotenv/config";
import { pool } from "../../server/db.js";
const r = await pool.query("DELETE FROM login_attempts WHERE lower(email) LIKE 'abc@noi-bo.local' OR email LIKE 'khongcoai-%' RETURNING id");
console.log(`đã xoá ${r.rowCount} lần sai của phép thử`);
await pool.end();

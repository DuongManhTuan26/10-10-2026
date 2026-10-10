import "dotenv/config";
import { pool } from "../../server/db.js";
const r = await pool.query("DELETE FROM users WHERE email LIKE 'dkhangloat1790482351-%' RETURNING id");
console.log("đã dọn " + r.rowCount + " tài khoản thử");
await pool.end();

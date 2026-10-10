import "dotenv/config";
import { pool } from "../../server/db.js";
const u = await pool.query("DELETE FROM users WHERE email LIKE 'dksau1790482503-%' RETURNING id");
const d = await pool.query("DELETE FROM dang_ky_theo_ip WHERE ip IN ('7.7.7.7','3.3.3.3') RETURNING id");
console.log("đã dọn " + u.rowCount + " tài khoản thử, " + d.rowCount + " dòng đếm");
await pool.end();

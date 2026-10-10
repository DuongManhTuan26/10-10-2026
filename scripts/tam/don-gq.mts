import "dotenv/config";
import { pool } from "../../server/db.js";
const r = await pool.query("DELETE FROM users WHERE email = 'gan-quyen-32001@vidu-thu-nghiem.com' RETURNING id");
await pool.query("DELETE FROM dang_ky_theo_ip WHERE ip = '4.4.4.4'");
console.log("đã dọn " + r.rowCount + " tài khoản thử");
await pool.end();

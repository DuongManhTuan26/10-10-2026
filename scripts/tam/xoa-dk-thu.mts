import { query } from "../../server/db.js";
const r = await query(`DELETE FROM dang_ky_theo_ip WHERE ip = '127.0.0.1' AND created_at > now() - interval '2 hours'`);
console.log("đã xoá", r.rowCount, "dòng đếm thử"); process.exit(0);

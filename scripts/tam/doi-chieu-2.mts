import { query } from "../../server/db.js";
const bang = (await query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%migrat%'`)).rows;
console.log(bang);
for (const b of bang) console.log((await query(`SELECT * FROM ${b.table_name} ORDER BY 1 DESC LIMIT 12`)).rows);
console.log((await query(`SELECT id, user_id, model, trang_thai, gia_uoc, gia_thuc, created_at FROM video_ai ORDER BY id`)).rows);
process.exit(0);

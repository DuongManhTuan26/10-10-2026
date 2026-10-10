import { query } from "../../server/db.js";
console.table((await query(`SELECT id, model, trang_thai, gia_uoc_tinh, gia_thuc, left(coalesce(loi,''),80) AS loi, (url IS NOT NULL) AS co_url, age(now(), created_at)::text AS tuoi FROM video_ai ORDER BY id`)).rows);
process.exit(0);

import { query } from "../../server/db.js";
const r = await query("SELECT table_name, column_name FROM information_schema.columns WHERE (table_name = 'video_ai' AND column_name IN ('kiem_dinh','bo_qua')) OR (table_name = 'du_an_video' AND column_name IN ('tu_kiem','so_lan_ve_lai'))");
console.log(r.rows.map((x: any) => `${x.table_name}.${x.column_name}`).sort().join(", "));
process.exit(0);

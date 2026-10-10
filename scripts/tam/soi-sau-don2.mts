import { query } from "../../server/db.js";
console.log("dự án video còn lại:", (await query("SELECT count(*)::int c FROM du_an_video")).rows[0].c, "| việc video còn lại:", (await query("SELECT count(*)::int c FROM video_ai")).rows[0].c);
console.log("tổng tiền video đã ghi sổ (USD):", (await query("SELECT round(sum(cost_usd)::numeric, 4) s, count(*)::int n FROM ai_usage WHERE task = 'video'")).rows[0]);
process.exit(0);

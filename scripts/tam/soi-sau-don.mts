import { query } from "../../server/db.js";
console.log("việc video còn lại:", (await query("SELECT count(*)::int c FROM video_ai")).rows[0].c);
console.log("tiền video đã ghi sổ (USD):", (await query("SELECT coalesce(sum(cost_usd),0)::float s, count(*)::int n FROM ai_usage WHERE task = 'video'")).rows[0]);
process.exit(0);

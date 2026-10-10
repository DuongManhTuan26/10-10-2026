import { query } from "../../server/db.js";
console.log("Sổ chi phí AI theo loại (toàn bộ):");
console.table((await query(`SELECT task, count(*)::int lan, round(sum(cost_usd)::numeric, 4) usd, max(created_at)::date gan_nhat FROM ai_usage GROUP BY task ORDER BY usd DESC`)).rows);
console.log("Tổng trong sổ (USD):", (await query("SELECT round(sum(cost_usd)::numeric,4) s FROM ai_usage")).rows[0].s);
process.exit(0);

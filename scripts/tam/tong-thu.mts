import { query } from "../../server/db.js";
const u = await query(`SELECT DISTINCT user_id FROM du_an_video WHERE id IN (8, 9)`);
const ids = u.rows.map((x: any) => x.user_id);
console.log("tài khoản của dự án 8, 9:", ids);
const r = await query(`SELECT viec, count(*)::int n, sum(coalesce(cost_ncc, cost_usd))::float tien, count(*) FILTER (WHERE doi_chieu_at IS NOT NULL)::int dc
  FROM ai_usage WHERE user_id = ANY($1) AND created_at > now() - interval '4 hours' GROUP BY viec ORDER BY tien DESC`, [ids]);
let tong = 0;
for (const x of r.rows) { tong += x.tien; console.log(x.viec.padEnd(20), String(x.n).padStart(3), "lượt", x.tien.toFixed(4), "| đã đối chiếu", x.dc); }
console.log("TỔNG 4 giờ qua:", tong.toFixed(4));
process.exit(0);

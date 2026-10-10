import { query } from "../../server/db.js";
const r = await query(`SELECT viec, cost_usd, cost_ncc, doi_chieu_at IS NOT NULL AS da_doi_chieu, created_at
  FROM ai_usage WHERE created_at > now() - interval '2 hours' AND (viec LIKE '%video%' OR viec = 'chia_canh') ORDER BY created_at`);
for (const x of r.rows) console.log(x.created_at.toISOString().slice(11, 19), x.viec, "ghi", x.cost_usd, "| NCC", x.cost_ncc, "| đối chiếu", x.da_doi_chieu);
process.exit(0);

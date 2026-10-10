import { query } from "../../server/db.js";
const r = await query(`SELECT viec, model, cost_usd, ma_ncc IS NOT NULL co_ma, loi FROM ai_usage WHERE viec IN ('giong_doc','nhac_nen','nghe_kiem_tra') ORDER BY created_at`);
for (const x of r.rows) console.log(x.viec, x.model, x.cost_usd, "mã:", x.co_ma, x.loi ?? "");
process.exit(0);

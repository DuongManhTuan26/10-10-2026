import { query } from "../../server/db.js";
const r = await query(`SELECT created_at, model, prompt_tokens, completion_tokens, cost_usd, loi FROM ai_usage WHERE viec = 'chia_canh' ORDER BY created_at DESC LIMIT 3`);
for (const x of r.rows) console.log(x.created_at.toISOString().slice(11,19), x.model, x.prompt_tokens, x.completion_tokens, x.cost_usd, x.loi);
process.exit(0);

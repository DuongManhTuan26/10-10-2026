import { query } from "../../server/db.js";
console.table((await query(`SELECT id, to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM HH24:MI:SS') luc, user_id, task, viec, model, ma_ncc, prompt_tokens pt, completion_tokens ct, cost_usd::text, cost_ncc::text, doi_chieu_at IS NOT NULL da_dc, loi FROM ai_usage WHERE created_at > now() - interval '2 hours' ORDER BY id`)).rows);
process.exit(0);

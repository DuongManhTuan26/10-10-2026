import { query } from "../../server/db.js";
console.table((await query(`SELECT id, to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI:SS') luc, user_id, viec, model, left(ma_ncc, 22) ma, prompt_tokens pt, completion_tokens ct, cost_usd::text, cost_ncc::text, loi FROM ai_usage WHERE created_at > now() - interval '15 minutes' ORDER BY id`)).rows);
process.exit(0);

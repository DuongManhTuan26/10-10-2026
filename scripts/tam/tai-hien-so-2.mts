import { query } from "../../server/db.js";
await query(`DELETE FROM ai_usage WHERE ma_ncc LIKE 'gen-gia-%'`);
await query(`INSERT INTO ai_usage (task, viec, model, ma_ncc, cost_usd, created_at) VALUES ('sales','thu_ai','x','gen-gia-ket', 0.001, now() - interval '2 hours')`);
await query(`UPDATE ai_usage SET doi_chieu_at = NULL, cost_ncc = NULL WHERE id = 22`);
console.log((await query(`SELECT id, ma_ncc, created_at, now() bay_gio FROM ai_usage WHERE ma_ncc IS NOT NULL AND doi_chieu_at IS NULL AND created_at < now() - interval '3 minutes' ORDER BY created_at LIMIT 5`)).rows);
await query(`DELETE FROM ai_usage WHERE ma_ncc LIKE 'gen-gia-%'`);
await query(`UPDATE ai_usage SET doi_chieu_at = now(), cost_ncc = cost_usd WHERE id = 22 AND doi_chieu_at IS NULL`);
process.exit(0);

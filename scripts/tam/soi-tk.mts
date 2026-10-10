import { query } from "../../server/db.js";
const r = await query(`SELECT u.id, u.email, u.role, u.is_active, u.parent_id, u.created_at::date
  FROM users u ORDER BY u.id`);
console.table(r.rows);
process.exit(0);

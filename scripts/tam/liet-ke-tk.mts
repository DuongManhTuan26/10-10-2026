import { query } from "../../server/db.js";
const r = await query(`SELECT u.id, u.email, u.name, u.role, u.parent_id,
  (SELECT count(*)::int FROM social_accounts s WHERE s.user_id = u.id) AS kenh,
  (SELECT count(*)::int FROM conversations c WHERE c.user_id = u.id) AS hoi_thoai,
  (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id) AS don,
  (SELECT count(*)::int FROM posts p WHERE p.user_id = u.id) AS bai,
  (u.profile_ref IS NOT NULL) AS co_ho_so_ncc
  FROM users u ORDER BY u.id`);
console.table(r.rows);
process.exit(0);

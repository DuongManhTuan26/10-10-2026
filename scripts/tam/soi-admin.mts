import { query } from "../../server/db.js";
console.log("trang của mỗi tài khoản:"); console.table((await query(`SELECT u.id, u.role, (SELECT count(*)::int FROM trang t WHERE t.user_id = u.id) AS so_trang, (SELECT count(*)::int FROM social_accounts s WHERE s.user_id = u.id) AS so_kenh FROM users u ORDER BY u.id`)).rows);
process.exit(0);

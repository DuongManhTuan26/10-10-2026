import { query } from "../../server/db.js";
console.log((await query(`SELECT ip, count(*)::int c, min(created_at) dau FROM dang_ky_theo_ip WHERE created_at > now() - interval '1 hour' GROUP BY ip`)).rows);
process.exit(0);

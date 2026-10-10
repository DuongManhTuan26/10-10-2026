import { query } from "../../server/db.js";
console.log("bảng ma_xac_thuc:", (await query("SELECT to_regclass('public.ma_xac_thuc') AS b")).rows[0].b);
console.log("cột users.email_xac_thuc_at:", (await query("SELECT count(*)::int c FROM information_schema.columns WHERE table_name='users' AND column_name='email_xac_thuc_at'")).rows[0].c);
console.log("migration đã ghi:", (await query("SELECT count(*)::int c FROM schema_migrations")).rows[0].c, "/ tệp: 28");
process.exit(0);

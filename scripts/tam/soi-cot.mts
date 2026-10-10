import { query } from "../../server/db.js";
const r = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'du_an_video' AND column_name IN ('chi_phi_them','am_thanh','nhac_url')");
console.log("cột:", r.rows.map((x: any) => x.column_name).sort().join(", "));
const m = await query("SELECT * FROM schema_migrations ORDER BY 1 DESC LIMIT 3").catch((e) => ({ rows: [String(e.message)] }));
console.log(m.rows);
process.exit(0);

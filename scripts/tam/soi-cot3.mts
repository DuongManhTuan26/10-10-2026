import { query } from "../../server/db.js";
const r = await query("SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'du_an_video' AND column_name = 'che_do'");
console.log("cột che_do:", r.rows);
process.exit(0);

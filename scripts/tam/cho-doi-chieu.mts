import { query } from "../../server/db.js";
for (let i = 0; i < 30; i++) {
  const r = (await query(`SELECT id, cost_usd::text, cost_ncc::text, doi_chieu_at FROM ai_usage WHERE id IN (21, 22) ORDER BY id`)).rows;
  if (r.every((x: any) => x.doi_chieu_at)) { console.log("XONG", JSON.stringify(r)); process.exit(0); }
  await new Promise((x) => setTimeout(x, 60_000));
}
console.log("HẾT GIỜ CHỜ"); process.exit(1);

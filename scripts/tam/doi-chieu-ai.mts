import { query } from "../../server/db.js";
import { env } from "../../server/env.js";
const dau = { Authorization: `Bearer ${env.openrouter.apiKey}` };
const so = (await query(`SELECT task, count(*)::int lan, sum(cost_usd)::float usd, min(created_at) dau, max(created_at) cuoi,
  count(*) FILTER (WHERE cost_usd = 0)::int lan_0d FROM ai_usage GROUP BY task ORDER BY usd DESC`)).rows;
console.table(so);
console.log("tổng sổ:", so.reduce((t: number, r: any) => t + r.usd, 0));
const key = await (await fetch("https://openrouter.ai/api/v1/key", { headers: dau })).json();
console.log("key:", JSON.stringify(key.data));
for (const u of ["https://openrouter.ai/api/v1/activity", "https://openrouter.ai/api/v1/credits"]) {
  const r = await fetch(u, { headers: dau });
  const t = await r.text();
  console.log(u, r.status, t.slice(0, 1500));
}
process.exit(0);

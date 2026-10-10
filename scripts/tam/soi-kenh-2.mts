import { env } from "../../server/env.js";
import { query } from "../../server/db.js";
const h = { Authorization: `Bearer ${env.zernio.apiKey}` };
for (const u of ["/profiles", "/accounts"]) {
  const r = await fetch(`${env.zernio.baseUrl}${u}`, { headers: h });
  const j: any = await r.json();
  const ds = j.profiles ?? j.accounts ?? j.data ?? j;
  console.log(u, r.status, JSON.stringify(Array.isArray(ds) ? ds.map((x: any) => ({ id: x._id ?? x.id, ten: x.name ?? x.displayName ?? x.username, nen: x.platform, hoatDong: x.isActive ?? x.status ?? x.connected, ho_so: x.profileId?._id ?? x.profileId })) : ds).slice(0, 1500));
}
console.log((await query(`SELECT id, user_id, platform, connected, updated_at FROM social_accounts ORDER BY id`).catch((e) => ({ rows: [String(e)] }))).rows);
process.exit(0);

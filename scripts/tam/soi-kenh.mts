import { env } from "../../server/env.js";
const r = await fetch(`${env.zernio.baseUrl}/usage-stats`, { headers: { Authorization: `Bearer ${env.zernio.apiKey}` } });
console.log(r.status, JSON.stringify(await r.json(), null, 1).slice(0, 2500));
process.exit(0);

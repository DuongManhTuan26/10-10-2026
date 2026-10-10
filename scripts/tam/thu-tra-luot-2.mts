import { env } from "../../server/env.js";
const dau = { Authorization: `Bearer ${env.openrouter.apiKey}` };
const id = process.argv[2];
const g = await fetch(`https://openrouter.ai/api/v1/generation?id=${id}`, { headers: dau });
console.log(g.status, (await g.text()).slice(0, 1500));
const k = (await (await fetch("https://openrouter.ai/api/v1/key", { headers: dau })).json()).data;
console.log("key.usage", k.usage, "daily", k.usage_daily);
process.exit(0);

import { env } from "../../server/env.js";
const r = await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } });
const j: any = await r.json();
const ds = j.data ?? j.models ?? j;
for (const m of ds) console.log([m.id, m.name, (m.supported_resolutions ?? []).join("/"), JSON.stringify(m.pricing_skus ?? m.pricing ?? {}).slice(0, 140), m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : ""].join(" | "));
console.log("TỔNG", ds.length);
process.exit(0);

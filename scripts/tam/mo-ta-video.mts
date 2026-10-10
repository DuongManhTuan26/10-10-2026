import { env } from "../../server/env.js";
const r = await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } });
const ds: any[] = (await r.json()).data;
for (const id of ["alibaba/wan-3.0", "minimax/hailuo-3", "minimax/hailuo-3-max", "runway/aleph-2", "black-forest-labs/flux-video-edit"]) {
  const m = ds.find((x) => x.id === id); console.log("==", id); console.log((m?.description ?? "").slice(0, 900)); console.log("giá:", JSON.stringify(m?.pricing_skus));
}
process.exit(0);

import { env } from "../../server/env.js";
const r = await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } });
const ds: any[] = (await r.json()).data;
for (const id of ["minimax/hailuo-3-max", "alibaba/wan-3.0", "minimax/hailuo-3", "black-forest-labs/flux-video-edit", "runway/aleph-2", "black-forest-labs/flux-video-upscale"]) {
  const m = ds.find((x) => x.id === id); if (!m) { console.log(id, "KHÔNG CÓ"); continue; }
  const { id: _i, name, description, pricing_skus, ...con } = m;
  console.log("==", id, "|", name); console.log(JSON.stringify(con)); console.log("giá:", JSON.stringify(pricing_skus));
}
process.exit(0);

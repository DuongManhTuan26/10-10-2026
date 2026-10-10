import { env } from "../../server/env.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
for (const id of ["black-forest-labs/flux-3-video", "runway/gen-4.5", "x-ai/grok-imagine-video-1.5", "x-ai/grok-imagine-video", "heygen/heygen-video-1", "heygen/avatar-iv"]) {
  const m = ds.find((x) => x.id === id);
  console.log(id, JSON.stringify(m.pricing_skus), "\n   desc:", String(m.description ?? "").slice(0, 300), "\n   keys:", Object.keys(m).join(","));
}
process.exit(0);

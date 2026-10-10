import { env } from "../../server/env.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
for (const id of ["google/veo-3.1-lite", "heygen/heygen-video-1", "bytedance/seedance-2.0-mini"]) {
  const m = ds.find((x) => x.id === id);
  const { description, ...r } = m;
  console.log(JSON.stringify(r), "\n  MÔ TẢ:", description, "\n");
}
process.exit(0);

import { env } from "../../server/env.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
for (const id of ["bytedance/seedance-2.5", "bytedance/seedance-2.0", "google/veo-3.1", "google/veo-3.1-fast", "kwaivgi/kling-v3.0-pro", "alibaba/wan-3.0", "minimax/hailuo-3"]) {
  const m = ds.find((x) => x.id === id);
  if (!m) { console.log(id, "KHÔNG CÓ"); continue; }
  console.log(`${id}\n  passthrough: ${JSON.stringify(m.allowed_passthrough_parameters)}\n  frame: ${JSON.stringify(m.supported_frame_images)} | giây: ${(m.supported_durations ?? []).join(",")} | độ nét: ${(m.supported_resolutions ?? []).join(",")}\n  giá: ${JSON.stringify(m.pricing_skus)}\n  mô tả: ${String(m.description).slice(0, 400)}\n`);
}
process.exit(0);

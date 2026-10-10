import { env } from "../../server/env.js";
const h = { Authorization: `Bearer ${env.openrouter.apiKey}` };
for (const u of ["https://openrouter.ai/api/v1/models?output_modalities=audio", "https://openrouter.ai/api/v1/audio/models", "https://openrouter.ai/api/v1/models"]) {
  const r = await fetch(u, { headers: h }); const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { console.log(u, r.status, t.slice(0, 200)); continue; }
  const ds: any[] = j.data ?? [];
  const am = ds.filter((m) => JSON.stringify(m.architecture?.output_modalities ?? m.output_modalities ?? []).includes("audio") || /tts|speech|voice/i.test(m.id));
  console.log("==", u, r.status, "tổng", ds.length, "có âm thanh/giọng:", am.length);
  for (const m of am.slice(0, 40)) console.log("  ", m.id, "|", JSON.stringify(m.architecture?.output_modalities ?? m.output_modalities), "|", JSON.stringify(m.pricing ?? m.pricing_skus).slice(0, 120));
}
process.exit(0);

import { env } from "../../server/env.js";
const H = { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } };
for (const q of ["output_modalities=speech", "output_modalities=audio", "output_modalities=all"]) {
  const j: any = await (await fetch(`https://openrouter.ai/api/v1/models?${q}`, H)).json();
  const ds = (j.data ?? []).filter((m: any) => /tts|speech|voice|audio|eleven|lyria/i.test(m.id) || (m.architecture?.output_modalities ?? []).some((x: string) => x !== "text" && x !== "image"));
  console.log(`== ${q}: ${ds.length}`);
  for (const m of ds) console.log(" ", m.id, "|", (m.architecture?.output_modalities ?? []).join(","), "|", JSON.stringify(m.pricing).slice(0, 200));
}
process.exit(0);

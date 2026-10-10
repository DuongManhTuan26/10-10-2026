import { env } from "../../server/env.js";
const j: any = await (await fetch("https://openrouter.ai/api/v1/models?output_modalities=audio", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json();
for (const m of j.data ?? []) console.log(m.id, "|", m.architecture?.input_modalities?.join(","), "→", m.architecture?.output_modalities?.join(","), "|", JSON.stringify(m.pricing).slice(0, 160));
const t: any = await (await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json();
console.log("---- có chữ tts/music/lyria/audio trong id:");
for (const m of t.data ?? []) if (/tts|music|lyria|audio|speech|voice/i.test(m.id)) console.log(m.id, "→", m.architecture?.output_modalities?.join(","));
process.exit(0);

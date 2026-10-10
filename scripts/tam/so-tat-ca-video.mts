import { env } from "../../server/env.js";
import { chuanHoaModel, giaMoiGiay } from "../../server/services/video-ai.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
for (const raw of ds) {
  const m = chuanHoaModel(raw);
  if (!m) continue;
  const gia = (dn: string) => { if (!m.doNet.includes(dn)) return "  —  "; const g = giaMoiGiay(m, { soGiay: m.soGiay.includes(5) ? 5 : m.soGiay[0], doNet: dn, khung: m.khung.includes("9:16") ? "9:16" : m.khung[0], coTieng: false, coAnhMoDau: false }); return g === null ? " null" : g.toFixed(3); };
  console.log(`${m.id.padEnd(36)} ${m.doNet.map((d) => d + ":" + gia(d)).join(" ")} | giây ${m.soGiay.join(",")} | ảnh đầu ${m.anhMoDau} | tiếng ${m.coTieng} | khung ${m.khung.join(",")}`);
}
process.exit(0);

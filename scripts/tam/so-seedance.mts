import { env } from "../../server/env.js";
import { chuanHoaModel, giaMoiGiay } from "../../server/services/video-ai.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
for (const id of ["bytedance/seedance-2.5", "bytedance/seedance-2.0", "bytedance/seedance-2.0-fast", "bytedance/seedance-2.0-mini", "bytedance/seedance-1-5-pro", "alibaba/wan-3.0", "minimax/hailuo-3-max", "minimax/hailuo-3"]) {
  const m = chuanHoaModel(ds.find((x) => x.id === id));
  if (!m) continue;
  const gia = (dn: string) => { const g = giaMoiGiay(m, { soGiay: 5, doNet: dn, khung: "9:16", coTieng: false, coAnhMoDau: false }); return g === null ? "—" : g.toFixed(3); };
  console.log(`${id.padEnd(28)} 480p ${gia("480p")} | 720p ${gia("720p")} | 1080p ${gia("1080p")} | độ nét: ${m.doNet.join("/")} | tối đa ${Math.max(...m.soGiay)}s | tiếng: ${m.coTieng}`);
}
process.exit(0);

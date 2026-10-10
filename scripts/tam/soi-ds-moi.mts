import { env } from "../../server/env.js";
import { chuanHoaModel, giaMoiGiay, giaVideo } from "../../server/services/video-ai.js";
import { MODEL_VIDEO_DUOC_CHON } from "../../server/services/model-duoc-chon.js";
const ds: any[] = (await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
let loi = 0;
for (const c of MODEL_VIDEO_DUOC_CHON) {
  const raw = ds.find((x) => x.id === c.id);
  const m = raw && chuanHoaModel(raw);
  if (!m || !m.soGiay.length) { console.log("✗ KHÔNG CÓ TRONG DANH MỤC", c.id); loi++; continue; }
  const s = m.soGiay.includes(5) ? 5 : m.soGiay[0];
  const k = m.khung.includes("9:16") ? "9:16" : m.khung[0];
  const gia = m.doNet.map((d) => { const g = giaVideo(m, { soGiay: s, doNet: d, khung: k, coTieng: false, coAnhMoDau: false }); if (g === null) loi++; return `${d}:${g === null ? "NULL" : (g / s).toFixed(3)}`; });
  if (!m.anhMoDau) { console.log("✗ không nhận ảnh mở đầu", c.id); loi++; }
  console.log(`${c.phanKhuc.padEnd(16)} ${c.id.padEnd(32)} ${gia.join(" ")}`);
}
console.log(MODEL_VIDEO_DUOC_CHON.length, "mô hình, lỗi:", loi);
process.exit(0);

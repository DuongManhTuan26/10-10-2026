import { env } from "../../server/env.js";
import { query } from "../../server/db.js";
import { hoanDiaChiKho } from "../../server/services/media-proxy.js";
const url = hoanDiaChiKho((await query(`SELECT url FROM video_ai WHERE id = 12`)).rows[0].url);
for (const model of ["minimax/hailuo-3", "alibaba/wan-3.0"]) {
  const r = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openrouter.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: "đổi màu ly thành đỏ", duration: 1, input_references: [{ type: "video_url", video_url: { url } }] }),
  });
  const t = await r.text();
  console.log("==", model, r.status, t.slice(0, 500));
}
const k = (await (await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } })).json()).data;
console.log("tổng khoá sau thử:", k.usage);
process.exit(0);

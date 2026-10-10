import "dotenv/config";
import { queryOne } from "../../server/db.js";
const url = (await queryOne<{ url: string }>("SELECT url FROM du_an_video WHERE loai='kich_ban' AND url IS NOT NULL ORDER BY id LIMIT 1"))!.url;
for (const model of ["google/gemini-3.8-flash", "qwen/qwen3.8-omni-flash", "xiaomi/mimo-v2.6-flash"]) {
  const t0 = Date.now();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 200, usage: { include: true }, messages: [{ role: "user", content: [
      { type: "text", text: "Mô tả ngắn gọn bằng tiếng Việt: video này có mấy cảnh, mỗi cảnh quay gì, máy quay chuyển động thế nào?" },
      { type: "video_url", video_url: { url } } ] }] }),
    signal: AbortSignal.timeout(120_000),
  });
  const j: any = await r.json().catch(() => null);
  console.log(`\n== ${model} → ${r.status} (${Math.round((Date.now() - t0) / 1000)}s, $${j?.usage?.cost ?? "?"})\n  ${(j?.choices?.[0]?.message?.content ?? JSON.stringify(j?.error ?? j)).slice(0, 400)}`);
}
process.exit(0);

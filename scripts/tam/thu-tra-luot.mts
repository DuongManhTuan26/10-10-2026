import { query } from "../../server/db.js";
import { env } from "../../server/env.js";
const dau = { Authorization: `Bearer ${env.openrouter.apiKey}`, "Content-Type": "application/json" };
const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: dau,
  body: JSON.stringify({ model: "google/gemini-3.7-flash", messages: [{ role: "user", content: "Chào" }], max_tokens: 5, usage: { include: true } }) });
const j = await r.json();
console.log("chat id:", j.id, "usage.cost:", j.usage?.cost);
for (let i = 0; i < 6; i++) {
  await new Promise((x) => setTimeout(x, 2000));
  const g = await fetch(`https://openrouter.ai/api/v1/generation?id=${j.id}`, { headers: dau });
  const t = await g.text();
  console.log(`sau ${(i + 1) * 2}s:`, g.status, t.slice(0, 700));
  if (g.ok) break;
}
const cot = (await query(`SELECT column_name FROM information_schema.columns WHERE table_name='video_ai'`)).rows.map((x: any) => x.column_name);
console.log("video_ai cột:", cot.join(","));
process.exit(0);

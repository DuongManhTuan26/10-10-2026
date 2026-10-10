import "dotenv/config";
const OR = { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` };
for (const d of ["/api/v1/credits", "/api/v1/key", "/api/v1/activity"]) {
  const r = await fetch("https://openrouter.ai" + d, { headers: OR });
  console.log(`OpenRouter GET ${d} → ${r.status}: ${(await r.text()).slice(0, 500)}\n`);
}
const z = await fetch((process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1") + "/usage-stats", { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } });
console.log(`Zernio GET /usage-stats → ${z.status}: ${(await z.text()).slice(0, 1500)}`);

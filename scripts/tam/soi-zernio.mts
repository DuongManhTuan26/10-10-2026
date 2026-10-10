import "dotenv/config";
const G = process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1";
for (const duong of ["/profiles", "/accounts", "/usage-stats", "/webhooks/settings"]) {
  const r = await fetch(G + duong, { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } });
  const t = await r.text();
  console.log(`GET ${duong} → ${r.status} ${t.slice(0, 160).replace(/\s+/g, " ")}`);
}

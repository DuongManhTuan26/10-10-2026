import "dotenv/config";
const j: any = await (await fetch((process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api/v1") + "/profiles", { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } })).json();
for (const p of j.profiles ?? []) console.log(`  ${p._id} ${p.name}${p.isDefault ? " (mặc định)" : ""}`);

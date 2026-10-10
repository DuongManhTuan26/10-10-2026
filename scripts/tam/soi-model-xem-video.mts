import "dotenv/config";
const j: any = await (await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })).json();
const co = (j.data ?? []).filter((m: any) => (m.architecture?.input_modalities ?? []).includes("video"));
console.log(`Model chữ NHẬN VIDEO làm đầu vào: ${co.length}`);
for (const m of co.slice(0, 15)) console.log(`  ${m.id.padEnd(40)} giá vào/1M token: $${(Number(m.pricing?.prompt) * 1e6).toFixed(2)}`);

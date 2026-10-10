import "dotenv/config";
const r = await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
console.log("mã:", r.status);
const j: any = await r.json().catch(() => null);
const ds: any[] = j?.data ?? j ?? [];
const chon = ds.filter((m) => /seedance|veo|wan|kling|hailuo/i.test(m.id ?? ""));
for (const m of chon) {
  const { id, pricing, ...khac } = m;
  console.log("\n==", id);
  console.log(JSON.stringify({ pricing, ...khac }).slice(0, 900));
}
if (!chon.length) console.log(JSON.stringify(j).slice(0, 1500));

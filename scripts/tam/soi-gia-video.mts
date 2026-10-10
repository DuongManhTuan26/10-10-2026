import "dotenv/config";
const r = await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
const j: any = await r.json();
for (const id of ["bytedance/seedance-2.5", "bytedance/seedance-2.0-fast", "bytedance/seedance-2.0-mini", "bytedance/seedance-2.0"]) {
  const m = (j.data ?? j).find((x: any) => x.id === id);
  console.log(id, "| độ dài:", m.supported_durations[0] + "–" + m.supported_durations.at(-1) + "s", "| phân giải:", m.supported_resolutions.join(","), "\n   giá:", JSON.stringify(m.pricing_skus));
}

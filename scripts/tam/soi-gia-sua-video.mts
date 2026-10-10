import "dotenv/config";
const j: any = await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })).json();
for (const id of ["runway/aleph-2", "black-forest-labs/flux-video-edit", "alibaba/wan-2.7", "heygen/avatar-iv"]) {
  const m = (j.data ?? j).find((x: any) => x.id === id);
  console.log(`\n== ${id}\n  mô tả: ${String(m?.description ?? "").slice(0, 260)}\n  giá: ${JSON.stringify(m?.pricing_skus)}\n  độ dài: ${JSON.stringify(m?.supported_durations)} | nét: ${JSON.stringify(m?.supported_resolutions)}`);
}

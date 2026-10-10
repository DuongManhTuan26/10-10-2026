import "dotenv/config";
const j: any = await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })).json();
for (const m of (j.data ?? j)) {
  const coVideoVao = Object.keys(m.pricing_skus ?? {}).some((k) => k.includes("video_input"));
  console.log(`${m.id.padEnd(32)} dài tối đa ${String(m.supported_durations?.at(-1)).padStart(2)}s | tham chiếu ảnh: ${m.supported_frame_images?.join("+") || "-"} | giá có video vào: ${coVideoVao ? "CÓ" : "-"} | tham số riêng: ${(m.allowed_passthrough_parameters ?? []).join(", ") || "-"}`);
}

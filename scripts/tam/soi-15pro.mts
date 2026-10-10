import "dotenv/config";
const j: any = await (await fetch("https://openrouter.ai/api/v1/videos/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })).json();
const m = (j.data ?? j).find((x: any) => x.id === "bytedance/seedance-1-5-pro");
console.log("giá:", JSON.stringify(m.pricing_skus), "\ncó tiếng:", m.generate_audio, "| phân giải:", m.supported_resolutions.join(","));

import { env } from "../../server/env.js";
const H = { headers: { Authorization: `Bearer ${env.openrouter.apiKey}` } };
const c: any = await (await fetch("https://openrouter.ai/api/v1/credits", H)).json();
const k: any = await (await fetch("https://openrouter.ai/api/v1/key", H)).json();
console.log("tổng nạp:", c.data?.total_credits, "| đã dùng:", c.data?.total_usage, "| còn:", (c.data?.total_credits - c.data?.total_usage).toFixed(4));
console.log("giới hạn khoá:", k.data?.limit, "| còn theo khoá:", k.data?.limit_remaining);
process.exit(0);

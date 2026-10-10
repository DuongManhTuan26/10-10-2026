import { layNhatKyWebhook } from "../../server/services/zernio.js";
import { env } from "../../server/env.js";
const s = await (await fetch(`${env.zernio.baseUrl}/webhooks/settings`, { headers: { Authorization: `Bearer ${env.zernio.apiKey}` } })).json();
const h = s.webhooks?.[0];
console.log("ĐĂNG KÝ:", h?.url, "| đang hoạt động:", h?.isActive, "| ngắt gửi từ:", h?.attemptFailingSince ?? "không", "| sự kiện:", (h?.events ?? []).join(","));
for (const l of (await layNhatKyWebhook(8)) as any[]) console.log("GIAO:", l.createdAt ?? l.timestamp, l.event, l.status, l.statusCode ?? "", (l.url ?? "").slice(8, 50), l.errorMessage ?? "");
process.exit(0);

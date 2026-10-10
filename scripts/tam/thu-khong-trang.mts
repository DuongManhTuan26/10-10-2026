import crypto from "node:crypto";
import { query } from "../../server/db.js";
const GOC = "http://127.0.0.1:3001";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const j: any = await r.json().catch(() => null);
  return { ma: r.status, loi: j?.debug ?? j?.error ?? "", c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const email = `thu-kt-${crypto.randomBytes(4).toString("hex")}@example.test`;
let id = 0;
try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: crypto.randomBytes(12).toString("base64url"), name: "Thử không trang" });
  id = (await query<{ id: number }>("SELECT id FROM users WHERE email = $1", [email])).rows[0]?.id;
  const c = dk.c!;
  const thu: [string, string, unknown][] = [
    ["PUT", "/api/ai/configs/sales", { systemPrompt: "Bạn là trợ lý bán hàng", tone: "thân thiện" }],
    ["PUT", "/api/ai/sales-autonomy", { config: { bat: false } }],
    ["PUT", "/api/ai/sales-stages", { stages: [{ ma: "chao", ten: "Chào hỏi", bat: true }] }],
    ["PUT", "/api/ai/auto-pilot", { config: { bat: false } }],
    ["PATCH", "/api/ai/configs/content/settings", { settings: { anhPhongCach: "tối giản" } }],
    ["POST", "/api/ai/configs/sales/documents", { filename: "bang-gia.txt", mimeType: "text/plain", text: "Áo thun 180.000đ" }],
    ["DELETE", "/api/ai/configs/sales/documents/1", undefined],
    ["POST", "/api/ai/generate-post", { topic: "áo thun", goal: "bán hàng", count: 1 }],
    ["POST", "/api/ai/generate-image", { content: "Áo thun mới về" }],
    ["POST", "/api/ai/test", { kind: "sales", message: "giá bao nhiêu" }],
    ["POST", "/api/ads/analyze", {}],
    ["POST", "/api/analytics/analyze", {}],
  ];
  for (const [m, d, b] of thu) { const r = await goi(c, m, d, b); console.log(`${r.ma}  ${m.padEnd(6)} ${d.padEnd(38)} ${String(r.loi).slice(0, 95)}`); }
} finally {
  if (id) { await query("DELETE FROM sessions WHERE user_id = $1", [id]); await query("DELETE FROM users WHERE id = $1", [id]); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount);
  process.exit(0);
}

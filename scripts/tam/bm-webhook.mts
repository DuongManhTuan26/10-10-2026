import "dotenv/config";
import crypto from "node:crypto";
import { pool } from "../../server/db.js";
import { env } from "../../server/env.js";

// Sự kiện loại lạ → máy chủ đánh dấu "ignored", không làm gì với dữ liệu thật.
const eid = `thu-bao-mat-${Date.now()}`;
const than = JSON.stringify({ id: eid, event: "thu.bao.mat.khong.xu.ly" });
const ky = crypto.createHmac("sha256", env.zernio.webhookSecret).update(than).digest("hex");
const gui = async (sig?: string) => {
  const r = await fetch("http://localhost:3000/api/webhooks/zernio", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sig ? { "X-Zernio-Signature": sig } : {}) },
    body: than,
  });
  return r.status;
};
const soDong = async () =>
  (await pool.query("SELECT count(*)::int c FROM webhook_events WHERE event_id=$1", [eid])).rows[0].c;

console.log(`không chữ ký        → ${await gui()}`);
console.log(`chữ ký sai          → ${await gui("sha256=" + "0".repeat(64))}`);
console.log(`chữ ký đúng lần 1   → ${await gui(ky)}  | dòng trong hàng đợi: ${await soDong()}`);
console.log(`gửi LẠI y hệt lần 2 → ${await gui(ky)}  | dòng trong hàng đợi: ${await soDong()}`);
console.log(`gửi LẠI y hệt lần 3 → ${await gui(ky)}  | dòng trong hàng đợi: ${await soDong()}`);
const d = await pool.query("DELETE FROM webhook_events WHERE event_id=$1", [eid]);
console.log(`đã dọn ${d.rowCount} dòng thử`);
await pool.end();

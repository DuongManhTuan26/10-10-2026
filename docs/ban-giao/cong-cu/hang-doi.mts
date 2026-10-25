import { pool } from "/Users/mac/projects/zernio/server/db.js";
console.log("cho", (await pool.query("SELECT COUNT(*)::int AS so FROM webhook_events WHERE status IN ('pending','processing')")).rows[0].so);
const r = await pool.query("SELECT max(received_at) AS cuoi, count(*) FILTER (WHERE received_at > now() - interval '6 hours')::int AS sau6h FROM webhook_events");
console.log("webhook cuoi", r.rows[0].cuoi, "trong 6h", r.rows[0].sau6h);
const s = await pool.query("SELECT max(created_at) AS cuoi FROM send_attempts");
console.log("lan gui cuoi", s.rows[0].cuoi);
await pool.end();

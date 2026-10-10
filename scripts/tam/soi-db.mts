import fs from "node:fs";
import { query } from "../../server/db.js";
const hoi = async (ten: string, sql: string) => {
  try { const r = await query(sql); console.log(`\n## ${ten}`); console.table(r.rows); }
  catch (e) { console.log(`\n## ${ten}\n  LỖI TRUY VẤN: ${e instanceof Error ? e.message : e}`); }
};
const tep = fs.readdirSync("server/migrations").filter((t) => t.endsWith(".sql")).length;
await hoi(`migration đã chạy (số tệp: ${tep})`, "SELECT count(*)::int AS da_chay FROM schema_migrations");
await hoi("sự kiện webhook theo trạng thái", "SELECT status, count(*)::int FROM webhook_events GROUP BY status");
await hoi("sự kiện hỏng 7 ngày qua (lỗi nhóm)", "SELECT left(coalesce(last_error, error, ''), 90) AS loi, count(*)::int FROM webhook_events WHERE status = 'failed' AND received_at > now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 8");
await hoi("sự kiện kẹt ở processing", "SELECT count(*)::int FROM webhook_events WHERE status = 'processing'");
await hoi("hội thoại theo trạng thái", "SELECT status, ai_enabled, count(*)::int FROM conversations GROUP BY 1,2 ORDER BY 1");
await hoi("bài đăng theo trạng thái", "SELECT status, count(*)::int FROM posts GROUP BY 1");
await hoi("bài kẹt 'publishing' quá 1 giờ", "SELECT count(*)::int FROM posts WHERE status = 'publishing' AND updated_at < now() - interval '1 hour'");
await hoi("tài khoản trang có cha không phải quản lý", "SELECT t.id, t.email, c.role AS vai_tro_cha FROM users t JOIN users c ON c.id = t.parent_id WHERE c.role NOT IN ('admin','admin_con')");
await hoi("kênh chưa gắn trang", "SELECT id, user_id, platform, connected FROM social_accounts WHERE trang_id IS NULL");
await hoi("trang con thiếu cấu hình AI", "SELECT u.id, u.email FROM users u WHERE u.role = 'shop' AND NOT EXISTS (SELECT 1 FROM ai_configs a WHERE a.user_id = u.id)");
await hoi("việc bình luận quá hạn chưa làm", "SELECT count(*)::int FROM comment_actions WHERE status = 'pending' AND due_at < now() - interval '1 hour'");
await hoi("AI đang bị tạm ngắt trên kênh", "SELECT id, ai_paused_until, ai_pause_reason FROM social_accounts WHERE ai_paused_until > now()");
await hoi("tin khách chưa được trả lời > 1 giờ (AI bật, trong 24h)", `SELECT c.id, c.status, c.last_customer_message_at FROM conversations c
  WHERE c.ai_enabled AND c.status = 'ai' AND c.last_customer_message_at > now() - interval '24 hours'
    AND c.last_customer_message_at < now() - interval '1 hour'
    AND (SELECT sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) = 'customer' LIMIT 10`);
process.exit(0);

/*
 * Tái hiện: kẻ xấu nhắn ảnh dồn dập vào Fanpage. Mỗi ảnh có làm AI đọc ảnh
 * chạy một lần không, kể cả khi hội thoại đã TẮT AI (chuyển người thật)?
 *
 * An toàn: khoá AI giả (chạy với OPENROUTER_API_KEY giả) nên không tốn tiền;
 * gọi thẳng hàm xử lý, không đưa vào hàng đợi thật; hội thoại để trạng thái
 * 'human' nên không có đường nào gửi tin ra ngoài. Dọn sạch ở cuối.
 */
import crypto from "node:crypto";
import { query } from "../../server/db.js";
import { handleWebhookEvent } from "../../server/services/events.js";
const GOC = "http://127.0.0.1:3000";
const SO_ANH = Number(process.env.SO_ANH ?? 10);
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { ma: r.status, j: await r.json().catch(() => null), c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const duoi = crypto.randomBytes(4).toString("hex");
const email = `thu-dot-anh-${duoi}@example.test`;
const kenh = `thu-kenh-${duoi}`, hoiThoai = `thu-ht-${duoi}`;
let chuId = 0, trangId = 0, cChu = "";
let docAnh = 0; let goiAI = 0;
const errCu = console.error;
console.error = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.includes("AI không xử lý được hội thoại")) { if (goiAI === 0) logCu("lỗi AI lần đầu:", s.slice(-60)); goiAI++; } else if (s.includes("Không đọc được tệp khách gửi")) { if (docAnh === 0) logCu("lỗi lần đầu:", s.slice(-80)); docAnh++; } else errCu(...a); };
const logCu = console.log; console.log = () => {}; const warnCu = console.warn; console.warn = () => {};
try {
  const dk = await goi("", "POST", "/api/auth/register", { email, password: crypto.randomBytes(12).toString("base64url"), name: "Thử đốt ảnh" });
  chuId = dk.j.user.id; cChu = dk.c!;
  const t = await goi(cChu, "POST", "/api/quan-ly/trang", { ten: "Thử đốt ảnh" }); trangId = t.j.data.id;
  const trang = (await query<{ id: number }>("SELECT id FROM trang WHERE user_id = $1 LIMIT 1", [trangId])).rows[0];
  await query(`INSERT INTO social_accounts (id, user_id, platform, trang_id) VALUES ($1, $2, 'facebook', $3)`, [kenh, trangId, trang?.id ?? null]);
  const kh = await query<{ id: number }>(`INSERT INTO customers (user_id, social_account_id, platform, participant_id, name) VALUES ($1,$2,'facebook','thu-khach','Kẻ thử') RETURNING id`, [trangId, kenh]);
  const CHU = process.env.CHE_DO === "chu";
  if (CHU) await query(`UPDATE ai_configs SET settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{tuChu}', '{"bat":true}'::jsonb) WHERE trang_id = $1 AND kind = 'sales'`, [trang.id]);
  await query(`INSERT INTO conversations (id, user_id, social_account_id, customer_id, platform, origin, status, ai_enabled)
               VALUES ($1,$2,$3,$4,'facebook','message',$5,$6)`, [hoiThoai, trangId, kenh, kh.rows[0].id, CHU ? "ai" : "human", CHU]);
  for (let i = 0; i < SO_ANH; i++) {
    await handleWebhookEvent({ eventId: `thu-sk-${duoi}-${i}`, eventType: "message.received", accountId: kenh, payload: { message: {
      id: `thu-tin-${duoi}-${i}`, conversationId: hoiThoai, platform: "facebook", direction: "incoming",
      text: CHU ? `alo shop ơi ${i}` : "",
      attachments: CHU ? [] : [{ type: "image", url: `https://scontent.xx.fbcdn.net/v/thu-${i}.jpg` }],
      sender: { id: "thu-khach", name: "Kẻ thử" }, createdAt: new Date().toISOString() } } });
  }
  const st = (await query<{ status: string }>("SELECT status FROM conversations WHERE id = $1", [hoiThoai])).rows[0];
  const baoChu = (await query(`SELECT count(*)::int c FROM messages WHERE conversation_id = $1 AND sender_type = 'system'`, [hoiThoai])).rows[0].c;
  if (CHU) logCu(`Số lần báo chủ shop trong hội thoại: ${baoChu}`);
  if (CHU) logCu(`Gửi ${SO_ANH} tin chữ vào hội thoại TỰ CHỦ (status=${st.status}) → AI bán hàng bị gọi ${goiAI} lần`);
  else logCu(`Gửi ${SO_ANH} tin có ảnh vào hội thoại ĐÃ TẮT AI (status=${st.status}) → AI đọc ảnh bị gọi ${docAnh} lần`);
} catch (e) { logCu("LỖI KỊCH BẢN:", e instanceof Error ? e.message : e); } finally {
  console.log = logCu; console.warn = warnCu; console.error = errCu;
  await query("DELETE FROM messages WHERE conversation_id = $1", [hoiThoai]);
  await query("DELETE FROM conversations WHERE id = $1", [hoiThoai]);
  await query("DELETE FROM customers WHERE social_account_id = $1", [kenh]);
  await query("DELETE FROM social_accounts WHERE id = $1", [kenh]);
  if (trangId) console.log("dọn trang →", (await goi(cChu, "DELETE", `/api/quan-ly/trang/${trangId}`, { xacNhanTen: "Thử đốt ảnh" })).ma);
  if (chuId) { await query("DELETE FROM sessions WHERE user_id = $1", [chuId]); await query("DELETE FROM users WHERE id = $1", [chuId]); }
  console.log("còn sót:", (await query("SELECT 1 FROM users WHERE id = ANY($1::int[])", [[chuId, trangId]])).rowCount,
    "| kênh:", (await query("SELECT 1 FROM social_accounts WHERE id = $1", [kenh])).rowCount);
  process.exit(0);
}

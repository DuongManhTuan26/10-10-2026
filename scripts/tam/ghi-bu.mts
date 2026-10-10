import { query } from "../../server/db.js";
const da = (await query(`SELECT count(*)::int n FROM ai_usage WHERE loi LIKE 'Ghi bù:%'`)).rows[0].n;
if (da === 0) {
  await query(
    `INSERT INTO ai_usage (user_id, task, viec, model, ma_ncc, prompt_tokens, completion_tokens, cost_usd, cost_ncc, doi_chieu_at, loi, created_at)
     VALUES (5, 'sales', 'thu_ai', 'google/gemini-3.7-flash', NULL, 2, 16, 0.0000615, 0.0000615, now(),
             'Ghi bù: lượt AI trả rỗng thứ 3 bị mất vì ghi sổ kiểu bắn-rồi-quên, tiến trình thử thoát trước khi ghi (lỗi đã sửa 01/10/2026). Số tiền lấy đúng phần lệch đối chiếu tổng với nhà cung cấp; giờ gần đúng.',
             '2026-10-01T08:59:52Z')`
  );
}
console.log("ĐÃ GHI BÙ", (await query(`SELECT id, cost_usd::text FROM ai_usage WHERE loi LIKE 'Ghi bù:%'`)).rows);
process.exit(0);

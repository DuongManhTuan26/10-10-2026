import { query } from "../../server/db.js";
const TRANG_USER = 108;
if (process.argv[2] === "xoa") {
  const r = await query("DELETE FROM social_accounts WHERE id = 'thu-kenh-video'");
  console.log("đã xoá kênh giả:", r.rowCount);
} else {
  const t = await query<{ id: number }>("SELECT id FROM trang WHERE user_id = $1", [TRANG_USER]);
  await query(`INSERT INTO social_accounts (id, user_id, platform, username, display_name, connected, trang_id)
               VALUES ('thu-kenh-video', $1, 'facebook', 'kenh-thu', 'Kênh thử video', TRUE, $2) ON CONFLICT (id) DO NOTHING`, [TRANG_USER, t.rows[0].id]);
  console.log("đã gắn kênh giả vào trang thử", TRANG_USER);
}
process.exit(0);

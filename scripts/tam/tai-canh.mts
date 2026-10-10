import fs from "node:fs";
import path from "node:path";
import { query } from "../../server/db.js";
import { taiVe } from "../../server/services/video-cong-cu.js";
const id = Number(process.argv[2]), thu = process.argv[3];
fs.mkdirSync(thu, { recursive: true });
for (const c of (await query("SELECT thu_tu, url FROM video_ai WHERE du_an_id = $1 AND trang_thai = 'xong' ORDER BY thu_tu", [id])).rows)
  await taiVe(c.url, path.join(thu, `canh-${c.thu_tu}.mp4`));
process.exit(0);

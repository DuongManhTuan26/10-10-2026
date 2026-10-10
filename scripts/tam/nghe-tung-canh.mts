import fs from "node:fs";
import path from "node:path";
import { query } from "../../server/db.js";
import { chayFfmpeg } from "../../server/services/video-cong-cu.js";
import { ngheThanhChu } from "../../server/services/am-thanh-ai.js";
const thu = process.argv[2], id = Number(process.argv[3]);
const d = (await query("SELECT user_id, phan_canh FROM du_an_video WHERE id = $1", [id])).rows[0];
const ghep = path.join(thu, "ghep.mp4");
const doDai = [8, 7.958, 7.958, 7.958, 7.958, 7.958, 5.958, 5.958];
let moc = 0;
for (const [i, c] of d.phan_canh.entries()) {
  const tep = path.join(thu, `loi-${i}.wav`);
  await chayFfmpeg(["-ss", moc.toFixed(3), "-t", doDai[i].toFixed(3), "-i", ghep, "-vn", "-ac", "1", "-ar", "24000", tep]);
  const nghe = await ngheThanhChu({ userId: d.user_id, am: fs.readFileSync(tep), dinhDang: "wav" });
  console.log(`[${i + 1}] ${moc.toFixed(2)}–${(moc + doDai[i]).toFixed(2)}s\n   kịch bản: ${c.loiDoc}\n   nghe ra : ${nghe}`);
  moc += doDai[i];
}
process.exit(0);

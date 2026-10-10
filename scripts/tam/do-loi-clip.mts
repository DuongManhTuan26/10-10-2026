// Đo từng clip: cú cắt (điểm 1 khung), mờ chồng (tổng điểm trượt 12 khung), trôi sáng (đầu → cuối).
import fs from "node:fs";
import path from "node:path";
import { chayFfmpeg } from "../../server/services/video-cong-cu.js";
for (const tep of process.argv.slice(2)) {
  const d = tep + ".diem.txt", y = tep + ".sang.txt";
  await chayFfmpeg(["-i", tep, "-vf", `select='gte(scene,0)',metadata=print:file=${d}`, "-an", "-f", "null", "-"]);
  await chayFfmpeg(["-i", tep, "-vf", `signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${y}`, "-an", "-f", "null", "-"]);
  const s = [...fs.readFileSync(d, "utf8").matchAll(/scene_score=([\d.]+)/g)].map((m) => Number(m[1])).slice(1);
  const l = [...fs.readFileSync(y, "utf8").matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  let truotMax = 0, oDau = 0;
  for (let i = 0; i + 12 <= s.length; i++) { const t = s.slice(i, i + 12).reduce((a, b) => a + b, 0); if (t > truotMax) { truotMax = t; oDau = i; } }
  const tb = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
  console.log(`${path.basename(path.dirname(tep))}/${path.basename(tep)}: cắt ${Math.max(...s).toFixed(3)} | mờ chồng ${truotMax.toFixed(3)} @${(oDau / 24).toFixed(1)}s | sáng ${tb(l.slice(0, 24)).toFixed(0)}→${tb(l.slice(-24)).toFixed(0)} (${(tb(l.slice(-24)) - tb(l.slice(0, 24))).toFixed(0)})`);
}
process.exit(0);

// Độ sáng trung bình (Y) giây đầu và giây cuối mỗi cảnh: đêm → ngày giữa clip thì chênh lớn.
import path from "node:path";
import { chayFfmpeg } from "../../server/services/video-cong-cu.js";
const thu = process.argv[2];
const n = Number(process.argv[3]);
for (let i = 0; i < n; i++) {
  const t = path.join(thu, `canh-${i}.mp4`);
  const tep = path.join(thu, `sang-${i}.txt`);
  await chayFfmpeg(["-i", t, "-vf", `signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${tep}`, "-an", "-f", "null", "-"]);
  const log = (await import("node:fs")).readFileSync(tep, "utf8");
  const y = [...log.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const tb = (a: number[]) => a.reduce((x, z) => x + z, 0) / a.length;
  const dau = tb(y.slice(0, 24)), cuoi = tb(y.slice(-24));
  console.log(`cảnh ${i + 1}: sáng đầu ${dau.toFixed(1)} → cuối ${cuoi.toFixed(1)} (chênh ${(cuoi - dau >= 0 ? "+" : "") + (cuoi - dau).toFixed(1)}, ${y.length} khung)`);
}
process.exit(0);

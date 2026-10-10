import { spawnSync } from "node:child_process";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { query } from "../../server/db.js";
const D = process.argv[2];
const ff = ffmpegPath as unknown as string;
const ds = (await query<{ id: number; url: string; anh_tham_chieu: string[] }>("SELECT id, url, anh_tham_chieu FROM du_an_video WHERE trang_thai = 'xong' ORDER BY id")).rows;
for (const d of ds) {
  const f = `${D}/du-an-${d.id}.mp4`;
  fs.writeFileSync(f, new Uint8Array(await (await fetch(d.url)).arrayBuffer()));
  const log = spawnSync(ff, ["-hide_banner", "-i", f]).stderr.toString();
  const dai = /Duration: (\d+):(\d+):([\d.]+)/.exec(log)!; const s = Number(dai[3]) + Number(dai[2]) * 60;
  console.log(`dự án #${d.id}: ${s}s, ${/, (\d+x\d+)/.exec(log.split("Video:")[1] ?? "")?.[1]}`);
  for (const [ten, t] of [["dau", 0.1], ["giua", s / 2], ["cuoi", s - 0.2]] as const)
    spawnSync(ff, ["-y", "-ss", String(t), "-i", f, "-frames:v", "1", "-vf", "scale=-2:360", `${D}/du-an-${d.id}-${ten}.jpg`]);
  if (d.anh_tham_chieu?.[0]) {
    fs.writeFileSync(`${D}/tham-chieu-${d.id}.png`, new Uint8Array(await (await fetch(d.anh_tham_chieu[0])).arrayBuffer()));
    spawnSync(ff, ["-y", "-i", `${D}/tham-chieu-${d.id}.png`, "-vf", "scale=-2:360", `${D}/tham-chieu-${d.id}.jpg`]);
  }
}
// Ghép khung của dự án tham chiếu cạnh ảnh tham chiếu để so sánh
spawnSync(ff, ["-y", "-i", `${D}/tham-chieu-2.jpg`, "-i", `${D}/du-an-2-dau.jpg`, "-i", `${D}/du-an-2-giua.jpg`, "-i", `${D}/du-an-2-cuoi.jpg`, "-filter_complex", "hstack=inputs=4", `${D}/so-sanh-tham-chieu.jpg`]);
spawnSync(ff, ["-y", "-i", `${D}/du-an-1-dau.jpg`, "-i", `${D}/du-an-1-giua.jpg`, "-i", `${D}/du-an-1-cuoi.jpg`, "-filter_complex", "hstack=inputs=3", `${D}/kich-ban.jpg`]);
console.log("đã cắt khung");
process.exit(0);

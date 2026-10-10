import { spawnSync } from "node:child_process";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { queryOne } from "../../server/db.js";
const D = process.argv[2]; const ff = ffmpegPath as unknown as string;
const d = (await queryOne<{ id: number; url: string }>("SELECT id, url FROM du_an_video WHERE trang_thai='xong' ORDER BY id DESC LIMIT 1"))!;
const f = `${D}/noi.mp4`;
fs.writeFileSync(f, new Uint8Array(await (await fetch(d.url)).arrayBuffer()));
const log = spawnSync(ff, ["-hide_banner", "-i", f]).stderr.toString();
console.log(`dự án #${d.id}: ${/Duration: ([\d:.]+)/.exec(log)?.[1]}, ${/, (\d+x\d+)/.exec(log.split("Video:")[1] ?? "")?.[1]}`);
for (const [ten, t] of [["a-dau", "0.1"], ["b-truoc-noi", "7.85"], ["c-sau-noi", "8.1"], ["d-cuoi", "17.8"]])
  spawnSync(ff, ["-y", "-ss", t, "-i", f, "-frames:v", "1", "-vf", "scale=-2:400", `${D}/noi-${ten}.jpg`]);
spawnSync(ff, ["-y", "-i", `${D}/noi-a-dau.jpg`, "-i", `${D}/noi-b-truoc-noi.jpg`, "-i", `${D}/noi-c-sau-noi.jpg`, "-i", `${D}/noi-d-cuoi.jpg`, "-filter_complex", "hstack=inputs=4", `${D}/noi-canh.jpg`]);
process.exit(0);

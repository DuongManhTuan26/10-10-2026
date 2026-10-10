import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import * as zernio from "../../server/services/zernio.js";
import { ghepVideo, layKhungCuoi, docThongTinVideo } from "../../server/services/video-cong-cu.js";
const ff = ffmpegPath as unknown as string;
const tam = fs.mkdtempSync(path.join(os.tmpdir(), "thu-ghep-"));
const tao = (ten: string, kt: string, coTieng: boolean) => {
  const f = path.join(tam, ten);
  spawnSync(ff, ["-y", "-f", "lavfi", "-i", `testsrc=size=${kt}:rate=30:duration=2`,
    ...(coTieng ? ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest"] : []),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", ...(coTieng ? ["-c:a", "aac"] : []), f]);
  return f;
};
const len = async (f: string) => {
  const du = fs.readFileSync(f);
  const p = await zernio.presignMedia({ filename: path.basename(f), contentType: "video/mp4", size: du.length });
  const r = await fetch(p.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: new Uint8Array(du) });
  if (!r.ok) throw new Error("upload " + r.status);
  return p.publicUrl;
};
const a = await len(tao("a.mp4", "480x854", true));
const b = await len(tao("b.mp4", "640x640", false));
console.log("đã đưa 2 đoạn thử lên kho");
const cuoi = await layKhungCuoi(a, "thu-khung-cuoi.jpg");
const kc = await fetch(cuoi);
console.log(`khung cuối → ${kc.status} ${kc.headers.get("content-type")} ${(await kc.arrayBuffer()).byteLength} byte`);
for (const coTieng of [false, true]) {
  const u = await ghepVideo([a, b], coTieng, `thu-ghep-${coTieng}.mp4`);
  const f = path.join(tam, `ra-${coTieng}.mp4`);
  fs.writeFileSync(f, new Uint8Array(await (await fetch(u)).arrayBuffer()));
  const log = spawnSync(ff, ["-hide_banner", "-i", f]).stderr.toString();
  const tt = docThongTinVideo(log);
  console.log(`ghép (muốn tiếng=${coTieng}) → ${tt.rong}x${tt.cao}, ${tt.soGiay}s, có tiếng=${tt.coTieng}, h264=${/Video: h264/.test(log)}, faststart=${fs.readFileSync(f).subarray(0, 64).includes("moov") || fs.readFileSync(f).indexOf("moov") < fs.readFileSync(f).indexOf("mdat")}`);
}
fs.rmSync(tam, { recursive: true, force: true });
process.exit(0);

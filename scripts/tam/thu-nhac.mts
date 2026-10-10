import fs from "node:fs";
import { taoNhacNen } from "../../server/services/am-thanh-ai.js";
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const t0 = Date.now();
const { am, duoi } = await taoNhacNen({ userId: t.chuId, soGiay: 64, moTa: "Modern upbeat corporate tech pop, light electronic beat, warm synth pads, optimistic and confident, 110 BPM, builds gently toward a bright ending." });
const tep = `${process.argv[2]}/nhac.${duoi}`;
fs.writeFileSync(tep, am);
console.log(am.length, "byte", duoi, Date.now() - t0, "ms →", tep);
process.exit(0);

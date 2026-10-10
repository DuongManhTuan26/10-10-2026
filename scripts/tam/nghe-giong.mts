import fs from "node:fs";
import { ngheThanhChu } from "../../server/services/am-thanh-ai.js";
const t = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
for (const f of process.argv.slice(2)) console.log(f.split("/").pop(), "→", await ngheThanhChu({ userId: t.chuId, am: fs.readFileSync(f), dinhDang: f.endsWith(".wav") ? "wav" : "mp3" }));
process.exit(0);

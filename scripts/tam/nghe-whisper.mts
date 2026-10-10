import fs from "node:fs";
import { query } from "../../server/db.js";
import { ngheThanhChu } from "../../server/services/am-thanh-ai.js";
const u = (await query("SELECT user_id FROM du_an_video WHERE id = 9")).rows[0].user_id;
for (const f of process.argv.slice(2)) console.log(f.split("/").pop(), "→", await ngheThanhChu({ userId: u, am: fs.readFileSync(f), dinhDang: "wav", model: "openai/whisper-large-v3" }));
process.exit(0);

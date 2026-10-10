import fs from "node:fs";
import { boCauChiGio } from "../../server/services/video-dai.js";
const du = JSON.parse(fs.readFileSync("scripts/tam/du-an-qc.json", "utf8"));
const sau = boCauChiGio(du.nhat_quan);
console.log("TRƯỚC:", du.nhat_quan.length, "ký tự\nSAU:", sau.length, "ký tự\n" + sau);
process.exit(0);

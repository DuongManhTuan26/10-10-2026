import fs from "node:fs";
import * as zernio from "../../server/services/zernio.js";
const ds: string[] = JSON.parse(fs.readFileSync("scripts/tam/ho-so-can-don.json", "utf8"));
let ok = 0;
for (const r of ds) {
  try { await zernio.xoaHoSo(r); ok++; console.log(`  đã dọn hồ sơ ${r}`); }
  catch (e) { console.log(`  ⚠ ${r}: ${e instanceof Error ? e.message : e}`); }
}
console.log(`dọn được ${ok}/${ds.length}`);
process.exit(0);

import * as zernio from "../../server/services/zernio.js";
for (const k of ["6a7edc8c77555aae01aabf48", "6a80162977555aae01f607f2", "6abd02ec5b8d5d3292530246"]) {
  try { await zernio.disconnectAccount(k); console.log(`  đã ngắt kênh ${k}`); } catch (e) { console.log(`  ⚠ kênh ${k}: ${e instanceof Error ? e.message : e}`); }
}
for (const r of ["6a7edbe2af348aa7544ecdf9", "6abd02d1441855077ca7576e"]) {
  try { await zernio.xoaHoSo(r); console.log(`  đã dọn hồ sơ ${r}`); } catch (e) { console.log(`  ⚠ hồ sơ ${r}: ${e instanceof Error ? e.message : e}`); }
}
process.exit(0);

import fs from "node:fs";
const app = fs.readFileSync("server/app.ts", "utf8");
const gan = [...app.matchAll(/app\.use\("([^"]+)",\s*(\w+)\)/g)].map((m) => ({ tien: m[1], router: m[2] }));
const tepCua: Record<string, string> = {};
for (const t of fs.readdirSync("server/routes")) {
  const s = fs.readFileSync(`server/routes/${t}`, "utf8");
  for (const m of s.matchAll(/export const (\w+Router)\s*=/g)) tepCua[m[1]] = `server/routes/${t}`;
}
const ds: { method: string; path: string; tep: string }[] = [];
for (const { tien, router } of gan) {
  const tep = tepCua[router]; if (!tep) continue;
  const s = fs.readFileSync(tep, "utf8");
  for (const m of s.matchAll(new RegExp(`${router}\\.(get|post|put|patch|delete)\\(\\s*"([^"]+)"`, "g")))
    ds.push({ method: m[1].toUpperCase(), path: tien + (m[2] === "/" ? "" : m[2]), tep });
}
// Đường gắn thẳng lên app
for (const m of app.matchAll(/app\.(get|post)\("(\/[^"]+)"/g)) ds.push({ method: m[1].toUpperCase(), path: m[2], tep: "server/app.ts" });
fs.writeFileSync("scripts/tam/duong.json", JSON.stringify(ds, null, 1));
const theoTep: Record<string, number> = {};
for (const d of ds) theoTep[d.tep] = (theoTep[d.tep] ?? 0) + 1;
console.log("Tổng số đường:", ds.length); console.table(theoTep);

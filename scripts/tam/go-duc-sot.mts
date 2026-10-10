// Tìm phép đục đang dở (tệp thiếu đoạn "tim") và trả lại nguyên trạng.
import fs from "node:fs";
const nguon = fs.readFileSync("scripts/kiem-tra-nguoc.mts", "utf8");
const m = nguon.match(/const DUC: PhepDuc\[\] = \[([\s\S]*?)\n\];\n/);
const DUC = eval("[" + m![1] + "]") as { ten: string; tep: string; tim: string | RegExp; thay: string }[];
let sot = 0;
for (const d of DUC) {
  if (!fs.existsSync(d.tep)) continue;
  const s = fs.readFileSync(d.tep, "utf8");
  const con = typeof d.tim === "string" ? s.includes(d.tim) : d.tim.test(s);
  if (con) continue;
  sot++;
  console.log(`phép đục đang dở: "${d.ten}" ở ${d.tep}`);
  if (typeof d.tim === "string" && d.thay && s.split(d.thay).length === 2) {
    fs.writeFileSync(d.tep, s.replace(d.thay, d.tim));
    console.log("  → đã trả lại nguyên trạng");
  } else console.log("  → KHÔNG tự trả được, cần xem tay");
}
console.log(`tổng số phép đục đang dở: ${sot}`);

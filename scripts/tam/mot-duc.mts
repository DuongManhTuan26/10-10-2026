import fs from "node:fs"; import { execSync } from "node:child_process";
const DUC = [
  { tep: "server/routes/auth.ts", tim: 'const ve = await taoVeXacThuc({ user, mucDich: "dang_nhap" });\n      res.json({ success: true, canMa: true, ...ve });\n      return;', thay: "", ten: "đăng nhập bỏ bước mã" },
  { tep: "server/routes/auth.ts", tim: 'const ve = await taoVeXacThuc({ user: taiKhoan, mucDich: "dang_ky" });\n      res.status(201).json({ success: true, canMa: true, ...ve });\n      return;', thay: "", ten: "đăng ký bỏ bước mã" },
  { tep: "server/routes/auth.ts", tim: '      role: "admin_con",\n    });\n', thay: "    });\n", ten: "tự đăng ký ra thẳng một trang" },
];
for (const d of DUC) {
  const goc = fs.readFileSync(d.tep, "utf8");
  if (!goc.includes(d.tim)) { console.log("⚠ không đục được:", d.ten); continue; }
  fs.writeFileSync(d.tep, goc.replace(d.tim, d.thay));
  let xanh = true; try { execSync("npx tsx scripts/kiem-tra.mts", { stdio: "pipe" }); } catch { xanh = false; }
  fs.writeFileSync(d.tep, goc);
  console.log(xanh ? "✗ VẪN ĐẠT —" : "✓ bắt được —", d.ten);
}

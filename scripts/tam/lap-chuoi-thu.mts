// Lập chuỗi thử để đi các màn hình. GIỮ LẠI tới khi dọn bằng don-chuoi-thu.mts.
import crypto from "node:crypto";
import fs from "node:fs";
const GOC = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(GOC + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  return { ma: r.status, j: await r.json().catch(() => null) as any, c: r.headers.get("set-cookie")?.split(";")[0] ?? null };
};
const email = `thu-man-hinh-${crypto.randomBytes(3).toString("hex")}@example.test`;
const mk = crypto.randomBytes(12).toString("base64url");
const dk = await goi("", "POST", "/api/auth/register", { email, password: mk, name: "Chuỗi thử màn hình" });
const t = await goi(dk.c!, "POST", "/api/quan-ly/trang", { ten: "Trang thử màn hình" });
fs.writeFileSync("scripts/tam/chuoi-thu.json", JSON.stringify({ email, mk, chuId: dk.j.user.id, trangId: t.j.data.id }));
console.log("đăng ký →", dk.ma, "| lập trang →", t.ma, "| đã ghi thông tin đăng nhập vào tệp nháp");
process.exit(0);

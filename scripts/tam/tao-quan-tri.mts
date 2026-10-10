import crypto from "node:crypto";
import fs from "node:fs";
import { query } from "../../server/db.js";
import { hashPassword } from "../../server/auth.js";
const ten = "quantri@hethong.local";
const bang = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY34679";
const nhom = () => Array.from(crypto.randomBytes(4), (b) => bang[b % bang.length]).join("");
const mk = `${nhom()}-${nhom()}-${nhom()}`;
const daCo = await query("SELECT id FROM users WHERE lower(email) = $1", [ten]);
if (daCo.rowCount) { console.log("ĐÃ CÓ tài khoản này, không tạo lại"); process.exit(1); }
const r = await query<{ id: number }>(
  "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
  [ten, await hashPassword(mk), "Quản trị hệ thống"]);
fs.writeFileSync("/private/tmp/claude-501/-Users-mac/980857a1-af64-4180-80b9-71cccadaf19f/scratchpad/quan-tri.json", JSON.stringify({ ten, mk, id: r.rows[0].id }));
console.log("đã tạo quản trị, id =", r.rows[0].id);
process.exit(0);

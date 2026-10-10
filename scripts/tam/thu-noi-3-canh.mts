import crypto from "node:crypto";
import fs from "node:fs";
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const text = await r.text(); let j: any = null; try { j = JSON.parse(text); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
// Dùng lại tài khoản thử đã tạo (đỡ đăng ký thêm).
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
if (dn.ma >= 300) { console.log("đăng nhập hỏng", dn.ma, dn.j); process.exit(1); }
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const chung = { model: "minimax/hailuo-3-max", doNet: "480p", khung: "9:16", coTieng: false };
const yTuong = "Quảng cáo mật ong rừng: cô gái mặc sơ mi linen màu kem đi bộ trên hiên quán cà phê đầy nắng, tay cầm hũ mật ong thuỷ tinh; cô đi tới bàn gỗ, đặt hũ xuống; rồi mở nắp, dùng que gỗ múc mật cho chảy thành dòng vàng óng và mỉm cười.";
const d = await goi(c, "POST", "/api/ai/video/du-an", { ...chung, loai: "kich_ban", tongGiay: 15, yTuong });
console.log("chia cảnh →", d.ma, d.j?.data?.phan_canh?.map((x: any) => x.soGiay + "s").join(" + "), d.j?.error ?? "");
console.log("NHẤT QUÁN:", d.j.data.nhat_quan);
let du = d.j.data;
if (du.phan_canh.length !== 3) {
  // Chủ shop sửa phân cảnh thành 3 cảnh 5 giây (tính năng sửa phân cảnh có sẵn) — để thử 2 mối nối.
  const canh = [
    { soGiay: 5, tomTat: "Cô gái đi trên hiên quán, cầm hũ mật", moTa: "Medium tracking shot, camera moving backward at walking pace: the woman walks toward the camera along the sunlit cafe terrace holding the glass honey jar at chest height. She keeps walking steadily; at the end of the shot she is two steps from a wooden table on the right, still mid-stride." },
    { soGiay: 5, tomTat: "Cô đi tới bàn gỗ, đặt hũ mật xuống", moTa: "Continue the exact same tracking shot without any cut: the woman takes the last two steps to the wooden table, turns slightly right and sets the honey jar down on the table, then rests her right hand on the lid. Same framing, same camera speed slowing to a stop." },
    { soGiay: 5, tomTat: "Mở nắp, múc mật chảy thành dòng, mỉm cười", moTa: "Continue seamlessly from the same pose: she twists the lid off, picks up a wooden honey dipper, lifts it so golden honey drizzles in a thick ribbon back into the jar, and she smiles at the camera. Camera slowly pushes in." },
  ];
  du = (await goi(c, "PUT", `/api/ai/video/du-an/${du.id}`, { nhatQuan: du.nhat_quan, phanCanh: canh })).j.data;
  console.log("đã sửa thành", du.phan_canh.map((x: any) => x.soGiay + "s").join(" + "));
}
for (const [i, x] of du.phan_canh.entries()) console.log(`  cảnh ${i + 1} (${x.soGiay}s): ${x.moTa}`);
console.log("giá ước tính $", du.gia_uoc_tinh);
console.log("bắt đầu →", (await goi(c, "POST", `/api/ai/video/du-an/${du.id}/bat-dau`)).ma);
const t0 = Date.now(); let x: any;
while (Date.now() - t0 < 30 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000));
  x = ((await goi(c, "GET", "/api/ai/video/du-an")).j?.data ?? []).find((y: any) => y.id === du.id);
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${x?.trang_thai} ${x?.canh_xong}/${x?.phan_canh?.length}`);
  if (x?.trang_thai === "xong" || x?.trang_thai === "loi") break;
}
console.log(`KẾT QUẢ: dự án #${du.id} ${x?.trang_thai} | ước tính $${x?.gia_uoc_tinh} | thật $${x?.gia_thuc} | ${x?.url ?? ""} ${x?.loi ?? ""}`);
process.exit(0);

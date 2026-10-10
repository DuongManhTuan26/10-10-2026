import fs from "node:fs";
const G = "http://127.0.0.1:3000";
const goi = async (c: string, m: string, d: string, b?: unknown) => {
  const r = await fetch(G + d, { method: m, headers: { "Content-Type": "application/json", ...(c ? { Cookie: c } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { ma: r.status, j, c: r.headers.get("set-cookie")?.split(";")[0] ?? "" };
};
const cu = JSON.parse(fs.readFileSync("scripts/tam/chuoi-thu.json", "utf8"));
const dn = await goi("", "POST", "/api/auth/login", { email: cu.email, password: cu.mk });
const c = (await goi(dn.c, "POST", `/api/quan-ly/trang/${cu.trangId}/mo`)).c;
const yTuong = `Video quảng cáo khoảng 60 giây cho BrewManager AI — trợ lý AI bán hàng tự động dành cho chủ shop bán hàng trên Fanpage Facebook.
Nhân vật: chị Linh, khoảng 28 tuổi, chủ một shop quần áo online nhỏ ở Hà Nội.
Hook: 11 giờ đêm, chị Linh mệt mỏi giữa căn phòng đầy túi hàng, điện thoại rung liên tục vì tin nhắn khách.
Vấn đề: trả lời không xuể; khách hỏi giá không ai trả lời thì bỏ đi; bài đăng bán hàng cũng chưa kịp viết.
Giải pháp: chị bật BrewManager AI — AI tự trả lời tin nhắn và bình luận của khách suốt ngày đêm, tư vấn, hỏi đủ thông tin và chốt đơn, rồi báo đơn mới về điện thoại.
Lợi ích: AI còn tự viết bài, tạo ảnh, tạo video và đăng theo lịch; sáng hôm sau chị Linh thảnh thơi uống cà phê, xem những đơn đã chốt trong đêm.
Kêu gọi: nhắn tin cho BrewManager AI ngay để được tư vấn và cài đặt.
Màn hình điện thoại trong video chỉ hiện bong bóng tin nhắn phát sáng, không có chữ đọc được.`;
const d = await goi(c, "POST", "/api/ai/video/du-an", {
  loai: "kich_ban", yTuong, tongGiay: 64, model: "google/veo-3.1-lite", doNet: "720p", khung: "9:16", coTieng: true,
  amThanh: { giongDoc: true, nhac: true, phuDe: true },
});
if (d.ma !== 201) { console.log("LỖI", d.ma, d.j); process.exit(1); }
const du = d.j.data;
fs.writeFileSync("scripts/tam/du-an-qc.json", JSON.stringify(du, null, 1));
console.log(`dự án #${du.id}: ${du.phan_canh.length} cảnh, ${du.phan_canh.reduce((t: number, x: any) => t + x.soGiay, 0)}s, ước tính $${du.gia_uoc_tinh}`);
console.log("ÂM THANH:", JSON.stringify(du.am_thanh));
console.log("NHẤT QUÁN:", du.nhat_quan);
for (const [i, x] of du.phan_canh.entries()) console.log(`\n[${i + 1}] ${x.soGiay}s ${i === 0 ? "MỞ" : x.noiTiep ? "NỐI" : "CẮT"} | lời (${x.loiDoc.length} ký tự): ${x.loiDoc}\n    hình: ${x.moTa}`);
process.exit(0);

import { doGiong, giongDocSai } from "../../server/services/video-dai.js";
const c8 = "Nhắn tin cho BrewManager AI ngay để được tư vấn và cài đặt.";
const ca: [string, string, string, boolean][] = [
  ["c8 SAI (AI now, ghi mắc)", c8, "Nhắn tin cho Brew Manager AI Now để được ghi mắc thông tin về cài đặt.", true],
  ["c8 SAI (Gimax)", c8, "Nhắn tin cho Brew Manager AI now để được Gimax thông tin về cài đặt.", true],
  ["c8 đúng (Whisper, Broom)", c8, "Nhắn tin cho Broom Manager AI ngay để được tư vấn và cài đặt", false],
  ["c8 đúng (giọng tách riêng)", c8, "Nhắn tin cho Brew Manager AI ngay để được tư vấn và cài đặt.", false],
  ["c7 đọc cả lời dặn", "Sáng hôm sau, chị thảnh thơi nhấp cà phê, xem những đơn đã chốt trong đêm.", "Read in Vietnamese as a warm, clear, confident narrator of a social media advert. Natural, brisk pace, no dramatic pauses. Read noticeably faster. Sáng hôm sau", true],
  ["c4 đúng (Chỉ/Bloom)", "Chị bật BrewManager AI, để AI tự trả lời tin nhắn và bình luận suốt ngày đêm.", "Chỉ bật Bloom Manager AI để AI tự trả lời tin nhắn và bình luận suốt ngày đêm.", false],
  ["c1 đúng (11:00)", "11 giờ đêm, chị Linh vẫn ngồi giữa đống hàng, điện thoại rung không ngừng.", "11:00 đêm, chị Linh vẫn ngồi giữa đống hàng, điện thoại rung không ngừng.", false],
  ["c3 đúng (máy nghe lệch giá/giả)", "Khách hỏi giá, chờ lâu quá rồi lặng lẽ bỏ đi, bài bán hàng vẫn chưa kịp viết.", "Khách gọi giả, chờ lâu quá rồi lặng lẽ bỏ đi, bài bán hàng vẫn chưa kịp viết.", false],
];
let dung = 0;
for (const [ten, loi, nghe, sai] of ca) {
  const kq = giongDocSai(loi, nghe);
  const ok = (kq !== null) === sai; if (ok) dung++;
  console.log(`${ok ? "✓" : "✗"} ${ten.padEnd(32)} giống ${(doGiong(loi.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""), nghe.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) * 100).toFixed(0)}% → ${kq ?? "đúng"}`);
}
console.log(`ĐÚNG ${dung}/${ca.length}`);
process.exit(0);

/**
 * Trend → video: AI xem một video đang thịnh hành và rút ra CÔNG THỨC của nó
 * (cách mở đầu, bố cục cảnh, nhịp, kiểu quay, không khí). Công thức đó đưa vào
 * bước chia cảnh của video dài để làm video MỚI cho sản phẩm của shop — không
 * sao chép hình ảnh hay người trong video gốc.
 *
 * Model: Qwen 3.8 Omni Flash. Đã thử thật: xem đúng video trong kho của mình,
 * tả đúng số cảnh, nội dung, chuyển động máy quay; nghe được cả âm thanh; mỗi
 * lượt khoảng 0,0013 USD. Gemini và Mimo cùng lượt thử trả câu cụt, không dùng.
 */

import { AppError } from "../http.js";
import { chatJson, asRecord, optionalString, stringArray } from "./ai.js";
import { diaChiKhoHopLe, videoDangBat } from "./video-ai.js";
import { doDaiVideo, TOI_DA_GIAY_NGUON } from "./video-sua.js";

export const MODEL_XEM_VIDEO = "qwen/qwen3.8-omni-flash";

export async function phanTichTrend(p: {
  userId: number;
  trangId: number;
  videoNguon: string;
}): Promise<{ congThuc: string; tomTat: string[] }> {
  if (!(await videoDangBat(p.trangId))) {
    throw new AppError("Tạo video AI đang tắt. Bật trong phần soạn bài trước khi tạo.", 409);
  }
  // Chỉ nhận video trong kho của mình — không đưa địa chỉ lạ cho bên AI tải.
  const nguon = diaChiKhoHopLe(p.videoNguon, "Video trend");
  const soGiay = await doDaiVideo(nguon);
  if (soGiay > TOI_DA_GIAY_NGUON * 3) {
    throw new AppError("Video trend quá dài. Dùng video ngắn dạng Reels/TikTok (dưới 3 phút).", 400);
  }

  const kq = await chatJson({
    task: "extract",
    viec: "phan_tich_trend",
    model: MODEL_XEM_VIDEO,
    userId: p.userId,
    temperature: 0.2,
    maxTokens: 1_500,
    validate: (v) => asRecord(v),
    messages: [
      {
        role: "system",
        content: [
          "You analyze a trending short video so a shop can make a NEW video following the same formula.",
          'Return JSON: {"congThuc": string, "tomTat": string[]}.',
          "- congThuc (English, max 180 words): the reusable FORMULA — hook in the first seconds, shot-by-shot",
          "  structure with approximate timings, shot types and camera movement, pacing and transitions,",
          "  mood, lighting, music/sound style. Describe the formula only; do not describe the specific",
          "  people, faces, brands or logos in the video.",
          "- tomTat: 3–6 short Vietnamese bullet points explaining to the shop owner why this video works.",
          "No markdown.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this trending video." },
          { type: "video_url", video_url: { url: nguon } },
        ],
      },
    ],
  });
  const congThuc = optionalString(kq.output.congThuc)?.slice(0, 3_000);
  if (!congThuc) throw new AppError("AI chưa phân tích được video này, thử lại hoặc dùng video khác.", 502);
  return { congThuc, tomTat: stringArray(kq.output.tomTat).slice(0, 6) };
}

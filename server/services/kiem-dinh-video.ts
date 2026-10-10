/**
 * Kiểm định từng cảnh video NGAY khi vẽ xong, trước khi sang cảnh sau.
 *
 * Vì sao: mô hình video ngẫu nhiên, không lần nào bảo đảm sạch. Đã thấy
 * 02/10/2026 (dự án #8, Veo 3.1 Lite): 6/8 cảnh tự trôi từ đêm sang ngày hoặc
 * mờ chồng sang cảnh khác. Phát hiện lúc ghép xong là đã trả tiền cả video;
 * phát hiện ngay từng cảnh thì chỉ phải vẽ lại đúng cảnh đó.
 *
 * Hai lớp, rẻ trước đắt sau:
 *   1. Đo bằng máy (miễn phí): cú cắt giữa clip, độ sáng đầu → cuối clip.
 *   2. Chỉ khi độ sáng trôi mạnh: nhờ AI nhìn 4 khung hình so với mô tả cảnh.
 *      Sáng lên có khi là ĐÚNG kịch bản (máy lia vào màn hình laptop đang sáng —
 *      đã gặp ở dự án #9, +60/255 mà không phải lỗi), nên không tự kết luận.
 *
 * Ngưỡng chọn từ 18 clip thật đã soi bằng mắt: mọi clip lỗi trôi sáng ≥ +19,
 * mọi clip sạch ≤ +12 (trừ clip lia vào màn hình sáng — để AI phân xử).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { asRecord, chatJson, optionalString } from "./ai.js";
import { chayFfmpeg, taiVe, voiThuMucTam } from "./video-cong-cu.js";

/** Mô hình nhìn khung hình để phân xử cảnh nghi ngờ. */
/** Đã thử Claude Sonnet 5: tệ hơn (15/18) — dễ dãi, lấy mô tả cảnh để bào chữa. */
export const MODEL_XEM_CLIP = "google/gemini-3.7-flash";

/** Điểm khác biệt 1 khung lớn hơn mức này = cú cắt cứng (clip sạch ≤ 0,06; clip có cắt 0,44–0,57). */
export const NGUONG_CAT = 0.15;
/** Độ sáng trung bình (0–255) giây cuối lệch giây đầu quá mức này thì phải xem lại. */
export const NGUONG_TROI_SANG = 15;

export interface SoDoClip {
  catMax: number;
  sangDau: number;
  sangCuoi: number;
}

export interface KetQuaKiemDinh {
  dat: boolean;
  lyDo: string | null;
  soDo: SoDoClip;
  /** Có nhờ AI nhìn không (tốn tiền) hay chỉ đo bằng máy. */
  coHoiAi: boolean;
  /** Tiền lượt AI nhìn (0 nếu chỉ đo bằng máy). */
  tien: number;
}

function trungBinh(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

/** Đo một tệp clip bằng ffmpeg. */
export async function doClip(tep: string, thuMuc: string): Promise<SoDoClip> {
  const tepDiem = path.join(thuMuc, "diem.txt");
  const tepSang = path.join(thuMuc, "sang.txt");
  await chayFfmpeg(["-i", tep, "-vf", `select='gte(scene,0)',metadata=print:file=${tepDiem}`, "-an", "-f", "null", "-"], 180_000);
  await chayFfmpeg(
    ["-i", tep, "-vf", `signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${tepSang}`, "-an", "-f", "null", "-"],
    180_000
  );
  // Khung đầu luôn có điểm cao (so với "không có gì") — bỏ.
  const diem = [...(await fs.readFile(tepDiem, "utf8")).matchAll(/scene_score=([\d.]+)/g)].map((m) => Number(m[1])).slice(1);
  const sang = [...(await fs.readFile(tepSang, "utf8")).matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  return {
    catMax: diem.length ? Math.max(...diem) : 0,
    sangDau: trungBinh(sang.slice(0, 24)),
    sangCuoi: trungBinh(sang.slice(-24)),
  };
}

/** Lớp 1: kết luận được ngay bằng số đo, hay phải nhờ AI nhìn. */
export function phanLoaiSoDo(s: SoDoClip): { ketLuan: "dat" | "loi" | "can_xem"; lyDo: string | null } {
  if (s.catMax > NGUONG_CAT) return { ketLuan: "loi", lyDo: "mô hình tự cắt sang cảnh khác giữa clip" };
  if (Math.abs(s.sangCuoi - s.sangDau) > NGUONG_TROI_SANG) {
    return { ketLuan: "can_xem", lyDo: `độ sáng đổi ${Math.round(s.sangCuoi - s.sangDau)}/255 từ đầu tới cuối clip` };
  }
  return { ketLuan: "dat", lyDo: null };
}

/*
 * Cách hỏi này được chọn sau 5 cách thử trên 18 clip đã soi bằng mắt (02/10/2026):
 *   - hỏi chung "có lỗi không": 17 rồi 16/18, lượt đúng lượt sai;
 *   - bắt AI chứng minh cái gì làm hình sáng lên, kèm số đo độ sáng (CÁCH NÀY): 17/18 cả hai lượt;
 *   - thêm câu "cùng một người?": 16/18; đổi sang Claude Sonnet 5: 15/18;
 *   - chỉ 2 khung, không mô tả, code tự kết luận: 14/18.
 * Clip còn sót: #8-5 — trôi sáng nhẹ (+19) kèm mặt đổi dần thành người khác.
 */
export const DE_BAI_XEM_CLIP = [
  "You are a strict video QA reviewer. You see 4 frames sampled in order from ONE AI-generated clip (start → end),",
  "the director's description of that clip, and the measured brightness change between its first and last second.",
  "A brightness change is a DEFECT unless the description itself causes it (the camera moves onto a bright screen",
  "or light source, a lamp is switched on, a phone screen lights up). Night turning into daylight, sunlight appearing,",
  "or the whole room getting brighter without such a cause is a DEFECT. Also a DEFECT: a cut, dissolve or cross-fade",
  "to a different shot, place or moment; the person changing face, hairstyle or outfit; objects appearing or vanishing.",
  "First name what makes the last frame brighter than the first, then decide.",
  'Return JSON: {"nguyenNhan": string, "doMoTaGayRa": boolean, "coLoi": boolean, "lyDo": string}',
  "— nguyenNhan in English; lyDo in Vietnamese, one short sentence.",
].join("\n");

/** Mốc lấy khung cho AI phân xử ánh sáng — đúng cấu hình đã đo 17/18 (4 khung, 540px). */
const MOC_XEM_SANG = [0.05, 0.35, 0.65, 0.95];

async function layKhung(tep: string, thuMuc: string, soGiay: number, moc: number[], rong: number): Promise<string[]> {
  const ra: string[] = [];
  for (const [k, ti] of moc.entries()) {
    const anh = path.join(thuMuc, `xem-${rong}-${k}.jpg`);
    await chayFfmpeg(["-ss", (soGiay * ti).toFixed(2), "-i", tep, "-frames:v", "1", "-vf", `scale=${rong}:-2`, "-q:v", "3", "-update", "1", anh], 60_000);
    ra.push(`data:image/jpeg;base64,${(await fs.readFile(anh)).toString("base64")}`);
  }
  return ra;
}

export async function kiemDinhCanh(p: { userId: number; url: string; moTa: string; soGiay: number }): Promise<KetQuaKiemDinh> {
  return voiThuMucTam(async (thuMuc) => {
    const tep = path.join(thuMuc, "canh.mp4");
    await taiVe(p.url, tep);
    const soDo = await doClip(tep, thuMuc);
    const lop1 = phanLoaiSoDo(soDo);
    if (lop1.ketLuan !== "can_xem") return { dat: lop1.ketLuan === "dat", lyDo: lop1.lyDo, soDo, coHoiAi: false, tien: 0 };

    const khung = await layKhung(tep, thuMuc, p.soGiay, MOC_XEM_SANG, 540);
    const kq = await chatJson({
      task: "extract",
      model: MODEL_XEM_CLIP,
      viec: "kiem_dinh_video",
      userId: p.userId,
      maxTokens: 1_500,
      validate: (v) => {
        const o = asRecord(v);
        return { coLoi: o.coLoi === true, lyDo: optionalString(o.lyDo) ?? null };
      },
      messages: [
        { role: "system", content: DE_BAI_XEM_CLIP },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Description of this clip:\n${p.moTa.slice(0, 1_500)}\n\n` +
                `Measured: average brightness goes from ${Math.round(soDo.sangDau)} to ${Math.round(soDo.sangCuoi)} (0–255) ` +
                "between the first and the last second. Explain that change: is it asked for by the description, or a defect?",
            },
            ...khung.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ],
    });
    return {
      dat: !kq.output.coLoi,
      lyDo: kq.output.coLoi ? kq.output.lyDo ?? lop1.lyDo : null,
      soDo,
      coHoiAi: true,
      tien: kq.usage.costUsd,
    };
  });
}

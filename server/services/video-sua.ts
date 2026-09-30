/**
 * Video → video: sửa, biến đổi video chủ shop đã có (đổi bối cảnh, thêm bớt đồ
 * vật, đổi phong cách, làm nét).
 *
 * Model sửa video tính tiền theo giây ĐẦU RA (bằng độ dài video nguồn), nên
 * phải đo độ dài video nguồn trước để báo giá đúng.
 */

import { queryOne } from "../db.js";
import { env } from "../env.js";
import { AppError } from "../http.js";
import { asRecord, optionalString } from "./ai.js";
import { thongTin, taiVe, voiThuMucTam } from "./video-cong-cu.js";
import { COT_VIEC, diaChiKhoHopLe, goiTaoViec, LUAT_VIDEO, videoDangBat, type ViecVideo } from "./video-ai.js";
import path from "node:path";

export interface ModelSuaVideo {
  id: string;
  ten: string;
  moTa: string;
  /** USD mỗi giây đầu ra. */
  giaMoiGiay: number;
  /** USD tối thiểu mỗi lượt. */
  toiThieu: number;
}

let boNho: { luc: number; ds: ModelSuaVideo[] } | null = null;

/** Model sửa video: nhận video đầu vào, tính giá theo giây đầu ra. Lấy sống từ OpenRouter. */
export async function layModelSuaVideo(): Promise<ModelSuaVideo[]> {
  if (boNho && Date.now() - boNho.luc < 60 * 60_000) return boNho.ds;
  if (!env.openrouter.apiKey) throw new AppError("Chưa cấu hình khoá AI nên chưa sửa được video.", 503);
  const r = await fetch("https://openrouter.ai/api/v1/videos/models", {
    headers: { Authorization: `Bearer ${env.openrouter.apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    if (boNho) return boNho.ds;
    throw new AppError(`Chưa lấy được danh sách model sửa video: HTTP ${r.status}`, 502);
  }
  const j = (await r.json()) as { data?: unknown[] } | unknown[];
  const tho = Array.isArray(j) ? j : (j.data ?? []);
  const ds: ModelSuaVideo[] = [];
  for (const m of tho.map(asRecord)) {
    const gia = asRecord(m.pricing_skus);
    const cent = Number(gia.cents_per_second_output);
    const id = optionalString(m.id);
    if (!id || !Number.isFinite(cent) || cent <= 0) continue;
    /*
     * Tính giá theo giây đầu ra KHÔNG có nghĩa là model sửa được video: đã đo,
     * danh sách lọc theo giá lẫn cả Runway Gen-4.5 và FLUX 3 Video — hai model
     * TẠO video. Chọn nhầm là mất tiền mà không ra video sửa. Chỉ giữ model mà
     * chính mô tả của nhà cung cấp nói là sửa/nâng cấp video.
     */
    if (!laModelSuaVideo(id, optionalString(m.description) ?? "")) continue;
    ds.push({
      id,
      ten: optionalString(m.name) ?? id,
      moTa: (optionalString(m.description) ?? "").slice(0, 240),
      giaMoiGiay: cent / 100,
      toiThieu: (Number(gia.minimum_cents_per_generation) || 0) / 100,
    });
  }
  ds.sort((a, b) => a.giaMoiGiay - b.giaMoiGiay);
  boNho = { luc: Date.now(), ds };
  return ds;
}

/** Model nhận video đầu vào để SỬA (không phải model tạo video mới). */
export function laModelSuaVideo(id: string, moTa: string): boolean {
  return /video[- ]?edit|editing|aleph|upscal/i.test(`${id} ${moTa}`);
}

export function giaSuaVideo(m: ModelSuaVideo, soGiay: number): number {
  return Math.round(Math.max(m.toiThieu, m.giaMoiGiay * soGiay) * 1_000_000) / 1_000_000;
}

/** Độ dài video nguồn (giây), đo thật bằng ffmpeg. */
export async function doDaiVideo(url: string): Promise<number> {
  return voiThuMucTam(async (thuMuc) => {
    const tep = path.join(thuMuc, "nguon");
    await taiVe(url, tep);
    const tt = await thongTin(tep);
    if (!tt.soGiay || !tt.rong) throw new AppError("Không đọc được video nguồn. Dùng tệp MP4 hoặc MOV.", 400);
    return tt.soGiay;
  });
}

/** Video nguồn dài hơn mức này thì từ chối trước khi tốn tiền. */
export const TOI_DA_GIAY_NGUON = 60;

export async function suaVideo(p: {
  userId: number;
  trangId: number;
  model: string;
  videoNguon: string;
  yeuCau: string;
}): Promise<ViecVideo> {
  if (!(await videoDangBat(p.trangId))) {
    throw new AppError("Tạo video AI đang tắt. Bật trong phần soạn bài trước khi tạo.", 409);
  }
  const yeuCau = p.yeuCau.trim().slice(0, 2_000);
  if (!yeuCau) throw new AppError("Cần mô tả muốn sửa video thế nào.", 400);
  const model = (await layModelSuaVideo()).find((m) => m.id === p.model);
  if (!model) throw new AppError("Model sửa video này không có hoặc đã ngừng.", 400);
  // Chỉ nhận video trong kho của mình — không chuyển tiếp địa chỉ lạ cho bên AI.
  const nguon = diaChiKhoHopLe(p.videoNguon, "Video nguồn");
  const soGiay = await doDaiVideo(nguon);
  if (soGiay > TOI_DA_GIAY_NGUON) {
    throw new AppError(`Video nguồn dài ${Math.round(soGiay)} giây, tối đa ${TOI_DA_GIAY_NGUON} giây. Cắt ngắn rồi thử lại.`, 400);
  }

  const maViec = await goiTaoViec({
    model: model.id,
    prompt: `${yeuCau}\n\n${LUAT_VIDEO}`,
    input_references: [{ type: "video_url", video_url: { url: nguon } }],
  });
  const row = await queryOne<ViecVideo>(
    `INSERT INTO video_ai
       (user_id, trang_id, model, loi_mo_ta, so_giay, do_net, khung, co_tieng, video_nguon, ma_viec, gia_uoc_tinh)
     VALUES ($1,$2,$3,$4,$5,'goc','goc',FALSE,$6,$7,$8)
     RETURNING ${COT_VIEC}`,
    [p.userId, p.trangId, model.id, yeuCau, Math.max(1, Math.round(soGiay)), nguon, maViec, giaSuaVideo(model, soGiay)]
  );
  return row!;
}

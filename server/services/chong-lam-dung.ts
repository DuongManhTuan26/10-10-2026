import type { NextFunction, Request, Response } from "express";
import { AppError } from "../http.js";

/**
 * Chốt chống đốt tiền AI.
 *
 * Đã tái hiện: một tài khoản gọi lặp /api/ai/test 40 lần liên tiếp, cả 40 lần
 * đều được chuyển thẳng sang nhà cung cấp AI — mỗi lần là một lần trừ tiền của
 * hệ thống. Kẻ xấu chỉ cần đăng ký một tài khoản rồi chạy vòng lặp.
 *
 * Mức đặt để NGƯỜI bấm tay không bao giờ chạm tới, chỉ chặn máy chạy lặp. Đây
 * không phải hạn mức gói cước: nó không giới hạn một chủ shop dùng AI nhiều
 * hay ít trong tháng, chỉ giới hạn tốc độ.
 *
 * Chỉ gắn vào các đường do người dùng bấm. AI tự trả lời khách chạy trong
 * worker, không đi qua đây, nên bán hàng không bao giờ bị chốt này chặn.
 *
 * Đếm trong bộ nhớ vì ứng dụng chạy một tiến trình. Đếm TRƯỚC khi gọi AI, nên
 * bắn song song cùng lúc cũng không lọt: lượt thứ 21 trong phút bị chặn ngay
 * dù 20 lượt trước chưa xong.
 */

interface Muc {
  khoa: (req: Request) => string | null;
  moiPhut: number;
  moiGio: number;
}

const MUC: Muc[] = [
  { khoa: (req) => (req.user ? `tk:${req.user.id}` : null), moiPhut: 20, moiGio: 200 },
  { khoa: (req) => (req.ip ? `ip:${req.ip}` : null), moiPhut: 60, moiGio: 600 },
];

const PHUT = 60_000;
const GIO = 60 * PHUT;

/** Mốc thời gian các lượt trong một giờ qua, theo từng khoá. */
const nhatKy = new Map<string, number[]>();

function donCu(khoa: string, bayGio: number): number[] {
  const con = (nhatKy.get(khoa) ?? []).filter((t) => bayGio - t < GIO);
  if (con.length) nhatKy.set(khoa, con);
  else nhatKy.delete(khoa);
  return con;
}

// Dọn khoá không còn hoạt động để bộ nhớ không phình theo số IP từng ghé.
setInterval(() => {
  const bayGio = Date.now();
  for (const khoa of nhatKy.keys()) donCu(khoa, bayGio);
}, 10 * PHUT).unref();

/**
 * Xin một suất cho mọi khoá cùng lúc. Còn suất ở TẤT CẢ các khoá thì ghi
 * luôn một lượt và trả choGiay = 0; hết suất ở khoá nào thì không ghi gì và
 * trả số giây phải chờ.
 *
 * Chỉ ghi khi đã qua mọi mức — lượt bị chặn không làm kéo dài thời gian chờ.
 */
export function xinSuat(
  cacMuc: { khoa: string; moiPhut?: number; moiGio: number }[]
): { choGiay: number } {
  const bayGio = Date.now();
  for (const m of cacMuc) {
    const cacLuot = donCu(m.khoa, bayGio);
    const trongPhut = cacLuot.filter((t) => bayGio - t < PHUT);
    const vuotPhut = m.moiPhut !== undefined && trongPhut.length >= m.moiPhut;
    const vuotGio = cacLuot.length >= m.moiGio;
    if (vuotPhut || vuotGio) {
      const moNhat = vuotPhut ? trongPhut[0] + PHUT : cacLuot[0] + GIO;
      return { choGiay: Math.max(1, Math.ceil((moNhat - bayGio) / 1_000)) };
    }
  }
  for (const m of cacMuc) {
    const cacLuot = nhatKy.get(m.khoa) ?? [];
    cacLuot.push(bayGio);
    nhatKy.set(m.khoa, cacLuot);
  }
  return { choGiay: 0 };
}

export function chanLamDungAI(req: Request, res: Response, next: NextFunction): void {
  const cacMuc = MUC.flatMap((m) => {
    const khoa = m.khoa(req);
    return khoa ? [{ khoa, moiPhut: m.moiPhut, moiGio: m.moiGio }] : [];
  });
  const { choGiay } = xinSuat(cacMuc);
  if (choGiay > 0) {
    res.setHeader("Retry-After", String(choGiay));
    next(new AppError(`Thao tác AI quá nhanh. Vui lòng thử lại sau ${choGiay} giây.`, 429));
    return;
  }
  next();
}

/**
 * Trần đọc ảnh khách gửi qua Messenger.
 *
 * Đã tái hiện: mỗi ảnh khách gửi là một lần gọi AI đọc ảnh, chạy TRƯỚC mọi
 * chốt khác — 10 ảnh gửi vào một hội thoại đã tắt AI vẫn gọi AI 10 lần. Kẻ
 * xấu không cần tài khoản, chỉ cần nhắn ảnh dồn dập vào Fanpage.
 *
 * Khách thật gửi vài ảnh sản phẩm, vài ảnh chuyển khoản — cách rất xa mức
 * này. Ảnh vượt trần vẫn được lưu và AI vẫn biết khách có gửi ảnh, chỉ không
 * tốn tiền đọc nội dung.
 */
export const ANH_MOI_HOI_THOAI_MOI_GIO = 10;
export const ANH_MOI_KENH_MOI_GIO = 300;

export function xinSuatDocAnh(hoiThoaiId: string, kenhId: string): boolean {
  return (
    xinSuat([
      { khoa: `anh-ht:${hoiThoaiId}`, moiGio: ANH_MOI_HOI_THOAI_MOI_GIO },
      { khoa: `anh-kenh:${kenhId}`, moiGio: ANH_MOI_KENH_MOI_GIO },
    ]).choGiay === 0
  );
}

/**
 * Trần lượt AI bán hàng tự trả lời khách qua Messenger.
 *
 * Đã tái hiện: ở chế độ tự chủ, 40 tin chữ vào một hội thoại gọi AI đủ 40 lần.
 * Xem lý do và cách xử lý khi vượt trần ở handleIncomingMessage.
 */
export const AI_TRA_LOI_MOI_HOI_THOAI_MOI_GIO = 30;
export const AI_TRA_LOI_MOI_KENH_MOI_GIO = 1_000;

export function xinSuatTraLoiAI(hoiThoaiId: string, kenhId: string): boolean {
  return (
    xinSuat([
      { khoa: `ai-ht:${hoiThoaiId}`, moiGio: AI_TRA_LOI_MOI_HOI_THOAI_MOI_GIO },
      { khoa: `ai-kenh:${kenhId}`, moiGio: AI_TRA_LOI_MOI_KENH_MOI_GIO },
    ]).choGiay === 0
  );
}

/** Chỉ dùng cho bộ kiểm tra: xoá sạch bộ đếm giữa các lần thử. */
export function _xoaBoDemChoKiemTra(): void {
  nhatKy.clear();
}

/** Chỉ dùng cho bộ kiểm tra: số lượt đang được ghi của một khoá. */
export function _soLuotDaGhi(khoa: string): number {
  return nhatKy.get(khoa)?.length ?? 0;
}

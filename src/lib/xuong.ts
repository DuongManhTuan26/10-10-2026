import { createContext, useContext, useEffect } from 'react';
import type { LuaChonVideo } from './api';

/**
 * Ô soạn chung của Xưởng AI (src/components/XuongAi.tsx) — phần video đọc ở đây để KHÔNG vẽ ô mô tả,
 * ô ảnh riêng (chủ dự án 03/10/2026: ảnh và video dùng chung một ô soạn như Pippit / Dreamina).
 *
 * Nút TẠO nằm ngay trong ô soạn (như Pippit): mỗi kỹ năng video báo "việc chính" của nó lên đây
 * (useDangKyHanhDong), nút ở ô soạn chạy đúng việc đó.
 *
 * Video "theo bài" (chủ dự án 04/10/2026): bấm Đăng bài là tự tạo video ngắn từ nội dung bài rồi đăng cùng —
 * phần video báo thông số đang chọn lên đây (datVideoTheoBai) để nút Đăng bài biết giá và gửi đúng thông số.
 */

/** Việc chính của kỹ năng đang mở: nhãn nút (kèm giá), khoá hay không, đang chạy hay không. */
export interface HanhDongTao {
  nhan: string;
  khoa: boolean;
  dangChay: boolean;
}

/** Thông số video ngắn sẽ tự tạo khi đăng bài (video "theo bài"). */
export interface VideoTheoBai {
  model: string;
  ten: string;
  gia: number | null;
  lc: LuaChonVideo;
  mucDich: string;
  huong: Record<string, boolean>;
}

export interface XuongChung {
  /** Ô prompt chung (chỉ mở cho bên tạo riêng). */
  moTa: string;
  setMoTa: (v: string) => void;
  /** Phần VIDEO đi theo bài (công tắc "Video tạo riêng" đang tắt): ô prompt đóng, chỉ chọn thông số. */
  theoBai: boolean;
  /** Ảnh tham chiếu đang chọn, theo thứ tự chọn (tối đa 4). */
  anhChon: string[];
  /** Đề bài thật gửi AI cho video: nội dung bài khi theo bài, prompt bạn viết khi tạo riêng. */
  deBai: string;
  /** Kỹ năng báo việc chính; null = thôi (chỉ xoá khi đúng chủ đã báo — kỹ năng con không bị cha ghi đè). */
  datHanhDong: (chu: string, h: HanhDongTao | null, chay?: () => void) => void;
  datVideoTheoBai: (v: VideoTheoBai | null) => void;
}

export const XuongContext = createContext<XuongChung | null>(null);
/** Có giá trị = đang nằm trong ô soạn chung. */
export const useXuong = () => useContext(XuongContext);

/**
 * Báo việc chính của một kỹ năng lên nút tạo của ô soạn. Gọi mỗi lần vẽ (giá, khoá đổi theo lựa chọn);
 * truyền null khi kỹ năng không phải đang mở. Gỡ khỏi màn hình thì tự thôi.
 */
export function useDangKyHanhDong(chu: string, h: HanhDongTao | null, chay: () => void) {
  const x = useXuong();
  const dat = x?.datHanhDong;
  useEffect(() => {
    dat?.(chu, h, chay);
  });
  useEffect(() => () => dat?.(chu, null), [dat, chu]);
}

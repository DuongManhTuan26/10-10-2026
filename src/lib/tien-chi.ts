/**
 * Cách hiển thị tiền đã chi cho bên thứ ba.
 *
 * Màu theo nghĩa: đã chi (âm) là đỏ, chưa chi là xám.
 *
 * KHÔNG làm tròn mất tiền thật: một lượt chatbot chỉ tốn vài phần nghìn đô.
 * Đã thấy: làm tròn 2 số lẻ thì "Marketing" tốn 0,003536 USD hiện thành 0,00 —
 * sổ dùng để tính tiền từng tài khoản mà giấu tiền như vậy là sai. Khoản dưới
 * 1 xu hiện đủ số lẻ (tối đa 10 — nhà cung cấp tính tới 9); chỉ đúng 0 mới ghi
 * 0,00 và không mang dấu âm.
 */
export const TY_GIA = 25_500;

export const so = (n: number) => {
  const a = Math.abs(n);
  const le = a === 0 || a >= 0.01 ? 2 : Math.min(10, Math.max(2, 3 - Math.floor(Math.log10(a))));
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: le });
};

/** Sai số máy (cộng trừ số thực ra 7e-17) không phải tiền đã chi. */
export const daChi = (n: number | null | undefined): n is number => typeof n === 'number' && n > 1e-9;

export const chi = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : daChi(n) ? `−${so(n)} USD` : `${so(0)} USD`;

/**
 * Đủ mọi số lẻ (tới 10) — dùng trong phần CHI TIẾT và nhật ký, nơi các dòng
 * phải cộng lại đúng từng phần triệu đô. Dòng chính bên ngoài dùng chi() cho gọn.
 */
export const chiDu = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : daChi(n)
      ? `−${n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 10 })} USD`
      : `${so(0)} USD`;

export const mauChi = (n: number | null | undefined) => (daChi(n) ? 'text-red-400' : 'text-on-surface-variant');

export const vnd = (n: number) => `≈ ${(Math.round((n * TY_GIA) / 1000) * 1000).toLocaleString('vi-VN')}đ`;

/**
 * Cách hiển thị tiền đã chi cho bên thứ ba.
 *
 * Màu theo nghĩa: đã chi (âm) là đỏ, chưa chi là xám. Khoản nhỏ hơn nửa xu
 * hiện ra là 0,00 — khi đó không được mang dấu âm hay màu đỏ (đã thấy "−0,00").
 */
export const TY_GIA = 25_500;

export const so = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const daChi = (n: number | null | undefined): n is number => typeof n === 'number' && n >= 0.005;

export const chi = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : daChi(n) ? `−${so(n)} USD` : `${so(0)} USD`;

export const mauChi = (n: number | null | undefined) => (daChi(n) ? 'text-red-400' : 'text-on-surface-variant');

export const vnd = (n: number) => `≈ ${(Math.round((n * TY_GIA) / 1000) * 1000).toLocaleString('vi-VN')}đ`;

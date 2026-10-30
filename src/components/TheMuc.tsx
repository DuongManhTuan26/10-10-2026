/**
 * THẺ MỤC kiểu Tổng quan (chủ dự án 23/10/2026: màn hệ thống "ít nhất phải học theo Tổng quan") — cùng chất liệu .the
 * của Dashboard: viền + quầng theo màu, ô biểu tượng phát sáng, tiêu đề đậm. Màu theo NGHĨA qua --nhan (không dùng màu 4
 * AI làm màu trang trí — chỉ khi nội dung thuộc đúng AI đó).
 */
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { bienThe } from '../lib/bon-ai';

export default function TheMuc({
  mau,
  bieuTuong,
  tieuDe,
  phai,
  className,
  children,
}: {
  mau: string;
  bieuTuong: string;
  tieuDe: ReactNode;
  phai?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx('the p-5 md:p-6 min-w-0', className)} style={bienThe(mau)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-3 text-base font-bold text-on-surface min-w-0">
          <span className="o-bieu-tuong shrink-0"><span className="material-symbols-outlined text-[20px]">{bieuTuong}</span></span>
          <span className="min-w-0">{tieuDe}</span>
        </h2>
        {phai}
      </div>
      {children}
    </section>
  );
}

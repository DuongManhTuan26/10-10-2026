import type { ModelVideo } from '../lib/api';

/**
 * Hướng dẫn chọn kỹ năng và mô hình video — theo giới hạn và thế mạnh do NHÀ SẢN XUẤT công bố
 * (docs/nghien-cuu-video-ai.md). Dòng chính ngắn; bảng chi tiết chỉ mở khi bấm.
 */
export function HuongDanChonMoHinh({ models }: { models: ModelVideo[] }) {
  const coThongTin = models.filter((m) => m.giayToiDa);
  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-xs">
      <summary className="cursor-pointer font-bold text-on-surface">Hướng dẫn chọn kỹ năng và mô hình</summary>
      <div className="mt-3 space-y-2 text-on-surface-variant leading-relaxed">
        <p>
          <b className="text-on-surface">Tới 30 giây</b> → "Video ngắn": một lần tạo, rẻ và nhanh. Dài nhất 30 giây (Wan 3.0, Seedance 2.5).
        </p>
        <p>
          <b className="text-on-surface">Nhiều cảnh, tới 5 phút</b> → "Theo kịch bản": chọn kiểu (quảng cáo, người thật review, phim ngắn),
          thêm ảnh sản phẩm / nhân vật, AI viết kịch bản (1–3 phương án) và báo giá trước. Hai cách làm:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b className="text-on-surface">Nối dài liền mạch</b> — tính năng của hãng: mỗi đoạn sau do mô hình làm TIẾP đoạn trước
            (Seedance 2.5, mỗi đoạn tới 30 giây, giữ nhân vật và giọng).
          </li>
          <li>
            <b className="text-on-surface">Ghép nhiều cảnh</b> — mọi mô hình: tạo từng cảnh rồi ghép, cảnh sau nối từ khung cuối cảnh trước.
          </li>
        </ul>
        {coThongTin.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left mt-1">
              <thead>
                <tr className="text-on-surface">
                  <th className="py-1 pr-3 font-bold">Mô hình</th>
                  <th className="py-1 pr-3 font-bold">Tối đa/lần</th>
                  <th className="py-1 pr-3 font-bold">Nối dài</th>
                  <th className="py-1 pr-3 font-bold">Nhiều cảnh/lần</th>
                  <th className="py-1 font-bold">Nói tiếng Việt</th>
                </tr>
              </thead>
              <tbody>
                {coThongTin.map((m) => (
                  <tr key={m.id} className="border-t border-outline-variant/50">
                    <td className="py-1 pr-3 text-on-surface">{m.ten}</td>
                    <td className="py-1 pr-3">{m.giayToiDa} giây</td>
                    <td className="py-1 pr-3">{m.noiDai ? '✓' : '—'}</td>
                    <td className="py-1 pr-3">{m.nhieuCanh ? '✓' : '—'}</td>
                    <td className="py-1">{m.tiengVietGoc ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px]">
          Nguồn: tài liệu chính thức của từng hãng (Google Veo, BytePlus Seedance, Kling) và danh mục của nhà cung cấp.
        </p>
      </div>
    </details>
  );
}

/**
 * Hướng kịch bản NGƯỜI DÙNG tự bật/tắt cho AI viết lời mô tả / AI đạo diễn — app không gài cứng
 * (chủ dự án 03/10/2026). Tắt thì AI theo đúng ý tưởng/nội dung người dùng viết.
 */
export interface HuongKichBanGiaTri {
  cauTrucQuangCao: boolean;
  giuSuThat: boolean;
  boiCanhVietNam: boolean;
}

export const HUONG_TAT: HuongKichBanGiaTri = { cauTrucQuangCao: false, giuSuThat: false, boiCanhVietNam: false };

const LUA_CHON: { khoa: keyof HuongKichBanGiaTri; ten: string; giaiThich: string }[] = [
  {
    khoa: 'cauTrucQuangCao',
    ten: 'Theo cấu trúc quảng cáo',
    giaiThich: 'Mở đầu gây chú ý trong 2 giây → vấn đề → giải pháp → lợi ích → kêu gọi hành động ở cuối.',
  },
  {
    khoa: 'giuSuThat',
    ten: 'Chỉ nói đúng những gì nội dung nêu',
    giaiThich: 'AI không tự thêm giá, con số, khuyến mãi, giải thưởng hay tính năng mà bạn không viết.',
  },
  {
    khoa: 'boiCanhVietNam',
    ten: 'Bối cảnh Việt Nam',
    giaiThich: 'Người và nơi chốn trong video theo đời thường Việt Nam.',
  },
];

export function HuongKichBanChon({
  giaTri,
  onDoi,
  an = [],
}: {
  giaTri: HuongKichBanGiaTri;
  onDoi: (moi: HuongKichBanGiaTri) => void;
  /** Mục không hiện (vd. video dài đã có "Kiểu kịch bản: Quảng cáo bán hàng" thay cho cấu trúc quảng cáo). */
  an?: (keyof HuongKichBanGiaTri)[];
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-on-surface">Hướng kịch bản (tuỳ bạn chọn)</span>
      {LUA_CHON.filter((o) => !an.includes(o.khoa)).map((o) => (
        <label key={o.khoa} className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={giaTri[o.khoa]}
            onChange={(e) => onDoi({ ...giaTri, [o.khoa]: e.target.checked })}
          />
          <span>
            <span className="block text-xs text-on-surface">{o.ten}</span>
            <span className="block text-[11px] text-on-surface-variant">{o.giaiThich}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

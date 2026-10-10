/**
 * Luật nội dung NGƯỜI DÙNG tự bật/tắt cho AI ảnh và AI video — app không gài cứng
 * (chủ dự án 03/10/2026). Tắt thì không thêm luật gì: lời mô tả của người dùng quyết định.
 * Mỗi lựa chọn hiện căn cứ để người dùng tự quyết.
 */
export interface LuatNoiDungGiaTri {
  chanNhanHieuGia: boolean;
  chanNguoiThat: boolean;
  /** Chỉ có nghĩa khi vẽ lại từ ảnh mẫu. */
  xoaWatermark?: boolean;
}

const LUA_CHON: { khoa: keyof LuatNoiDungGiaTri; ten: string; canCu: string; chiKhiCoAnhMau?: boolean }[] = [
  {
    khoa: 'chanNhanHieuGia',
    ten: 'Không để AI bịa nhãn hiệu, huy hiệu chứng nhận',
    canCu: 'Meta từ chối quảng cáo có tuyên bố sai, gây hiểu lầm (vd. tự nhận "được chứng nhận" khi không có).',
  },
  {
    khoa: 'chanNguoiThat',
    ten: 'Không để AI vẽ người nổi tiếng, người thật nhận ra được',
    canCu: 'Điều 32 Bộ luật Dân sự 2015: dùng hình ảnh người khác phải được đồng ý; dùng để bán hàng phải trả thù lao.',
  },
  {
    khoa: 'xoaWatermark',
    ten: 'Xoá watermark và chữ chèn thêm trong ảnh mẫu',
    canCu: 'Chỉ khi vẽ lại từ ảnh mẫu. Chữ trên bao bì thật vẫn giữ.',
    chiKhiCoAnhMau: true,
  },
];

export function LuatNoiDungChon({
  giaTri,
  onDoi,
  coAnhMau = false,
}: {
  giaTri: LuatNoiDungGiaTri;
  onDoi: (moi: LuatNoiDungGiaTri) => void;
  /** Đang vẽ lại từ ảnh mẫu → hiện thêm lựa chọn xoá watermark. */
  coAnhMau?: boolean;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-on-surface">Giới hạn nội dung (tuỳ bạn chọn)</span>
      {LUA_CHON.filter((o) => coAnhMau || !o.chiKhiCoAnhMau).map((o) => (
        <label key={o.khoa} className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={Boolean(giaTri[o.khoa])}
            onChange={(e) => onDoi({ ...giaTri, [o.khoa]: e.target.checked })}
          />
          <span>
            <span className="block text-xs text-on-surface">{o.ten}</span>
            <span className="block text-[11px] text-on-surface-variant">{o.canCu}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

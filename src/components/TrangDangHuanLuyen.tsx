import { useActivePage } from '../lib/ActivePage';

/**
 * Dải băng nói rõ đang huấn luyện bộ não của Trang nào.
 *
 * Vai trò, kịch bản và tài liệu gắn theo Trang. Trước đây màn hình huấn luyện
 * không nhắc gì tới Trang, nên chủ shop có nhiều Trang thì gõ xong không biết
 * vừa dạy cho Trang nào — mà dạy nhầm thì AI đi bán sai mặt hàng, sai giá, và
 * không có thông báo lỗi nào để mà biết.
 *
 * ĐẾM TRANG, KHÔNG ĐẾM KÊNH. Một hồ sơ Zernio gom Fanpage, Instagram và
 * TikTok của cùng một shop: ba kênh nhưng chỉ một bộ não. Bản đầu của dải băng
 * này đếm kênh, nên tài khoản thật có ba kênh chung một Trang bị hỏi "bạn muốn
 * dạy trang nào" trong khi chỉ có đúng một trang để dạy — đã thấy đúng như vậy
 * trên dữ liệu thật của tài khoản hoangtuan3310tn.
 */
export default function TrangDangHuanLuyen() {
  const { accounts, activeAccount, setActiveAccountId } = useActivePage();
  const kenhKetNoi = accounts.filter((a) => a.connected);

  // Chưa nối kênh nào thì màn hình kết nối đã có lời nhắc riêng, không chen thêm.
  if (kenhKetNoi.length === 0) return null;

  /*
   * Gom kênh theo Trang. Mỗi Trang lấy một kênh làm đại diện để chủ shop bấm
   * chọn — bấm kênh nào trong cùng một Trang cũng ra đúng bộ não đó.
   */
  const theoTrang = new Map<number, typeof kenhKetNoi>();
  const chuaCoTrang: typeof kenhKetNoi = [];
  for (const kenh of kenhKetNoi) {
    if (kenh.trang_id == null) chuaCoTrang.push(kenh);
    else theoTrang.set(kenh.trang_id, [...(theoTrang.get(kenh.trang_id) ?? []), kenh]);
  }
  const soTrang = theoTrang.size + chuaCoTrang.length;

  const KhungThuong = ({ ten, phu }: { ten: string; phu?: string }) => (
    <div className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5">
      <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
      <span>
        Đang huấn luyện cho trang <strong className="text-on-surface">{ten}</strong>
        {phu ? <span className="text-on-surface-variant"> — {phu}</span> : null}.
      </span>
    </div>
  );

  if (activeAccount) {
    const cungTrang =
      activeAccount.trang_id == null
        ? []
        : (theoTrang.get(activeAccount.trang_id) ?? []).filter((k) => k.id !== activeAccount.id);
    return (
      <KhungThuong
        ten={activeAccount.display_name}
        phu={
          cungTrang.length
            ? `dùng chung bộ não với ${cungTrang.map((k) => k.display_name).join(', ')}`
            : undefined
        }
      />
    );
  }

  // Chỉ có một Trang thì "Tất cả trang" cũng chính là Trang đó, không nhập nhằng.
  if (soTrang === 1) {
    const dsKenh = theoTrang.size ? [...theoTrang.values()][0] : chuaCoTrang;
    return (
      <KhungThuong
        ten={dsKenh[0].display_name}
        phu={dsKenh.length > 1 ? `gồm ${dsKenh.length} kênh dùng chung một bộ não` : undefined}
      />
    );
  }

  // Nhiều Trang mà chưa chọn: máy chủ buộc phải lấy Trang đầu tiên. Phải hỏi,
  // không được ghi lặng lẽ vào một Trang bất kỳ.
  const daiDien = [...theoTrang.values(), ...chuaCoTrang.map((k) => [k])];
  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-2 text-sm text-on-surface">
        <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
        <span>
          Bộ chọn trên thanh menu đang để <strong>Tất cả trang</strong>, nhưng mỗi trang có bộ não
          riêng. Vui lòng chọn đúng trang muốn huấn luyện trước khi sửa.
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {daiDien.map((dsKenh) => (
          <button
            key={dsKenh[0].id}
            onClick={() => setActiveAccountId(dsKenh[0].id)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface border border-outline-variant hover:border-primary hover:text-primary transition-colors"
          >
            {dsKenh[0].display_name}
            {dsKenh.length > 1 ? (
              <span className="ml-1 text-on-surface-variant">+{dsKenh.length - 1} kênh</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

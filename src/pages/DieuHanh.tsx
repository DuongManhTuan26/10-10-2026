/**
 * AI ĐIỀU HÀNH — thành viên thứ 4 của BỘ NÃO AI (chủ dự án 10/10/2026). Nhận báo cáo năng suất / hiệu suất của 3 AI
 * nhân viên (viết bài, quảng cáo, bán hàng) của TRANG ĐANG CHỌN → đối chiếu, rà soát hằng ngày → giữ điểm tốt, tìm
 * nguyên nhân + giải pháp cho điểm chưa tốt → vòng lặp tối ưu.
 *
 * Thay trang "AI Thống Kê - Phân Tích" cũ (chủ dự án duyệt: gộp biểu đồ, bỏ AI phân tích cũ — hai AI cùng nhận xét
 * một trang sẽ nói khác nhau). Mọi số tính theo TRANG đang chọn (không gộp nhiều bộ não). Cùng khung, thẻ, màu với
 * các trang AI khác.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, ApiError, type BaoCaoDieuHanh, type KyTongQuan } from '../lib/api';
import { useActivePage } from '../lib/ActivePage';
import BaoCaoChuoi from '../components/BaoCaoChuoi';
import SucKhoeTrang from '../components/SucKhoeTrang';
import DieuHanhThu from '../components/DieuHanhThu';
import { aiTheoMa, BIEU_DO, MAU_NGUON_KHACH } from '../lib/bon-ai';

const vnd = (x: number) => `${x.toLocaleString('vi-VN')} ₫`;

function Khung({ tieuDe, phu, mau, children }: { tieuDe: string; phu?: string; mau: string; children: ReactNode }) {
  return (
    <section className={clsx('khung-muc', mau)}>
      <h3 className="tieu-de-muc dau-muc">{tieuDe}</h3>
      {phu && <p className="text-xs text-on-surface-variant -mt-1 mb-3">{phu}</p>}
      {children}
    </section>
  );
}

/** ④ AI Điều hành › Đang làm: rà soát, tìm nguyên nhân, đề xuất (chế độ đề xuất — chờ duyệt). */
export function DangLamDieuHanh() {
  const { activeTrangId } = useActivePage();
  return (
    <Khung tieuDe="Rà soát và đề xuất" phu="Chế độ đề xuất — không thực thi gì, mọi đề xuất chờ duyệt" mau="mau-vang">
      <DieuHanhThu trangId={activeTrangId} />
    </Khung>
  );
}

/** ④ AI Điều hành › Kết quả: báo cáo năng suất / hiệu suất 3 AI nhân viên của trang đang chọn. */
export function KetQuaDieuHanh() {
  const { activeTrangId } = useActivePage();
  const [ky, setKy] = useState<KyTongQuan>('thang_nay');
  const [du, setDu] = useState<BaoCaoDieuHanh | null>(null);
  const [loi, setLoi] = useState('');

  const tai = useCallback(async () => {
    setDu(null);
    setLoi('');
    try {
      const { data } = await api.dieuHanh.baoCao(ky);
      setDu(data);
    } catch (e) {
      setLoi(e instanceof ApiError ? e.message : 'Chưa tải được báo cáo');
    }
  }, [ky]);
  // Đổi trang = đổi bộ não → nạp lại.
  useEffect(() => { void tai(); }, [tai, activeTrangId]);

  const bh = du?.chuoi.banHang;
  const donThat = bh ? bh.soDon - bh.donHuy : 0;
  const theNguon = bh
    ? [
        { name: 'Quảng cáo', value: bh.theoNguon.quangCao, mau: MAU_NGUON_KHACH.quangCao },
        { name: 'Bình luận bài', value: bh.theoNguon.binhLuan, mau: MAU_NGUON_KHACH.binhLuan },
        { name: 'Liên kết', value: bh.theoNguon.lienKet, mau: MAU_NGUON_KHACH.lienKet },
        { name: 'Tự nhắn', value: bh.theoNguon.tuNhan, mau: MAU_NGUON_KHACH.tuNhan },
        { name: 'Chưa ghi nguồn', value: bh.theoNguon.chuaGhiNguon, mau: MAU_NGUON_KHACH.chuaGhiNguon },
      ].filter((x) => x.value > 0)
    : [];
  const coDoanhThu = (du?.theoNgay ?? []).some((d) => d.doanhThu > 0 || d.don > 0);

  const the = du && bh ? [
    { nhan: 'Doanh thu', gia: vnd(bh.doanhThu), icon: 'payments', phu: `${donThat} đơn không huỷ` },
    { nhan: 'Hội thoại mới', gia: bh.hoiThoaiMoi.toLocaleString('vi-VN'), icon: 'forum', phu: `${bh.tinAiTraLoi.toLocaleString('vi-VN')} tin AI trả lời` },
    { nhan: 'Tỷ lệ chốt', gia: bh.tiLeChot === null ? '—' : `${(bh.tiLeChot * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`, icon: 'done_all', phu: 'hội thoại mới có đơn' },
    { nhan: 'Bài đã đăng', gia: du.chuoi.noiDung.baiDang.toLocaleString('vi-VN'), icon: 'post_add', phu: `${du.chuoi.noiDung.baiLoi} bài lỗi` },
  ] : [];

  return (
    <div className="space-y-6">
        <div className="flex justify-end">
          <select
            value={ky}
            onChange={(e) => setKy(e.target.value as KyTongQuan)}
            className="bg-surface-container-high px-4 py-2 rounded-lg border border-outline-variant hover:border-primary transition-colors text-sm font-medium outline-none text-on-surface appearance-none"
          >
            <option value="thang_nay">Tháng này</option>
            <option value="thang_truoc">Tháng trước</option>
          </select>
        </div>

        {loi && <div className="text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3">{loi}</div>}
        {!du && !loi && <p className="text-sm text-on-surface-variant">Đang tải báo cáo của cửa hàng…</p>}

        {du && bh && (
          <>
            {du.kyTinh.keoTuMoc && (
              <p className="text-[11px] text-on-surface-variant">Số theo trang tính từ {new Date(du.kyTinh.moc).toLocaleDateString('vi-VN')} (mốc bắt đầu ghi theo trang).</p>
            )}

            {/* Thẻ số chính */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {the.map((c) => (
                <div key={c.nhan} className="bg-surface-container-high rounded-xl p-5 border border-outline-variant shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[24px]">{c.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">{c.nhan}</p>
                    <h4 className="text-xl font-black text-on-surface truncate">{c.gia}</h4>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{c.phu}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Biểu đồ: doanh thu theo ngày + nguồn khách — của RIÊNG trang này */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Hai phần liền nhau khác màu: doanh thu xám, nguồn khách lam (khung "Báo cáo" bên dưới là vàng ④). */}
              <div className="khung-muc mau-xam lg:col-span-2">
                <h3 className="tieu-de-muc dau-muc">Doanh thu theo ngày</h3>
                <div className="h-[280px] w-full">
                  {!coDoanhThu ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                      <span className="material-symbols-outlined text-[40px] text-on-surface-variant">show_chart</span>
                      <p className="text-sm text-on-surface-variant">Chưa có doanh thu trong kỳ này</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={du.theoNgay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mauDoanhThu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={aiTheoMa('analytics').hex} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={aiTheoMa('analytics').hex} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={BIEU_DO.luoi} vertical={false} />
                        <XAxis dataKey="ngay" stroke={BIEU_DO.truc} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke={BIEU_DO.truc} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000000}M`} />
                        <Tooltip
                          contentStyle={BIEU_DO.chuThich}
                          itemStyle={{ color: aiTheoMa('analytics').hex, fontWeight: 'bold' }}
                          labelStyle={{ ...BIEU_DO.nhanChuThich, marginBottom: '4px' }}
                          formatter={(v: number) => vnd(v)}
                        />
                        <Area type="monotone" dataKey="doanhThu" name="Doanh thu" stroke={aiTheoMa('analytics').hex} strokeWidth={3} fillOpacity={1} fill="url(#mauDoanhThu)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="khung-muc mau-lam flex flex-col">
                <h3 className="tieu-de-muc dau-muc">Nguồn khách (hội thoại mới)</h3>
                <div className="h-[280px] w-full flex-1">
                  {theNguon.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                      <span className="material-symbols-outlined text-[40px] text-on-surface-variant">pie_chart</span>
                      <p className="text-sm text-on-surface-variant">Chưa có hội thoại mới trong kỳ</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={theNguon} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                          {theNguon.map((x) => <Cell key={x.name} fill={x.mau} />)}
                        </Pie>
                        <Tooltip contentStyle={BIEU_DO.chuThich} itemStyle={{ fontWeight: 'bold' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Báo cáo của 3 AI nhân viên — chuỗi 4 khâu */}
            <Khung tieuDe="Báo cáo 3 AI nhân viên" phu="Nội dung → Quảng cáo → Bán hàng → Tổng: đã làm gì, tốn bao nhiêu, ra kết quả gì, hỏng ở đâu" mau="mau-vang">
              <BaoCaoChuoi t={du.trang} du={du.chuoi} />
            </Khung>

            {/* Điểm tốt / chưa tốt — thống kê chấm, không AI */}
            <Khung tieuDe="Điểm tốt cần giữ · điểm chưa tốt cần xử lý" phu="7 ngày gần so với 28 ngày trước — chỉ kết luận khi có ý nghĩa thống kê" mau="mau-lam">
              <SucKhoeTrang du={du.sucKhoe} />
            </Khung>
          </>
        )}

    </div>
  );
}

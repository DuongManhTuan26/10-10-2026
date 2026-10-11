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

const COLORS = ['#00e5ff', '#d946ef', '#f59e0b', '#3b82f6', '#10b981', '#ef4444'];
const vnd = (x: number) => `${x.toLocaleString('vi-VN')} ₫`;

function Khung({ tieuDe, phu, icon, children }: { tieuDe: string; phu?: string; icon: string; children: ReactNode }) {
  return (
    <section className="bg-surface-container rounded-xl border border-outline-variant p-6 shadow-lg">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-on-surface">{tieuDe}</h3>
          {phu && <p className="text-xs text-on-surface-variant mt-0.5">{phu}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DieuHanh() {
  const { trangDangChon, activeTrangId } = useActivePage();
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
        { name: 'Quảng cáo', value: bh.theoNguon.quangCao },
        { name: 'Bình luận bài', value: bh.theoNguon.binhLuan },
        { name: 'Liên kết', value: bh.theoNguon.lienKet },
        { name: 'Tự nhắn', value: bh.theoNguon.tuNhan },
        { name: 'Chưa ghi nguồn', value: bh.theoNguon.chuaGhiNguon },
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
    <main className="flex-1 w-full relative text-on-surface">
      <div className="pt-8 pb-8 px-margin max-w-[1600px] mx-auto w-full space-y-gutter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-on-surface-variant font-body-lg">AI Điều Hành</h2>
            <p className="text-sm font-medium text-on-surface-variant mt-1">
              Nhận báo cáo năng suất, hiệu suất của AI viết bài, AI quảng cáo, AI bán hàng
              {trangDangChon ? <> — trang <b className="text-on-surface">{trangDangChon.ten}</b></> : null}
            </p>
          </div>
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
        {!du && !loi && <p className="text-sm text-on-surface-variant">Đang tải báo cáo của trang…</p>}

        {du && bh && (
          <>
            {du.kyTinh.keoTuMoc && (
              <p className="text-[11px] text-on-surface-variant">Số theo trang tính từ {new Date(du.kyTinh.moc).toLocaleDateString('vi-VN')} (mốc bắt đầu ghi theo trang).</p>
            )}

            {/* Thẻ số chính */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6 shadow-lg lg:col-span-2">
                <h3 className="font-headline-sm text-lg font-bold text-on-surface mb-6">Doanh thu theo ngày</h3>
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
                            <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="ngay" stroke="#8b95a1" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#8b95a1" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000000}M`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                          itemStyle={{ color: '#00e5ff', fontWeight: 'bold' }}
                          labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                          formatter={(v: number) => vnd(v)}
                        />
                        <Area type="monotone" dataKey="doanhThu" name="Doanh thu" stroke="#00e5ff" strokeWidth={3} fillOpacity={1} fill="url(#mauDoanhThu)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="bg-surface-container rounded-xl border border-outline-variant p-6 shadow-lg flex flex-col">
                <h3 className="font-headline-sm text-lg font-bold text-on-surface mb-6">Nguồn khách (hội thoại mới)</h3>
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
                          {theNguon.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }} itemStyle={{ fontWeight: 'bold' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Báo cáo của 3 AI nhân viên — chuỗi 4 khâu */}
            <Khung tieuDe="Báo cáo 3 AI nhân viên" phu="Nội dung → Quảng cáo → Bán hàng → Tổng: đã làm gì, tốn bao nhiêu, ra kết quả gì, hỏng ở đâu" icon="account_tree">
              <BaoCaoChuoi t={du.trang} du={du.chuoi} />
            </Khung>

            {/* Điểm tốt / chưa tốt — thống kê chấm, không AI */}
            <Khung tieuDe="Điểm tốt cần giữ · điểm chưa tốt cần xử lý" phu="7 ngày gần so với 28 ngày trước — chỉ kết luận khi có ý nghĩa thống kê" icon="monitor_heart">
              <SucKhoeTrang du={du.sucKhoe} />
            </Khung>
          </>
        )}

        {/* Rà soát, tìm nguyên nhân, đề xuất (chế độ đề xuất — chờ duyệt) */}
        <Khung tieuDe="Rà soát và đề xuất" phu="Chế độ đề xuất — không thực thi gì, mọi đề xuất chờ duyệt" icon="psychology">
          <DieuHanhThu trangId={activeTrangId} />
        </Khung>
      </div>
    </main>
  );
}

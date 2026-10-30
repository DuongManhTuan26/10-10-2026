/**
 * TỔNG QUAN — số gộp của cả tài khoản + bộ não 4 AI của trang đang chọn.
 *
 * Làm lại bố cục 12/10/2026 (chủ dự án: màn cũ lộn xộn, không ngăn nắp; thẻ phủ một màu gần trùng nền, khó thấy). Thứ
 * tự theo mức ưu tiên, trên xuống:
 *   1. Cần xử lý ngay — MỘT DẢI MỎNG một dòng, chỉ nổi màu khi có khách đang chờ người (30/10/2026)
 *   2. Bộ não 4 AI của trang — TRUNG TÂM, tràn bề ngang (truyền vào từ pages/KhoiNao.tsx; chủ dự án 30/10/2026)
 *   3. 4 số chính của kỳ (doanh thu, đơn, khách mới, AI trả lời) — 4 ô gọn một hàng
 *   4. Xu hướng 7 ngày (MỘT biểu đồ gộp) | Hoạt động gần đây (cao bằng nhau, tự cuộn bên trong)
 *   5. Đơn hàng mới nhất
 * Đã bỏ: khung "Phân tích của Trợ lý AI" (AI phân tích cũ — chủ dự án bỏ 10/10; nút "Áp dụng đề xuất" chỉ chuyển trang),
 * 4 thẻ biểu đồ nhỏ (gộp vào một biểu đồ), thẻ "Kênh kết nối" (thuộc Kết nối kênh).
 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { api, formatCurrency, timeAgo, ORDER_STATUS_LABELS, type User } from '../lib/api';
import { aiTheoMa, BIEU_DO, MAU_XAM } from '../lib/bon-ai';

type Range = '1d' | '7d' | '30d';

const KY: { ma: Range; ten: string; phu: string }[] = [
  { ma: '1d', ten: 'Hôm nay', phu: 'từ 0 giờ hôm nay' },
  { ma: '7d', ten: '7 ngày', phu: '7 ngày qua' },
  { ma: '30d', ten: '30 ngày', phu: '30 ngày qua' },
];

/** Nhãn 7 ngày gần nhất (giờ Việt Nam) — khớp cách máy chủ gom số theo ngày VN (routes/dashboard.ts /sparklines). */
function nhan7Ngay(): string[] {
  const homNay = new Date(Date.now() + 7 * 3_600_000);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(homNay.getTime() - (6 - i) * 86_400_000);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}


/**
 * Giờ hiện tại, tự cập nhật theo nhịp — nhịp nằm TRONG từng ô (tờ lịch 1 phút, đồng hồ 1 giây), không ở cả màn: để ở
 * cả màn thì mọi biểu đồ vẽ lại mỗi giây.
 */
function useBayGio(nhipMs: number): Date {
  const [bayGio, setBayGio] = useState(() => new Date());
  useEffect(() => {
    const dem = setInterval(() => setBayGio(new Date()), nhipMs);
    return () => clearInterval(dem);
  }, [nhipMs]);
  return bayGio;
}

/** Các phần của ngày giờ Việt Nam (máy người xem có thể đặt múi giờ khác). */
function gioVN(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return { thu: p.weekday as string, ngay: p.day as string, thang: p.month as string, nam: p.year as string, gio: p.hour as string, phut: p.minute as string };
}

/**
 * TỜ LỊCH — điểm nhấn của đầu trang (chủ dự án 12/10/2026: phần thời gian chưa nổi bật). Dải trên ghi thứ, giữa số ngày
 * cỡ lớn, dưới tháng · năm. Chất liệu khung chung, màu thương hiệu (phần chung, không thuộc AI nào).
 */
function ToLich() {
  const bayGio = useBayGio(60_000);
  const t = gioVN(bayGio);
  return (
    <div className="the shrink-0 w-[88px] overflow-hidden text-center" aria-label={`${t.thu}, ngày ${t.ngay} tháng ${t.thang} năm ${t.nam}`}>
      <div className="py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary border-b border-[color-mix(in_srgb,var(--mau-the)_40%,transparent)] bg-primary/15">
        {t.thu}
      </div>
      <div className="so-lon pt-1.5 text-[40px] font-black text-on-surface">{t.ngay}</div>
      <div className="text-[11px] font-bold text-on-surface leading-tight">Tháng {t.thang}</div>
      <div className="pb-2 text-[10px] text-on-surface-variant leading-tight">{t.nam}</div>
    </div>
  );
}

/** Đồng hồ sống giờ Việt Nam — dấu hai chấm nhấp nháy theo giây. */
function DongHo() {
  const bayGio = useBayGio(1000);
  const t = gioVN(bayGio);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_55%,transparent)] bg-primary/10 pl-2.5 pr-3 py-1">
      <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
      <span className="font-mono text-base font-black text-on-surface tabular-nums">
        {t.gio}<span className={bayGio.getSeconds() % 2 ? 'opacity-30' : ''}>:</span>{t.phut}
      </span>
      <span className="text-[11px] text-on-surface-variant">giờ Việt Nam</span>
    </span>
  );
}

/** Lời chào theo giờ Việt Nam. */
function loiChao(): string {
  const gio = new Date(Date.now() + 7 * 3_600_000).getUTCHours();
  return gio < 11 ? 'Chào buổi sáng' : gio < 14 ? 'Chào buổi trưa' : gio < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

/**
 * Màu chấm của dòng hoạt động (máy chủ gửi tên lớp cũ). Cả ba loại đều là việc của ③ AI Bán hàng: đơn = tím nhạt, AI trả
 * lời = tím ③, khách cần người = hồng "cần làm ngay" (bảng màu theo mức quan trọng).
 */
const MAU_HOAT_DONG: Record<string, string> = {
  'bg-secondary': '#e9ddff',
  'bg-error': 'var(--color-gap)',
  'bg-primary': aiTheoMa('sales').hex,
};

export default function Dashboard({ boNao }: { boNao?: ReactNode } = {}) {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [chuoi7, setChuoi7] = useState<Array<{ id: number; label: string; value: string; data: number[] }>>([]);
  const [aiActivity, setAiActivity] = useState<Array<{ id: number; time: string; content: string; color: string }>>([]);
  const [nguoi, setNguoi] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<Range>('1d');

  const load = useCallback(async (selected: Range) => {
    setIsLoading(true);
    try {
      const [stats, sparklines, activity] = await Promise.all([
        api.dashboard.stats(selected),
        api.dashboard.sparklines(),
        api.dashboard.activity(),
      ]);
      setDashboardData(stats);
      setChuoi7(sparklines.data);
      setAiActivity(activity.data);
    } catch (error) {
      console.error('Không tải được dữ liệu tổng quan', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  useEffect(() => {
    api.auth.me().then(({ user }) => setNguoi(user)).catch(() => setNguoi(null));
  }, []);

  const stats = dashboardData?.stats || {
    orders_count: 0, revenue: 0, new_customers: 0, open_conversations: 0,
    waiting_human: 0, connected_accounts: 0, ai_messages: 0, ai_closed_orders: 0,
  };
  const donGanDay = dashboardData?.recentOrders || [];
  const canXuLy: Array<{ id: string; customer_name: string | null; handoff_reason: string | null; last_message_at: string }> =
    dashboardData?.urgentTasks || [];
  const ky = KY.find((k) => k.ma === range)!;
  const soDon = Number(stats.orders_count) || 0;
  const donAi = Number(stats.ai_closed_orders) || 0;

  // Máy chủ trả theo thứ tự: tin nhắn, AI trả lời, đơn, tỷ lệ AI xử lý, khách mới (routes/dashboard.ts /sparklines).
  const nhan = nhan7Ngay();
  const [tin, aiTraLoi, don, tiLe] = chuoi7;
  const duLieu7 = nhan.map((ngay, i) => ({ ngay, tin: tin?.data[i] ?? 0, ai: aiTraLoi?.data[i] ?? 0, don: don?.data[i] ?? 0 }));
  const co7 = duLieu7.some((d) => d.tin || d.ai || d.don);
  const mauBan = aiTheoMa('sales').hex;

  const baSo = [
    { nhan: 'Đơn hàng', so: soDon.toLocaleString('vi-VN'), phu: `AI chốt ${donAi} · nhân viên ${Math.max(0, soDon - donAi)}`, icon: 'receipt_long', mau: mauBan },
    { nhan: 'Khách mới', so: Number(stats.new_customers).toLocaleString('vi-VN'), phu: 'lần đầu nhắn cho shop', icon: 'person_add', mau: mauBan },
    { nhan: 'AI đã trả lời', so: Number(stats.ai_messages).toLocaleString('vi-VN'), phu: `tin nhắn · ${stats.open_conversations} hội thoại đang mở`, icon: 'smart_toy', mau: mauBan },
  ];


  return (
    <main className="flex-1 w-full relative text-on-surface">
      <div className="p-4 md:p-8 pb-0 md:pb-0 max-w-[1600px] mx-auto w-full space-y-6">

        {/* Đầu trang: tờ lịch · lời chào + đồng hồ sống + phạm vi số liệu · chọn kỳ (ba nút, một lần bấm). */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="hidden 2xl:block"><ToLich /></div>
            <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-on-surface">
                {loiChao()}{nguoi?.name ? <>, <span className="text-primary">{nguoi.name}</span></> : null}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <DongHo />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px]">database</span>
                  {/* Một khối chữ (không chia cột); điện thoại chỉ giữ phần chính. */}
                  <span><span className="hidden sm:inline">Số liệu cả tài khoản · </span><b className="text-on-surface">{ky.phu}</b></span>
                </span>
              </div>
            </div>
          </div>
          <div className="inline-flex rounded-2xl border border-outline-variant p-1 self-start md:self-auto shadow-lg" role="radiogroup" aria-label="Kỳ số liệu">
            {KY.map((k) => (
              <button
                key={k.ma}
                role="radio"
                aria-checked={range === k.ma}
                onClick={() => setRange(k.ma)}
                className={clsx('px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all',
                  range === k.ma ? 'bg-primary text-on-primary shadow-[0_6px_18px_-6px_var(--color-primary)]' : 'text-on-surface-variant hover:text-on-surface')}
              >
                {k.ten}
              </button>
            ))}
          </div>
        </div>

        {/*
          1. CẦN XỬ LÝ NGAY — MỘT DẢI MỎNG (chủ dự án 30/10/2026: thu hẹp mục phụ, khối não là trung tâm). Có khách chờ người
          thì nổi hồng + tên khách (bấm mở đúng hội thoại); không có thì một dòng trung tính.
        */}
        {canXuLy.length > 0 ? (
          <section className="the px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2" style={{ ['--nhan' as string]: 'var(--color-gap)' }}>
            <span className="flex items-center gap-2 font-bold text-on-surface text-sm whitespace-nowrap">
              <span className="material-symbols-outlined text-[20px] text-gap">priority_high</span>
              <span><span className="text-gap">{canXuLy.length} khách</span> đang chờ người trả lời</span>
            </span>
            <span className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1 order-last sm:order-none">
              {canXuLy.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/ban-hang?the=dang-lam&viec=hop-thu&hoi-thoai=${encodeURIComponent(t.id)}`)}
                  title={t.handoff_reason || 'Cần người hỗ trợ'}
                  className="o-trong flex items-center gap-2 px-2.5 py-1 text-left hover:border-gap/50 transition-colors min-w-0 max-w-full sm:max-w-[220px]"
                >
                  <span className="w-6 h-6 rounded-full bg-gap/15 text-gap text-xs font-bold flex items-center justify-center shrink-0">
                    {(t.customer_name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-on-surface truncate">{t.customer_name || 'Khách chưa có tên'}</span>
                  <span className="text-xs text-gap shrink-0">{timeAgo(t.last_message_at)}</span>
                </button>
              ))}
            </span>
            <button onClick={() => navigate('/ban-hang?the=dang-lam&viec=hop-thu')} className="text-sm font-bold text-gap hover:underline whitespace-nowrap ml-auto">
              Mở hộp thư →
            </button>
          </section>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-on-surface" />
            {isLoading ? 'Đang tải…' : 'Không có khách nào đang chờ người trả lời'}
          </div>
        )}

        {/* 2. BỘ NÃO 4 AI — TRUNG TÂM của Tổng quan: ngay đầu trang, tràn hết bề ngang (chủ dự án 30/10/2026). */}
        <div className="xl:-mx-8">{boNao}</div>

        {/*
          3. SỐ CHÍNH CỦA KỲ — 4 Ô GỌN một hàng (chủ dự án 30/10/2026: thu hẹp mục phụ). Biểu đồ theo ngày ở "Xu hướng 7
          ngày" bên dưới. Màu nhấn theo AI làm ra số đó (đơn = ③, khách mới = ①, AI trả lời = ④).
        */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { nhan: `Doanh thu · ${ky.ten.toLowerCase()}`, so: isLoading ? '…' : formatCurrency(stats.revenue), phu: `${soDon.toLocaleString('vi-VN')} đơn, không tính đơn huỷ`, icon: 'payments', mau: mauBan },
            ...baSo.map((o) => ({ ...o, so: isLoading ? '…' : o.so })),
          ].map((o) => (
            <section key={o.nhan} className="the px-4 py-3 flex items-center gap-3 min-w-0" style={{ ['--nhan' as string]: o.mau }}>
              <span className="o-bieu-tuong shrink-0"><span className="material-symbols-outlined text-[20px]">{o.icon}</span></span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-on-surface-variant truncate">{o.nhan}</span>
                <span className="block so-lon text-2xl font-black text-on-surface truncate">{o.so}</span>
                <span className="block text-[11px] text-on-surface-variant truncate" title={o.phu}>{o.phu}</span>
              </span>
            </section>
          ))}
        </div>


        {/* 4. XU HƯỚNG 7 NGÀY | HOẠT ĐỘNG GẦN ĐÂY — hai cột cao bằng nhau. */}
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="the p-5 xl:col-span-2 flex flex-col min-w-0" style={{ ['--nhan' as string]: mauBan }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="flex items-center gap-3 text-base font-bold text-on-surface">
                <span className="o-bieu-tuong"><span className="material-symbols-outlined text-[20px]">monitoring</span></span>
                Xu hướng 7 ngày
              </h3>
              {tiLe && (
                <span className="text-sm text-on-surface-variant">
                  Tỷ lệ AI tự trả lời: <b className="text-on-surface">{tiLe.value}</b>
                  <span className="text-xs"> (tin AI / mọi tin shop trả lời)</span>
                </span>
              )}
            </div>
            {/* Chưa có số thì một dòng ghi chú, không để khung biểu đồ trống chiếm chỗ. */}
            <div className={co7 ? 'h-[260px]' : 'flex-1 flex items-center'}>
              {!co7 ? (
                <div className="w-full py-6 flex items-center justify-center gap-2 text-on-surface-variant text-center">
                  <span className="material-symbols-outlined text-[22px]">show_chart</span>
                  <p className="text-sm">{isLoading ? 'Đang tải…' : 'Chưa có tin nhắn hay đơn hàng nào trong 7 ngày qua'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={duLieu7} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BIEU_DO.luoi} vertical={false} />
                    <XAxis dataKey="ngay" stroke={BIEU_DO.truc} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="tin" stroke={BIEU_DO.truc} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis yAxisId="don" orientation="right" stroke={BIEU_DO.truc} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={BIEU_DO.chuThich} labelStyle={BIEU_DO.nhanChuThich} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="tin" type="monotone" dataKey="tin" name="Tin nhắn" stroke={MAU_XAM} strokeWidth={2} dot={false} />
                    <Line yAxisId="tin" type="monotone" dataKey="ai" name="AI trả lời" stroke={mauBan} strokeWidth={2} dot={false} />
                    <Line yAxisId="don" type="monotone" dataKey="don" name="Đơn hàng" stroke="#e9ddff" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="the p-5 flex flex-col min-w-0 xl:h-[360px]" style={{ ['--nhan' as string]: mauBan }}>
            <h3 className="flex items-center gap-3 text-base font-bold text-on-surface mb-4">
              <span className="o-bieu-tuong"><span className="material-symbols-outlined text-[20px]">bolt</span></span>
              Hoạt động gần đây
            </h3>
            {aiActivity.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{isLoading ? 'Đang tải…' : 'Chưa có hoạt động nào.'}</p>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mr-2 pr-2 space-y-3 max-h-[320px] xl:max-h-none">
                {aiActivity.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: MAU_HOAT_DONG[h.color] ?? 'var(--color-on-surface-variant)' }} />
                    <span className="min-w-0">
                      <span className="block text-[11px] text-on-surface-variant tabular-nums">{h.time}</span>
                      <span className="block text-sm text-on-surface leading-snug line-clamp-2">{h.content}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 5. ĐƠN HÀNG MỚI NHẤT */}
        {/* Đơn hàng thuộc ③ AI Bán hàng — CẢ khung (viền, kẻ dòng, liên kết) màu ③, không chỉ biểu tượng. */}
        <section className="the overflow-hidden mb-8" style={{ ['--nhan' as string]: mauBan }}>
          <div className="px-5 py-4 flex justify-between items-center border-b border-[color-mix(in_srgb,var(--mau-the)_40%,transparent)]">
            <h3 className="flex items-center gap-3 text-base font-bold text-on-surface">
              <span className="o-bieu-tuong"><span className="material-symbols-outlined text-[20px]">receipt_long</span></span>
              Đơn hàng mới nhất
            </h3>
            <button onClick={() => navigate('/ban-hang?the=dang-lam&viec=don-hang')} className="text-sm font-bold hover:underline flex items-center gap-1" style={{ color: mauBan }}>
              Xem tất cả <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          {donGanDay.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">{isLoading ? 'Đang tải…' : 'Chưa có đơn hàng nào'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-on-surface-variant text-xs uppercase tracking-wider">
                    <th className="py-3 px-5 font-bold">Khách hàng</th>
                    <th className="py-3 px-5 font-bold">Sản phẩm</th>
                    <th className="py-3 px-5 font-bold">Giá trị</th>
                    <th className="py-3 px-5 font-bold">Người chốt</th>
                    <th className="py-3 px-5 font-bold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {donGanDay.map((order: any) => (
                    <tr key={order.id} className="border-t border-[color-mix(in_srgb,var(--mau-the)_22%,transparent)] hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="font-medium text-on-surface">{order.customer_name || 'Khách chưa có tên'}</div>
                        {/* Bảng này tính cả tài khoản — ghi cửa hàng để biết mở màn Đơn hàng ở cửa hàng nào (A3). */}
                        <div className="text-xs text-on-surface-variant">{order.ten_cua_hang ? `Cửa hàng ${order.ten_cua_hang}` : 'Cửa hàng đã xoá'}</div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="text-on-surface whitespace-nowrap">{order.product}</div>
                        <div className="text-xs text-on-surface-variant">SL: {order.quantity}</div>
                      </td>
                      <td className="py-3 px-5 font-bold text-on-surface whitespace-nowrap tabular-nums">{formatCurrency(order.total)}</td>
                      <td className="py-3 px-5 whitespace-nowrap text-on-surface-variant">{order.closed_by === 'ai' ? 'AI chốt' : 'Nhân viên'}</td>
                      <td className="py-3 px-5 whitespace-nowrap">
                        {/* Bảng màu B: chờ xác nhận = cần làm ngay (hồng) · huỷ = đỏ · hoàn thành = trắng · còn lại lam (thông tin). */}
                        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                          order.status === 'pending' ? 'bg-gap/15 text-gap'
                            : order.status === 'cancelled' ? 'bg-loi/15 text-loi'
                              : order.status === 'completed' ? 'bg-white/10 text-on-surface'
                                : 'bg-thong-tin/15 text-thong-tin')}>
                          {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

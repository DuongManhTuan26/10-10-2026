/**
 * BỘ NÃO AI CỦA TRANG — 4 AI cố định, liền mạch (chủ dự án 10/10/2026), mỗi AI cùng MỘT khuôn 4 thẻ (KhuonAi) theo
 * đúng trình tự làm việc: Hướng dẫn AI → Đang làm → Kết quả → Nhật ký.
 *
 * Thẻ "Đang làm" ghép đúng màn hình làm việc sẵn có của AI đó (không viết bản thứ hai):
 *   ① Viết bài — bài đăng, Xưởng AI, lịch tự đăng      ② Quảng cáo — tài khoản, chiến dịch, đẩy bài
 *   ③ Bán hàng — Hộp thư · Đơn hàng                    ④ Điều hành — rà soát, đề xuất chờ duyệt
 *
 * Bố cục lấy từ bản thiết kế lại giao diện (zernio-khoi-nao, chủ dự án duyệt 11/10/2026); chức năng giữ nguyên bản này.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import KhuonAi from '../components/KhuonAi';
import CanTrangNao from '../components/CanTrangNao';
import { HuongDanAi, KetQuaAi, NhatKyAi } from '../components/TheKhoiNao';
import Content from './Content';
import Ads from './Ads';
import Inbox from './Inbox';
import Orders from './Orders';
import AutoScripts from './AutoScripts';
import AnToanTaiKhoan from '../components/AnToanTaiKhoan';
import Dashboard from './Dashboard';
import { KetQuaDieuHanh, DangLamDieuHanh } from './DieuHanh';
import { useActivePage } from '../lib/ActivePage';
import { BON_AI } from '../lib/bon-ai';
import { api, type ChiSoSucKhoe, type SucKhoeTrang } from '../lib/api';

export function NoiDungAi() {
  return (
    <CanTrangNao ten="AI Nội dung">
      <KhuonAi
        ai="content"
        the={{
          'huong-dan': <HuongDanAi ai="content" />,
          'dang-lam': <Content trongKhuon />,
          'ket-qua': <KetQuaAi ai="content" />,
          'nhat-ky': <NhatKyAi ai="content" />,
        }}
      />
    </CanTrangNao>
  );
}

export function QuangCaoAi() {
  return (
    <CanTrangNao ten="AI Quảng cáo">
      <KhuonAi
        ai="ads"
        the={{
          'huong-dan': <HuongDanAi ai="ads" />,
          'dang-lam': <Ads trongKhuon />,
          'ket-qua': <KetQuaAi ai="ads" />,
          'nhat-ky': <NhatKyAi ai="ads" />,
        }}
      />
    </CanTrangNao>
  );
}

/** ③ Bán hàng — "Đang làm" gồm Hộp thư và Đơn hàng (hai việc hằng ngày của AI bán hàng), chuyển bằng ?viec=. */
function BanHangDangLam() {
  const [tim, datTim] = useSearchParams();
  const viec = tim.get('viec') === 'don-hang' ? 'don-hang' : 'hop-thu';
  const chon = (v: string) => datTim((p) => { const m = new URLSearchParams(p); m.set('viec', v); return m; }, { replace: true });
  return (
    <div>
      <div className="inline-flex rounded-xl border border-outline-variant p-1 mb-4 bg-surface-container">
        {[
          { ma: 'hop-thu', ten: 'Hộp thư', icon: 'forum' },
          { ma: 'don-hang', ten: 'Đơn hàng', icon: 'receipt_long' },
        ].map((v) => (
          <button
            key={v.ma}
            onClick={() => chon(v.ma)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition',
              viec === v.ma ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface')}
          >
            <span className="material-symbols-outlined text-[18px]">{v.icon}</span>
            {v.ten}
          </button>
        ))}
      </div>
      {viec === 'hop-thu' ? (
        // Hộp thư chiếm trọn chiều cao của nó và tự cuộn bên trong.
        <div className="h-[calc(100vh-320px)] min-h-[560px] rounded-2xl border border-outline-variant overflow-hidden bg-surface">
          <Inbox />
        </div>
      ) : (
        <Orders trongKhuon />
      )}
    </div>
  );
}

export function BanHangAi() {
  return (
    <CanTrangNao ten="AI Bán hàng">
      <KhuonAi
        ai="sales"
        the={{
          // Vai trò, tài liệu, các bước bán hàng, tự chủ, kịch bản bình luận — màn hình cấu hình sẵn có của AI bán hàng.
          'huong-dan': <AutoScripts trongKhuon />,
          'dang-lam': <BanHangDangLam />,
          // An toàn tài khoản + quy định gửi tin của Facebook (chuyển từ Gói dịch vụ).
          'ket-qua': <KetQuaAi ai="sales" them={<AnToanTaiKhoan />} />,
          'nhat-ky': <NhatKyAi ai="sales" />,
        }}
      />
    </CanTrangNao>
  );
}

export function DieuHanhAi() {
  return (
    <CanTrangNao ten="AI Điều hành">
      <KhuonAi
        ai="analytics"
        the={{
          'huong-dan': <HuongDanAi ai="analytics" />,
          'dang-lam': <DangLamDieuHanh />,
          'ket-qua': <KetQuaDieuHanh />,
          'nhat-ky': <NhatKyAi ai="analytics" />,
        }}
      />
    </CanTrangNao>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

const MUC_TOT = { dang_manh: 2, on: 1, chua_du: 0, tut: -1 } as const;

/** Tình trạng một AI = chỉ số tệ nhất của khâu nó (có sự cố → sự cố). Đúng bảng sức khoẻ, không tự chấm lại. */
function tinhTrang(du: SucKhoeTrang | null, khau: ChiSoSucKhoe['khau'] | null) {
  if (!du) return null;
  const chiSo = khau ? du.chiSo.filter((c) => c.khau === khau) : du.chiSo;
  const suCo = khau ? du.suCo.filter((s) => s.khau === khau) : du.suCo;
  if (suCo.length) return { chu: `${suCo.length} sự cố`, mau: 'text-canh-bao bg-canh-bao/10 border-canh-bao/40' };
  const tut = chiSo.filter((c) => c.muc === 'tut').length;
  if (tut) return { chu: `${tut} chỉ số tụt`, mau: 'text-loi bg-loi/10 border-loi/40' };
  const manh = chiSo.filter((c) => c.muc === 'dang_manh').length;
  if (manh) return { chu: `${manh} chỉ số đang mạnh`, mau: 'text-green-400 bg-green-500/10 border-green-500/40' };
  if (chiSo.some((c) => MUC_TOT[c.muc] > 0)) return { chu: 'Ổn', mau: 'text-on-surface bg-white/5 border-white/25' };
  return { chu: 'Chưa đủ dữ liệu', mau: 'text-on-surface-variant bg-surface-container-highest border-outline-variant' };
}

/** TỔNG QUAN: số gộp của tài khoản + bộ não 4 AI của trang đang chọn (đặt ngay dưới 4 số chính — pages/Dashboard.tsx). */
export function TongQuan() {
  return <Dashboard boNao={<TongQuanBoNao />} />;
}

/** Giá trị một chỉ số sức khoẻ, đúng đơn vị (tỉ lệ → %, còn lại số). Thiếu → "—". */
function giaTriChiSo(c: ChiSoSucKhoe | undefined): string {
  const v = c?.gan.giaTri;
  if (v === null || v === undefined) return '—';
  return c!.donVi === 'ti_le'
    ? `${(v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
    : v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

/**
 * BỘ NÃO 4 AI — SƠ ĐỒ NÚT SỐNG (chủ dự án 12/10/2026: phần kiến tạo thêm hài lòng nhưng trình bày chưa có điểm nhấn).
 *
 * Mỗi AI một NÚT: số thứ tự trong vòng sáng màu của AI, tên, chức năng, chỉ số chính 7 ngày (bảng sức khoẻ — code thống
 * kê chấm, không bịa), tình trạng. Đường nối có DÒNG DỮ LIỆU CHẠY: ①→②→③ theo dòng khách; ba đường cong xuống ④ — số liệu
 * đi lên (màu AI nhân viên), đề xuất đi xuống (vàng ④). Quầng sáng chỉ báo trạng thái: đường đang chạy, nút có sự cố /
 * chỉ số tụt thì vòng nhấp nháy đỏ. Khung ngoài giữ chất liệu chung (trong suốt, màu thương hiệu — phần chung của 4 AI).
 */
function TongQuanBoNao() {
  const { trangDangChon, activeTrangId, canChonTrang, loading } = useActivePage();
  const [du, setDu] = useState<SucKhoeTrang | null>(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    if (!activeTrangId) return;
    let huy = false;
    setDu(null);
    setLoi('');
    api.dieuHanh.sucKhoe().then(({ data }) => !huy && setDu(data)).catch(() => !huy && setLoi('Chưa tải được'));
    return () => { huy = true; };
  }, [activeTrangId]);

  // Chưa có trang / đang "tất cả trang": bộ não là của MỘT trang — không vẽ sơ đồ trộn.
  if (loading || !trangDangChon || canChonTrang) return null;

  const [noiDung, quangCao, banHang, dieuHanh] = BON_AI;

  const nut = (a: (typeof BON_AI)[number], rong = false) => {
    const khau = a.so <= 3 ? (a.khau as ChiSoSucKhoe['khau']) : null;
    const tt = tinhTrang(du, khau);
    const coVanDe = !!du && (khau
      ? du.suCo.some((x) => x.khau === khau) || du.chiSo.some((c) => c.khau === khau && c.muc === 'tut')
      : du.suCo.length > 0 || du.uuTien.length > 0);
    // Chỉ số chính: chỉ số ĐẦU của khâu (bảng sức khoẻ xếp sẵn). ④: số việc cần xử lý trước.
    const chinh = khau ? du?.chiSo.find((c) => c.khau === khau) : undefined;
    return (
      <Link
        key={a.ma}
        to={a.duong}
        className={clsx('the the-bam relative z-10 p-4 flex min-w-0', rong ? 'flex-col md:flex-row md:items-center gap-4 md:gap-6' : 'flex-col gap-3')}
        style={{ ['--nhan' as string]: a.hex }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={clsx('vong-so', coVanDe && 'co-van-de')}>{a.so}</span>
          <span className="min-w-0">
            <span className="block text-sm md:text-base font-bold leading-tight" style={{ color: a.hex }}>{a.ten}</span>
            <span className="hidden md:block text-xs text-on-surface-variant leading-snug mt-0.5">{a.chucNang}</span>
          </span>
        </div>

        {/* Chỉ số chính 7 ngày — dòng chính ngắn: số to + tên chỉ số. */}
        <div className={clsx('min-w-0', rong && 'md:ml-auto md:text-right')}>
          {khau ? (
            <>
              <div className="so-lon text-2xl font-black text-on-surface">{du ? giaTriChiSo(chinh) : '…'}</div>
              <div className="text-[11px] text-on-surface-variant leading-snug truncate">{chinh?.ten ?? 'Chỉ số 7 ngày'} · 7 ngày</div>
            </>
          ) : (
            <>
              <div className="so-lon text-2xl font-black text-on-surface">{du ? (du.suCo.length + du.uuTien.length).toLocaleString('vi-VN') : '…'}</div>
              <div className="text-[11px] text-on-surface-variant whitespace-nowrap">việc cần xử lý trước</div>
            </>
          )}
        </div>

        <div className={clsx('flex items-center justify-between gap-2', rong ? 'md:gap-4' : 'mt-auto')}>
          {tt ? (
            <span className={clsx('text-[12px] font-bold border rounded-lg px-2 py-0.5 truncate', tt.mau)}>{tt.chu}</span>
          ) : (
            <span className="text-[12px] text-on-surface-variant">{loi || 'Đang chấm…'}</span>
          )}
          <span className="hidden sm:inline text-[12px] font-bold shrink-0" style={{ color: a.hex }}>Vào xem →</span>
        </div>
      </Link>
    );
  };

  /** Đường ngang giữa hai nút (màn rộng): nền mờ + dòng chạy chuyển màu từ nút trước sang nút sau. */
  const duongNgang = (tu: string, den: string, id: string) => (
    <div className="hidden xl:flex items-center -mx-2" aria-hidden>
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-5 overflow-visible">
        <defs>
          {/* userSpaceOnUse: đường ngang có khung bao cao 0 — tô theo khung bao (mặc định) thì nét biến mất. */}
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2="100" y1="10" y2="10">
            <stop offset="0%" stopColor={tu} />
            <stop offset="100%" stopColor={den} />
          </linearGradient>
        </defs>
        <line x1="0" y1="10" x2="100" y2="10" className="duong-nen" stroke={`url(#${id})`} vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="10" x2="100" y2="10" className="dong-chay" stroke={`url(#${id})`} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );

  // Ba đường cong từ đáy ba nút nhân viên xuống đỉnh ④ (viewBox 0..1000 × 0..100, kéo giãn theo bề rộng).
  const duongCong = [
    { x: 150, mau: noiDung.hex, den: 380 },
    { x: 500, mau: quangCao.hex, den: 500 },
    { x: 850, mau: banHang.hex, den: 620 },
  ];

  return (
    <section className="the p-4 md:p-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="flex items-center gap-3 text-base font-bold text-on-surface">
          <span className="o-bieu-tuong"><span className="material-symbols-outlined text-[20px]">psychology</span></span>
          <span>
            Bộ não AI
            <span className="block text-xs font-medium text-on-surface-variant">
              cửa hàng <span className="text-on-surface font-bold">{trangDangChon.ten}</span> · 4 AI làm việc liền mạch
            </span>
          </span>
        </h3>
        <Link to="/ket-noi" className="text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg border border-outline-variant px-3 py-1.5">
          Đổi cửa hàng
        </Link>
      </div>

      {/* Dòng khách: ① kéo khách → ② khuếch đại → ③ chốt đơn. Điện thoại / màn vừa: lưới 2×2 (④ là ô thứ tư). */}
      <div className="grid grid-cols-2 gap-3 xl:gap-0 xl:grid-cols-[1fr_64px_1fr_64px_1fr]">
        {nut(noiDung)}
        {duongNgang(noiDung.hex, quangCao.hex, 'n12')}
        {nut(quangCao)}
        {duongNgang(quangCao.hex, banHang.hex, 'n23')}
        {nut(banHang)}
        <div className="xl:hidden">{nut(dieuHanh)}</div>
      </div>

      {/* Màn rộng: vòng lặp — số liệu của 3 AI chạy LÊN ④ (màu AI nhân viên), đề xuất của ④ chạy XUỐNG (vàng). */}
      <div className="hidden xl:block">
        <div className="relative h-24" aria-hidden>
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
            {duongCong.map((d, i) => {
              const duong = `M ${d.x} 0 C ${d.x} 55, ${d.den} 45, ${d.den} 100`;
              return (
                <g key={i}>
                  <path d={duong} className="duong-nen" stroke={d.mau} vectorEffect="non-scaling-stroke" />
                  {/* Số liệu đi xuống ④ (lên cấp điều hành) theo màu AI nhân viên. */}
                  <path d={duong} className="dong-chay" stroke={d.mau} vectorEffect="non-scaling-stroke" />
                  {/* Đề xuất của ④ đi ngược lại, lệch nhịp, màu vàng ④. */}
                  <path d={duong} className="dong-chay nguoc" stroke={dieuHanh.hex} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" style={{ animationDelay: '-.55s' }} />
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center gap-8 text-[11px] text-on-surface-variant pointer-events-none">
            <span className="flex items-center gap-1 rounded-full border border-outline-variant bg-background/80 px-2.5 py-0.5"><span className="material-symbols-outlined text-[15px]">south</span>số liệu năng suất, hiệu suất</span>
            <span className="flex items-center gap-1 rounded-full border border-outline-variant bg-background/80 px-2.5 py-0.5"><span className="material-symbols-outlined text-[15px]" style={{ color: dieuHanh.hex }}>north</span>đề xuất: giữ cái tốt, sửa cái chưa tốt</span>
          </div>
        </div>
        <div className="mx-auto max-w-[72%]">{nut(dieuHanh, true)}</div>
      </div>

      {du && du.uuTien.length > 0 && (
        <p className="mt-4 text-sm text-on-surface-variant">
          <span className="font-bold text-loi">⚠ Cần xử lý trước:</span>{' '}
          {du.uuTien.map((m) => du.chiSo.find((x) => x.ma === m)?.ten).filter(Boolean).join(' · ')}
        </p>
      )}
    </section>
  );
}

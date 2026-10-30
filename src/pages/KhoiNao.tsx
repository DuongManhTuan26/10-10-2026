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
import { KhoiNaoAnh, KhoiNaoThe, useSoLieuKhoiNao } from '../components/KhoiNaoVanPhong';

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

/** TỔNG QUAN: số gộp của tài khoản + bộ não 4 AI của trang đang chọn (đặt ngay dưới 4 số chính — pages/Dashboard.tsx). */
export function TongQuan() {
  return <Dashboard boNao={<TongQuanBoNao />} />;
}

/**
 * BỘ NÃO 4 AI — "4 VĂN PHÒNG" (chủ dự án 30/10/2026: giống ảnh mẫu, số thật). Màn rộng: ảnh cảnh văn phòng + màn hình số
 * thật đè đúng chỗ (components/KhoiNaoVanPhong.tsx). Màn hẹp: 4 thẻ cảnh văn phòng + số thật. Bấm văn phòng → vào AI đó.
 * (Sơ đồ nút sống 12/10/2026 được thay bằng bản này; số vẫn từ bảng sức khoẻ + báo cáo điều hành — code chấm, không bịa.)
 */
function TongQuanBoNao() {
  const { trangDangChon, activeTrangId, canChonTrang, loading } = useActivePage();
  const s = useSoLieuKhoiNao(activeTrangId);

  // Chưa có trang / đang "tất cả trang": bộ não là của MỘT trang — không vẽ sơ đồ trộn.
  if (loading || !trangDangChon || canChonTrang) return null;

  return (
    <section className="min-w-0">
      <div className="hidden xl:block">
        <KhoiNaoAnh s={s} tenCuaHang={trangDangChon.ten} />
      </div>
      <div className="xl:hidden the p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
        <KhoiNaoThe s={s} tenCuaHang={trangDangChon.ten} />
      </div>

      {s.suc && s.suc.uuTien.length > 0 && (
        <p className="mt-4 text-sm text-on-surface-variant">
          <span className="font-bold text-loi">⚠ Cần xử lý trước:</span>{' '}
          {s.suc.uuTien.map((m) => s.suc!.chiSo.find((x) => x.ma === m)?.ten).filter(Boolean).join(' · ')}
        </p>
      )}
    </section>
  );
}

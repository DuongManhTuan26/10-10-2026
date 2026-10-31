import { BON_AI, MAU_THUONG_HIEU } from '../lib/bon-ai';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, type User } from '../lib/api';
import DoiMatKhau from './DoiMatKhau';
import { useActivePage } from '../lib/ActivePage';

export default function TopNavBar({ user, avatarUrl, onMoMenu, menuAn = false, gocPhai }: {
  user?: User | null;
  /** Ảnh đại diện của Fanpage đang hoạt động, lấy từ kênh đã kết nối. */
  avatarUrl?: string | null;
  /** Bấm logo ở thanh tiêu đề (chỉ hiện khi menu đang thu gọn hết) để mở lại menu to. */
  onMoMenu?: () => void;
  /** Menu đang thu gọn hết (ẩn) → hiện logo mở menu. */
  menuAn?: boolean;
  /** Thứ đặt ở góc phải trước chuông (vd. nút "đang xem thay" — luôn thấy, không đè nội dung). */
  gocPhai?: ReactNode;
}) {
  const location = useLocation();
  const { trangs, trangDangChon } = useActivePage();
  const [menuMo, setMenuMo] = useState(false);
  const [doiMatKhauMo, setDoiMatKhauMo] = useState(false);
  const navigate = useNavigate();
  const [waitingCount, setWaitingCount] = useState(0);

  // Số hội thoại AI đã nhường quyền, hiện trên chuông thông báo.
  // Nạp lại mỗi khi đổi trang và định kỳ, để nhân viên không bỏ sót khách.
  useEffect(() => {
    let cancelled = false;

    const load = () => {
      api.inbox
        .counts()
        .then(({ data }) => {
          if (!cancelled) setWaitingCount(Number(data.waiting_human) || 0);
        })
        .catch(() => {
          /* Không lấy được số thì để nguyên, không cần báo lỗi ở thanh trên. */
        });
    };

    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [location.pathname]);

  // Tiêu đề theo đường khối não (docs/khoi-nao.md). 4 AI lấy tên từ nguồn duy nhất src/lib/bon-ai.ts.
  const getPageTitle = () => {
    const ai = BON_AI.find((a) => a.duong === location.pathname);
    if (ai) return ai.ten;
    switch (location.pathname) {
      case '/': return 'Tổng quan';
      case '/ket-noi': return 'Kết nối kênh';
      case '/telegram': return 'Báo cáo Telegram';
      case '/pricing': return 'Gói dịch vụ';
      case '/admin': return 'Quản lý tài khoản';
      default: return 'Tổng quan';
    }
  };

  /*
   * Trên điện thoại thanh này trước đây bị ẩn hẳn (hidden md:flex), nên không
   * còn chỗ nào để mở menu — mà menu thì đã trượt ra ngoài màn hình. Giờ luôn
   * hiện, và dưới lg có thêm nút mở ngăn kéo.
   */
  // Màu tiêu đề theo miền (src/lib/bon-ai.ts): 4 AI theo màu của nó; Tổng quan, Kết nối và trang hệ thống = màu thương hiệu
  // (chủ dự án 23/10/2026: trang hệ thống học theo Tổng quan — bỏ chữ trắng).
  const aiDangXem = BON_AI.find((a) => a.duong === location.pathname);
  // 31/10/2026: 4 AI chung màu với Tổng quan — tiêu đề mọi trang một màu thương hiệu.
  const mauTieuDe = MAU_THUONG_HIEU;
  // 31/10/2026: thanh trên rộng đúng phần còn lại sau thanh menu w-76 (19rem) — trước 288px nên lấn 16px, vạch vàng đâm vào menu.

  return (
    <nav className="thanh-tren fixed top-0 right-0 w-full lg:w-[calc(100%-var(--le-menu))] z-40 transition-all duration-300 flex justify-between items-center gap-2 px-3 lg:px-margin py-base h-16">
      <div className="flex items-center gap-2 sm:gap-md min-w-0">
        {/*
          31/10/2026: bỏ nút ☰ — bấm logo xoay vòng menu to → nhỏ → ẩn. Lúc menu ẩn hết, logo nhỏ ở đây để mở lại (máy tính lẫn
          điện thoại).
        */}
        {menuAn && <button
          type="button"
          onClick={onMoMenu}
          title="Mở menu"
          aria-label="Mở menu"
          className="relative w-10 h-10 -ml-1 shrink-0 flex items-center justify-center rounded-xl"
          style={{ filter: 'drop-shadow(0 0 6px rgba(63,240,184,0.45))' }}
        >
          <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full" aria-hidden>
            <polygon points="26,3 46,14.5 46,37.5 26,49 6,37.5 6,14.5" fill="rgba(63,240,184,0.12)" stroke="#3FF0B8" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
          <span className="material-symbols-outlined relative z-10 text-[20px]" style={{ color: '#8FF7D4' }}>deployed_code</span>
        </button>}
        {/* Điện thoại 18px + lề 12px (chủ dự án "ok" 31/10/2026) để tên trang dài hiện đủ. */}
        <h1 className="text-lg lg:text-2xl font-bold truncate" style={{ color: mauTieuDe }}>{getPageTitle()}</h1>
        {/*
          Trang (bộ não) đang làm việc — chỉ hiển thị, đổi trang ở bảng "Trang bán hàng" của Kết nối kênh. Chỉ hiện ở 4 AI:
          chủ shop nhiều trang luôn biết mình đang chỉnh bộ não của trang nào. KHÔNG hiện ở Tổng quan — số ở đó gộp cả tài
          khoản, đặt tên một trang cạnh tiêu đề dễ hiểu nhầm là số của riêng trang đó (sơ đồ 4 AI bên dưới tự ghi tên trang).
        */}
        {aiDangXem && trangs.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/ket-noi')}
            title="Đổi cửa hàng ở Kết nối kênh"
            className="hidden sm:flex items-center gap-1.5 min-w-0 max-w-[16rem] h-8 px-3 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface hover:border-on-surface/40 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">storefront</span>
            <span className="truncate">{trangDangChon ? trangDangChon.ten : 'Tất cả cửa hàng'}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-base">
        {gocPhai}
        <button
          onClick={() => navigate('/ban-hang?the=dang-lam&viec=hop-thu')}
          title={waitingCount > 0 ? `${waitingCount} hội thoại đang chờ bạn xử lý` : 'Không có việc nào đang chờ'}
          className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/80 rounded-full p-2 transition-all duration-200 flex items-center justify-center relative"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
          {/* Khách chờ người = việc cần làm ngay → hồng (bảng B). */}
          {waitingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gap text-black text-[10px] font-bold flex items-center justify-center border-2 border-surface">
              {waitingCount > 99 ? '99+' : waitingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/ban-hang?the=huong-dan')}
          title="Cấu hình AI bán hàng"
          className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/80 rounded-full p-2 transition-all duration-200 flex items-center justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>bolt</span>
        </button>
        <div className="relative ml-1 lg:ml-sm">
        <div
          onClick={() => setMenuMo((v) => !v)}
          className="h-8 w-8 rounded-full border-2 border-white/30 overflow-hidden relative group cursor-pointer"
          title={user?.email ?? ''}
        >
          {avatarUrl ? (
            <img alt="Active Fanpage Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" src={avatarUrl}/>
          ) : (
            /* Chỉ dùng khi Fanpage chưa có ảnh đại diện — giữ nguyên khung tròn và viền */
            <div className="w-full h-full bg-surface-container-high flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <span className="font-label-sm font-bold text-on-surface text-sm">
                {(user?.name || user?.email || '?').trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {/* Bỏ chấm xanh "đang trực tuyến" — không đo gì (rà soát lượt 2, T10). */}
        </div>

        {/*
          Menu tài khoản.

          Trước đây ảnh đại diện có con trỏ bàn tay nhưng bấm KHÔNG làm gì, và
          hệ thống không có chỗ nào đổi mật khẩu — khách đổi máy hay nghi lộ mật
          khẩu là bó tay hoàn toàn.
        */}
        {menuMo && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuMo(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-noi border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/50">
                <p className="text-sm font-bold text-on-surface truncate">{user?.name || 'Gian hàng'}</p>
                <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setMenuMo(false); setDoiMatKhauMo(true); }}
                className="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-variant transition-colors flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                Đổi mật khẩu
              </button>
            </div>
          </>
        )}
        </div>
      </div>

      {doiMatKhauMo && <DoiMatKhau onClose={() => setDoiMatKhauMo(false)} />}
    </nav>
  );
}

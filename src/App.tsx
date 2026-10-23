import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNavBar from './components/TopNavBar';
import ErrorBoundary from './components/ErrorBoundary';
import { TongQuan, NoiDungAi, QuangCaoAi, BanHangAi, DieuHanhAi } from './pages/KhoiNao';
import { mienTheoDuong } from './lib/bon-ai';
import TelegramAlerts from './pages/TelegramAlerts';
import Connections from './pages/Connections';
import Pricing from './pages/Pricing';
// Một màn hình quản lý dùng chung cho quản trị tổng và chủ chuỗi (chủ dự án 04/10/2026: giống 100%, chỉ khác phạm vi).
import QuanLy from './pages/QuanLy';
import DangXemThay from './components/DangXemThay';
import Auth from './pages/Auth';
import { api, ApiError, type User } from './lib/api';
import { ActivePageProvider } from './lib/ActivePage';

type AppState = 'loading' | 'auth' | 'main';

export default function App() {
  // Màu miền của vùng nội dung theo đường dẫn (index.css .mien-*): mọi màu chính bên trong theo đúng AI đang xem.
  const mien = mienTheoDuong(useLocation().pathname);
  const [appState, setAppState] = useState<AppState>('loading');
  /*
   * Ngăn kéo menu trên điện thoại. Từ lg trở lên biến này không có tác dụng gì
   * vì thanh menu luôn đứng cố định.
   */
  const [menuMo, setMenuMo] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Kiểm tra phiên hiện có khi mở trang. Người dùng đã đăng nhập rồi thì
  // không bắt đăng nhập lại mỗi lần tải lại trang.
  useEffect(() => {
    let cancelled = false;

    api.auth
      .me()
      .then(({ user }) => {
        if (cancelled) return;
        setUser(user);
        setAppState('main');
      })
      .catch((error) => {
        if (cancelled) return;
        if (!(error instanceof ApiError) || !error.isUnauthorized) {
          console.error('Không kiểm tra được phiên đăng nhập:', error);
        }
        setAppState('auth');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Phiên chết giữa chừng — đưa thẳng về màn hình đăng nhập.
   *
   * Lớp gọi API bắn sự kiện này khi máy chủ trả 401. Thiếu chỗ lắng nghe thì
   * giao diện cứ đứng nguyên còn mọi thao tác lặng lẽ hỏng, trông y như treo.
   */
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setAppState('auth');
    };
    window.addEventListener('phien-het-han', onUnauthorized);
    return () => window.removeEventListener('phien-het-han', onUnauthorized);
  }, []);

  // Ảnh đại diện trên thanh trên lấy từ kênh đã kết nối, không dùng ảnh dựng sẵn.
  useEffect(() => {
    if (appState !== 'main') return;
    let cancelled = false;

    api.connections
      .accounts()
      .then(({ data }) => {
        if (cancelled) return;
        const active = data.find((account) => account.connected && account.profile_picture);
        setAvatarUrl(active?.profile_picture ?? null);
      })
      .catch(() => {
        /* Không lấy được ảnh thì hiển thị chữ cái đầu, không cần báo lỗi. */
      });

    return () => {
      cancelled = true;
    };
  }, [appState]);

  const handleLogout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Đăng xuất thất bại:', error);
    }
    setUser(null);
    setAppState('auth');
  }, []);

  if (appState === 'loading') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="font-body-md text-on-surface-variant">Đang tải hệ thống…</p>
      </div>
    );
  }

  if (appState === 'auth') {
    return (
      <Auth
        onLogin={(loggedIn) => {
          setUser(loggedIn);
          setAppState('main');
        }}
        onRegister={(registered) => {
          setUser(registered);
          /*
           * Người mới đăng ký vào thẳng màn chính: tài khoản mới đã có "Cửa hàng đầu tiên" (services/tai-khoan.ts), và
           * luồng dẫn "nối kênh → mở bộ não" nằm ở màn Kết nối (sơ đồ mục 5). Màn hướng dẫn ba bước cũ đã gỡ (không còn
           * đường vào — 23/10/2026).
           */
          setAppState('main');
        }}
      />
    );
  }

  return (
    <ActivePageProvider>
    <div className="flex h-screen w-full bg-background nen-app">
      <Sidebar
        onLogout={handleLogout}
        laQuanTri={user?.role === 'admin'}
        moKhung={menuMo}
        onDong={() => setMenuMo(false)}
      />
      <div className="flex-1 lg:ml-72 min-w-0 flex flex-col h-screen relative">
        {/*
          Đang xem thay một trang thì mọi màn hình trông y hệt tài khoản của
          chính mình. Nút vàng cam ở góc phải thanh tiêu đề là thứ phân biệt —
          thanh cố định nên không bao giờ cuộn mất, và không đè lên nội dung.
        */}
        <TopNavBar
          user={user}
          avatarUrl={avatarUrl}
          onMoMenu={() => setMenuMo(true)}
          // Quay lại thì về màn hình quản lý (/quan-ly → /admin).
          gocPhai={<DangXemThay user={user} onQuayLai={() => { window.location.href = '/quan-ly'; }} />}
        />
        <main className={`flex-1 overflow-y-auto custom-scrollbar pt-16 ${mien}`}>
          {/*
            Lỗi ở MỘT màn hình không được kéo đổ cả ứng dụng thành màn hình
            trắng. Hai nút trong lưới hứng lỗi đều điều hướng lại cả trang, nên
            chủ shop luôn thoát ra được.
          */}
          <ErrorBoundary>
          {/*
            MỘT bộ tuyến đường cho mọi tài khoản (chủ dự án 18/10/2026 bỏ tầng chủ chuỗi): tài khoản dùng thường và
            phần dùng thường của quản trị tổng là một; quản trị tổng chỉ có thêm /admin.
          */}
          <Routes>
            <Route path="/" element={<TongQuan />} />
            {/*
              BỘ NÃO AI của MỘT trang — 4 AI cố định, mỗi AI một khuôn 4 thẻ (pages/KhoiNao.tsx). Đang "Tất cả trang" mà
              có nhiều trang thì bắt chọn trang trước (CanTrangNao bên trong từng AI).
            */}
            <Route path="/noi-dung" element={<NoiDungAi />} />
            <Route path="/quang-cao" element={<QuangCaoAi />} />
            <Route path="/ban-hang" element={<BanHangAi />} />
            <Route path="/dieu-hanh" element={<DieuHanhAi />} />
            <Route path="/ket-noi" element={<Connections />} />
            <Route path="/telegram" element={<TelegramAlerts />} />
            <Route path="/pricing" element={<Pricing />} />
            {/*
              Chỉ quản trị mới có đường vào. Đây CHỈ là lớp che mắt — máy chủ
              vẫn kiểm lại vai trò từ database ở mọi lời gọi.
            */}
            {user?.role === 'admin' && <Route path="/admin" element={<QuanLy user={user} />} />}
            {user?.role === 'admin' && <Route path="/quan-ly" element={<Navigate to="/admin" replace />} />}
            {/*
              Đường cũ → đúng chỗ mới, giữ nguyên tham số (đường dẫn đã gửi qua Telegram / đánh dấu trang vẫn mở đúng).
              "AI Thống Kê - Phân Tích" cũ đã gộp vào AI Điều hành (10/10/2026).
            */}
            <Route path="/content" element={<ChuyenHuong den="/noi-dung" them={{ the: 'dang-lam' }} />} />
            <Route path="/ads" element={<ChuyenHuong den="/quang-cao" them={{ the: 'dang-lam' }} />} />
            <Route path="/inbox" element={<ChuyenHuong den="/ban-hang" them={{ the: 'dang-lam', viec: 'hop-thu' }} />} />
            <Route path="/orders" element={<ChuyenHuong den="/ban-hang" them={{ the: 'dang-lam', viec: 'don-hang' }} />} />
            <Route path="/auto-scripts" element={<ChuyenHuong den="/ban-hang" them={{ the: 'huong-dan' }} />} />
            <Route path="/analytics" element={<ChuyenHuong den="/dieu-hanh" />} />
            <Route path="/connections" element={<ChuyenHuong den="/ket-noi" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
    </ActivePageProvider>
  );
}

/** Chuyển đường cũ sang đường mới, giữ tham số sẵn có và thêm tham số mặc định còn thiếu. */
function ChuyenHuong({ den, them }: { den: string; them?: Record<string, string> }) {
  const viTri = useLocation();
  const p = new URLSearchParams(viTri.search);
  for (const [k, v] of Object.entries(them ?? {})) if (!p.has(k)) p.set(k, v);
  const q = p.toString();
  return <Navigate to={`${den}${q ? `?${q}` : ''}`} replace />;
}

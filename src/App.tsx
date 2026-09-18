import { Routes, Route, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNavBar from './components/TopNavBar';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Orders from './pages/Orders';
import Content from './pages/Content';
import Ads from './pages/Ads';
import AutoScripts from './pages/AutoScripts';
import TelegramAlerts from './pages/TelegramAlerts';
import Connections from './pages/Connections';
import Pricing from './pages/Pricing';
import Admin from './pages/Admin';
import QuanLyTrang from './pages/QuanLyTrang';
import DangXemThay from './components/DangXemThay';
import Analytics from './pages/Analytics';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import SetupComplete from './pages/SetupComplete';
import { api, ApiError, type User } from './lib/api';
import { ActivePageProvider } from './lib/ActivePage';

type AppState = 'loading' | 'auth' | 'onboarding' | 'setup_complete' | 'main';

export default function App() {
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
           * Người mới đăng ký là CHỦ CHUỖI, chưa có trang nào.
           *
           * Màn hình hướng dẫn ban đầu là dành cho một trang bán hàng: nối
           * Fanpage, huấn luyện AI, chạy thử kịch bản. Chủ chuỗi chưa có trang
           * thì không làm được bước nào trong đó. Việc đầu tiên của họ là lập
           * trang, nên đưa thẳng tới đó.
           */
          setAppState('main');
        }}
      />
    );
  }

  if (appState === 'onboarding') {
    return (
      <Onboarding
        onComplete={() => setAppState('setup_complete')}
        onSkip={() => setAppState('main')}
      />
    );
  }

  if (appState === 'setup_complete') {
    return <SetupComplete onFinish={() => setAppState('main')} />;
  }

  return (
    <ActivePageProvider>
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        onLogout={handleLogout}
        laQuanTri={user?.role === 'admin'}
        laChuChuoi={user?.role === 'admin_con'}
        moKhung={menuMo}
        onDong={() => setMenuMo(false)}
      />
      <div className="flex-1 lg:ml-72 min-w-0 flex flex-col h-screen relative">
        <TopNavBar user={user} avatarUrl={avatarUrl} onMoMenu={() => setMenuMo(true)} />
        {/*
          Đang xem thay một trang thì mọi màn hình trông y hệt tài khoản của
          chính mình. Dải băng này là thứ duy nhất phân biệt, nên nó nằm trên
          cùng và không bao giờ cuộn mất.
        */}
        <DangXemThay user={user} onQuayLai={() => { window.location.href = '/quan-ly-trang'; }} />
        <main className="flex-1 overflow-y-auto custom-scrollbar pt-16">
          {/*
            Lỗi ở MỘT màn hình không được kéo đổ cả ứng dụng thành màn hình
            trắng. Hai nút trong lưới hứng lỗi đều điều hướng lại cả trang, nên
            chủ shop luôn thoát ra được.
          */}
          <ErrorBoundary>
          {/*
            Hai bộ tuyến đường tách hẳn nhau theo vai trò.

            Chủ chuỗi không có Fanpage, hộp thư hay đơn hàng của riêng mình —
            những thứ đó thuộc về từng tài khoản trang bên dưới. Trộn chung rồi
            chặn từng đường thì phải có HAI tuyến bắt-tất-cả cùng lúc, mà hai
            tuyến "*" trong một <Routes> là mơ hồ, không có gì bảo đảm tuyến nào
            thắng.

            Không màn hình nào bị xoá: chủ chuỗi thấy lại đầy đủ ngay khi bấm
            "Mở trang" bước vào một trang.
          */}
          {user?.role === 'admin_con' ? (
            <Routes>
              <Route path="/quan-ly-trang" element={<QuanLyTrang />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="*" element={<Navigate to="/quan-ly-trang" replace />} />
            </Routes>
          ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/content" element={<Content />} />
            <Route path="/auto-scripts" element={<AutoScripts />} />
            <Route path="/ads" element={<Ads />} />
            <Route path="/telegram" element={<TelegramAlerts />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/pricing" element={<Pricing />} />
            {/*
              Chỉ quản trị mới có đường vào. Đây CHỈ là lớp che mắt — máy chủ
              vẫn kiểm lại vai trò từ database ở mọi lời gọi.
            */}
            {user?.role === 'admin' && <Route path="/admin" element={<Admin />} />}
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
    </ActivePageProvider>
  );
}

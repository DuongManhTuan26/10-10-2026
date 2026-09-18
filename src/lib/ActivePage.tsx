import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, KHOA_TRANG_DANG_CHON, type SocialAccount } from './api';

/**
 * Trang đang được chọn.
 *
 * Bộ chọn Fanpage trên thanh menu chi phối dữ liệu của nhiều màn hình:
 * hộp thư lọc theo trang, bài đăng đăng lên trang đang chọn, số liệu quảng
 * cáo tính theo trang. Vì vậy lựa chọn này phải nằm ở một chỗ chung thay vì
 * mỗi màn hình tự giữ riêng.
 */

interface ActivePageValue {
  accounts: SocialAccount[];
  /** null nghĩa là xem tất cả các trang. */
  activeAccount: SocialAccount | null;
  activeAccountId: string | null;
  /**
   * Trang (bộ não) của kênh đang chọn.
   *
   * Vì sao cần riêng, không dùng activeAccountId là đủ: đổi Fanpage cho một
   * kênh thì mã kênh GIỮ NGUYÊN, chỉ trang_id đổi. Màn hình huấn luyện nào
   * chỉ trông vào activeAccountId sẽ vẫn vẽ bộ não của Fanpage cũ, chủ shop gõ
   * tiếp lên đó là ghi nhầm.
   */
  activeTrangId: number | null;
  setActiveAccountId: (id: string | null) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const ActivePageContext = createContext<ActivePageValue | null>(null);

/*
 * Dùng chung khoá với api.ts. Lớp gọi API đọc thẳng chỗ này để đính Trang
 * đang chọn vào mọi lệnh về bộ não AI, nên hai bên bắt buộc phải cùng một
 * khoá — khai báo riêng mỗi nơi một chuỗi là mầm mống đọc nhầm Trang.
 */
const STORAGE_KEY = KHOA_TRANG_DANG_CHON;

export function ActivePageProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [activeAccountId, setActiveId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.connections.accounts();
      // Tài khoản quảng cáo không phải là trang để nhắn tin hay đăng bài,
      // nên không đưa vào bộ chọn này.
      const pages = data.filter((account) => account.platform !== 'metaads');
      setAccounts(pages);

      // Trang đang chọn đã bị ngắt kết nối thì bỏ chọn, tránh lọc theo
      // một trang không còn tồn tại và màn hình trống trơn không rõ lý do.
      setActiveId((current) => {
        if (current && !pages.some((page) => page.id === current && page.connected)) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return current;
      });
    } catch (error) {
      console.error('Không tải được danh sách trang:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setActiveAccountId = useCallback((id: string | null) => {
    setActiveId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<ActivePageValue>(() => {
    const dangChon = accounts.find((account) => account.id === activeAccountId) ?? null;
    // Chưa chọn kênh nào thì máy chủ dùng Trang đầu tiên — lấy đúng cái đó để
    // màn hình và máy chủ cùng nói về một Trang.
    const trangDangDung =
      dangChon?.trang_id ??
      accounts.find((account) => account.connected && account.trang_id != null)?.trang_id ??
      null;
    return {
      accounts,
      activeAccount: dangChon,
      activeAccountId,
      activeTrangId: trangDangDung,
      setActiveAccountId,
      loading,
      reload,
    };
  }, [accounts, activeAccountId, setActiveAccountId, loading, reload]);

  return <ActivePageContext.Provider value={value}>{children}</ActivePageContext.Provider>;
}

export function useActivePage(): ActivePageValue {
  const context = useContext(ActivePageContext);
  if (!context) {
    throw new Error('useActivePage phải được dùng bên trong ActivePageProvider');
  }
  return context;
}

/** Nhãn ngắn hai chữ cái cho huy hiệu nền tảng. */
export const PLATFORM_BADGE: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  tiktok: 'TT',
  threads: 'TH',
  youtube: 'YT',
  telegram: 'TG',
  metaads: 'MA',
};

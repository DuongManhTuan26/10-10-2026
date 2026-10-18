import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, KHOA_TRANG_DANG_CHON, type SocialAccount } from './api';
import { kenhMacDinh } from './gioi-han-kenh';

/**
 * Trang đang được chọn.
 *
 * Bộ chọn Fanpage trên thanh menu chi phối dữ liệu của nhiều màn hình:
 * hộp thư lọc theo trang, bài đăng đăng lên trang đang chọn, số liệu quảng
 * cáo tính theo trang. Vì vậy lựa chọn này phải nằm ở một chỗ chung thay vì
 * mỗi màn hình tự giữ riêng.
 */

/**
 * Một TRANG = một BỘ NÃO AI (4 AI cố định: viết bài, quảng cáo, bán hàng, điều hành — chủ dự án 10/10/2026). Ô chọn
 * liệt kê theo trang, không theo kênh: các kênh của cùng một trang dùng chung một bộ não.
 */
export interface TrangNao {
  /** Khoá ổn định: "t<id>" cho trang thật; kênh chưa gắn trang đứng riêng "k<id kênh>". */
  khoa: string;
  id: number | null;
  ten: string;
  kenh: SocialAccount[];
}

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
  /** Danh sách trang (bộ não), mỗi trang kèm các kênh của nó. */
  trangs: TrangNao[];
  /** Trang đang chọn; chỉ có MỘT trang thì luôn là trang đó; null = đang "Tất cả trang" khi có nhiều trang. */
  trangDangChon: TrangNao | null;
  /** Chọn trang (null = tất cả trang): lưu kênh chính của trang làm đại diện — máy chủ suy trang từ kênh. */
  chonTrang: (khoa: string | null) => void;
  /** Có nhiều trang mà chưa chọn — 4 mục AI của bộ não phải bắt chọn một trang. */
  canChonTrang: boolean;
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
  /**
   * Cửa hàng mặc định khi tài khoản CHƯA nối kênh nào (chủ dự án 18/10/2026: tài khoản mới phải giống 100% tài khoản
   * mẫu — có sơ đồ 4 AI ngay). Danh sách cửa hàng ở đây dựng từ kênh, nên thiếu dòng này thì cửa hàng chưa có kênh coi
   * như không tồn tại: Tổng quan mất khối bộ não. Lấy cửa hàng cũ nhất — đúng cửa hàng máy chủ dùng khi chưa chọn kênh
   * (layTrangMacDinh).
   */
  const [cuaHangMacDinh, setCuaHangMacDinh] = useState<{ id: number; ten: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, dsCH] = await Promise.all([
        api.connections.accounts(),
        api.connections.dsTrang().catch(() => ({ data: [] as Array<{ id: number; ten: string }> })),
      ]);
      const cuNhat = [...dsCH.data].sort((a, b) => a.id - b.id)[0];
      setCuaHangMacDinh(cuNhat ? { id: cuNhat.id, ten: cuNhat.ten } : null);
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
      console.error('Không tải được danh sách cửa hàng:', error);
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

  const trangs = useMemo<TrangNao[]>(() => {
    const ds = new Map<string, TrangNao>();
    for (const k of accounts) {
      const khoa = k.trang_id != null ? `t${k.trang_id}` : `k${k.id}`;
      const t = ds.get(khoa) ?? { khoa, id: k.trang_id, ten: k.trang_ten || k.display_name || k.username, kenh: [] };
      t.kenh.push(k);
      ds.set(khoa, t);
    }
    // Chưa có kênh nào: vẫn có MỘT cửa hàng (bộ não) để làm việc — cửa hàng mặc định của máy chủ.
    if (ds.size === 0 && cuaHangMacDinh) {
      ds.set(`t${cuaHangMacDinh.id}`, { khoa: `t${cuaHangMacDinh.id}`, id: cuaHangMacDinh.id, ten: cuaHangMacDinh.ten, kenh: [] });
    }
    return [...ds.values()];
  }, [accounts, cuaHangMacDinh]);

  const chonTrang = useCallback((khoa: string | null) => {
    if (!khoa) return setActiveAccountId(null);
    const t = trangs.find((x) => x.khoa === khoa);
    if (!t) return;
    const ketNoi = t.kenh.filter((k) => k.connected);
    // Kênh chính (Fanpage / Instagram — nơi khách nhắn và ra đơn) làm đại diện; cùng trang thì cùng bộ não.
    // Cửa hàng chưa có kênh: không có kênh đại diện — để trống, máy chủ dùng cửa hàng mặc định.
    setActiveAccountId(kenhMacDinh(ketNoi)[0] ?? ketNoi[0]?.id ?? t.kenh[0]?.id ?? null);
  }, [trangs, setActiveAccountId]);

  const value = useMemo<ActivePageValue>(() => {
    const dangChon = accounts.find((account) => account.id === activeAccountId) ?? null;
    const trangDangChon = dangChon
      ? trangs.find((t) => t.kenh.some((k) => k.id === dangChon.id)) ?? null
      : trangs.length === 1 ? trangs[0] : null;
    // Chưa chọn kênh nào thì máy chủ dùng Trang đầu tiên — lấy đúng cái đó để
    // màn hình và máy chủ cùng nói về một Trang.
    const trangDangDung =
      dangChon?.trang_id ??
      accounts.find((account) => account.connected && account.trang_id != null)?.trang_id ??
      (accounts.length === 0 ? cuaHangMacDinh?.id ?? null : null);
    return {
      accounts,
      activeAccount: dangChon,
      activeAccountId,
      activeTrangId: trangDangDung,
      setActiveAccountId,
      trangs,
      trangDangChon,
      chonTrang,
      canChonTrang: trangs.length > 1 && !trangDangChon,
      loading,
      reload,
    };
  }, [accounts, activeAccountId, setActiveAccountId, trangs, chonTrang, loading, reload, cuaHangMacDinh]);

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

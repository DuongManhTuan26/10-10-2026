import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, KHOA_CUA_HANG, KHOA_TRANG_DANG_CHON, type SocialAccount } from './api';
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
  /** Chọn cửa hàng (null = tất cả): lưu MÃ CỬA HÀNG (máy chủ đọc qua X-Cua-Hang) + kênh chính làm bộ lọc kênh mặc định. */
  chonTrang: (khoa: string | null) => void;
  /** Có nhiều trang mà chưa chọn — 4 mục AI của bộ não phải bắt chọn một trang. */
  canChonTrang: boolean;
  loading: boolean;
  reload: () => Promise<void>;
}

const ActivePageContext = createContext<ActivePageValue | null>(null);

/*
 * Dùng chung khoá với api.ts (KHOA_CUA_HANG, KHOA_TRANG_DANG_CHON): lớp gọi API đọc thẳng mã cửa hàng để gửi kèm mọi
 * yêu cầu — hai bên bắt buộc cùng một khoá, khai báo riêng mỗi nơi là mầm mống đọc nhầm cửa hàng.
 */
const STORAGE_KEY = KHOA_TRANG_DANG_CHON;

function docKhoa(khoa: string): string | null {
  try {
    return localStorage.getItem(khoa);
  } catch {
    return null;
  }
}
function ghiKhoa(khoa: string, giaTri: string | null): void {
  try {
    if (giaTri == null) localStorage.removeItem(khoa);
    else localStorage.setItem(khoa, giaTri);
  } catch {
    // Trình duyệt chặn localStorage — lựa chọn chỉ sống trong phiên này.
  }
}
const docMaCuaHang = (): number | null => {
  const v = Number(docKhoa(KHOA_CUA_HANG));
  return Number.isInteger(v) && v > 0 ? v : null;
};

/*
 * A4a (22/10/2026): CHỌN CỬA HÀNG BẰNG MÃ CỬA HÀNG (localStorage zn_cua_hang → đầu X-Cua-Hang, api.ts). Kênh đang chọn
 * (zn_active_account) chỉ còn là BỘ LỌC kênh — luôn thuộc cửa hàng đang chọn; chọn kênh của cửa hàng khác = chuyển sang
 * cửa hàng đó. Danh sách cửa hàng lấy từ máy chủ (/connections/trang) nên có cả cửa hàng CHƯA CÓ KÊNH.
 */
export function ActivePageProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [dsCuaHang, setDsCuaHang] = useState<Array<{ id: number; ten: string }>>([]);
  const [activeAccountId, setActiveId] = useState<string | null>(() => docKhoa(STORAGE_KEY));
  const [cuaHangId, setCuaHangId] = useState<number | null>(docMaCuaHang);
  const [loading, setLoading] = useState(true);

  const ghiCuaHang = useCallback((id: number | null) => {
    setCuaHangId(id);
    ghiKhoa(KHOA_CUA_HANG, id == null ? null : String(id));
  }, []);
  const ghiKenh = useCallback((id: string | null) => {
    setActiveId(id);
    ghiKhoa(STORAGE_KEY, id);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, dsCH] = await Promise.all([
        api.connections.accounts(),
        api.connections.dsTrang().then((r) => r.data).catch(() => null),
      ]);
      // Tài khoản quảng cáo không phải là trang để nhắn tin hay đăng bài,
      // nên không đưa vào bộ chọn này.
      const pages = data.filter((account) => account.platform !== 'metaads');
      setAccounts(pages);

      // Kênh lọc đã ngắt kết nối thì bỏ chọn, tránh lọc theo một kênh không còn — màn hình trống không rõ lý do.
      const kenhLuu = docKhoa(STORAGE_KEY);
      const kenhHopLe = kenhLuu && pages.some((page) => page.id === kenhLuu && page.connected) ? kenhLuu : null;
      if (!kenhHopLe) ghiKenh(null);

      if (dsCH) {
        setDsCuaHang(dsCH.map((t) => ({ id: t.id, ten: t.ten })));
        /*
         * Mã cửa hàng đang lưu KHÔNG thuộc phiên này (admin "Mở tài khoản" còn giữ mã cửa hàng của admin; cửa hàng đã xoá;
         * lần đầu sau A4a chỉ có kênh cũ) → đặt lại: cửa hàng của kênh đang lưu, chỉ một cửa hàng thì cửa hàng đó, còn lại
         * để trống cho chủ shop chọn. Không đặt lại thì giao diện hiện sai tên cửa hàng và mọi lệnh GHI bị 409 (phiên kiểm
         * duyệt, điều kiện A4a).
         */
        const maLuu = docMaCuaHang();
        if (maLuu == null || !dsCH.some((t) => t.id === maLuu)) {
          const tuKenh = pages.find((p) => p.id === kenhHopLe)?.trang_id ?? null;
          ghiCuaHang(tuKenh != null && dsCH.some((t) => t.id === tuKenh) ? tuKenh : dsCH.length === 1 ? dsCH[0].id : null);
        }
      }
    } catch (error) {
      console.error('Không tải được danh sách cửa hàng:', error);
    } finally {
      setLoading(false);
    }
  }, [ghiCuaHang, ghiKenh]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Chọn KÊNH lọc. Kênh thuộc cửa hàng nào thì cửa hàng đó thành cửa hàng đang chọn (kênh luôn thuộc cửa hàng đang chọn). */
  const setActiveAccountId = useCallback((id: string | null) => {
    ghiKenh(id);
    const k = id ? accounts.find((a) => a.id === id) : null;
    if (k?.trang_id != null) ghiCuaHang(k.trang_id);
  }, [accounts, ghiCuaHang, ghiKenh]);

  const trangs = useMemo<TrangNao[]>(() => {
    const ds = new Map<string, TrangNao>();
    // Mọi cửa hàng của tài khoản, kể cả cửa hàng chưa có kênh (A4a — chọn được cả cửa hàng rỗng).
    for (const t of dsCuaHang) ds.set(`t${t.id}`, { khoa: `t${t.id}`, id: t.id, ten: t.ten, kenh: [] });
    for (const k of accounts) {
      const khoa = k.trang_id != null ? `t${k.trang_id}` : `k${k.id}`;
      const t = ds.get(khoa) ?? { khoa, id: k.trang_id, ten: k.trang_ten || k.display_name || k.username, kenh: [] };
      t.kenh.push(k);
      ds.set(khoa, t);
    }
    return [...ds.values()];
  }, [accounts, dsCuaHang]);

  const chonTrang = useCallback((khoa: string | null) => {
    if (!khoa) {
      ghiCuaHang(null);
      ghiKenh(null);
      return;
    }
    const t = trangs.find((x) => x.khoa === khoa);
    if (!t) return;
    const ketNoi = t.kenh.filter((k) => k.connected);
    ghiCuaHang(t.id);
    // Kênh chính (Fanpage / Instagram — nơi khách nhắn và ra đơn) làm bộ lọc mặc định; cửa hàng chưa có kênh → không lọc.
    ghiKenh(kenhMacDinh(ketNoi)[0] ?? ketNoi[0]?.id ?? t.kenh[0]?.id ?? null);
  }, [trangs, ghiCuaHang, ghiKenh]);

  const value = useMemo<ActivePageValue>(() => {
    const kenhLuu = accounts.find((account) => account.id === activeAccountId) ?? null;
    const trangDangChon =
      (cuaHangId != null ? trangs.find((t) => t.id === cuaHangId) : undefined) ??
      // Kênh chưa gắn cửa hàng (thoáng qua lúc nối kênh) đứng riêng "k<id>".
      (kenhLuu && kenhLuu.trang_id == null ? trangs.find((t) => t.kenh.some((k) => k.id === kenhLuu.id)) : undefined) ??
      (trangs.length === 1 ? trangs[0] : null);
    // Kênh lọc luôn thuộc cửa hàng đang chọn.
    const dangChon = kenhLuu && trangDangChon && trangDangChon.kenh.some((k) => k.id === kenhLuu.id) ? kenhLuu : null;
    // Chưa chọn cửa hàng: máy chủ dùng cửa hàng mặc định (layTrangMacDinh — cửa hàng CÓ kênh đang nối, id nhỏ nhất; không
    // có thì id nhỏ nhất) — tính đúng như vậy để màn hình và máy chủ cùng nói về một cửa hàng.
    const coKenh = dsCuaHang.filter((t) => accounts.some((a) => a.connected && a.trang_id === t.id)).map((t) => t.id);
    const macDinh = coKenh.length ? Math.min(...coKenh) : dsCuaHang.length ? Math.min(...dsCuaHang.map((t) => t.id)) : null;
    return {
      accounts,
      activeAccount: dangChon,
      activeAccountId: dangChon?.id ?? null,
      activeTrangId: trangDangChon?.id ?? macDinh,
      setActiveAccountId,
      trangs,
      trangDangChon,
      chonTrang,
      canChonTrang: trangs.length > 1 && !trangDangChon,
      loading,
      reload,
    };
  }, [accounts, activeAccountId, cuaHangId, dsCuaHang, setActiveAccountId, trangs, chonTrang, loading, reload]);

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

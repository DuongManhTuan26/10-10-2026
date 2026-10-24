import React, { useState, useRef, useEffect, useCallback } from 'react';
import HopThoai, { NUT_CHINH, NUT_PHU } from '../components/HopThoai';
import AnhDaiDien from '../components/AnhDaiDien';
import { clsx } from 'clsx';
import { api, ApiError, type Platform, type SocialAccount } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useActivePage } from '../lib/ActivePage';
import { MAU_THUONG_HIEU } from '../lib/bon-ai';
import { hoiNhap, hoiXacNhan } from '../components/HopHoi';
import BangTrangBanHang, { DongKenh } from '../components/BangTrangBanHang';
import ChonTrangBanHang, { type TrangChon } from '../components/ChonTrangBanHang';
import MenuQuanLyTrang, { type MucMenu } from '../components/MenuQuanLyTrang';

// Mỗi lượt kết nối chọn một trang. Chưa phải hạn mức theo gói.
const MOI_LUOT_MOT_TRANG = 1;

/** Khoá lưu tạm "đang nối nền tảng nào" qua lượt rời app sang nền tảng cấp quyền. */
const KHOA_DANG_NOI = 'zn_dang_noi_kenh';
/** Tiến độ "hướng dẫn nối kênh lần lượt" — sống qua lượt tải lại trang khi đăng nhập nền tảng. */
const KHOA_HUONG_DAN = 'zn_huong_dan_noi_kenh';

/** Đọc rồi XOÁ dấu "đang nối" (chỉ tin dấu trong 30 phút — cũ hơn là lượt khác). */
function docDangNoi(): { platformKey: string; ten: string; truoc: number; noiLai?: string; trangId?: number | null } | null {
  try {
    const tho = sessionStorage.getItem(KHOA_DANG_NOI);
    sessionStorage.removeItem(KHOA_DANG_NOI);
    if (!tho) return null;
    const d = JSON.parse(tho) as { platformKey: string; ten: string; truoc: number; luc: number; noiLai?: string; trangId?: number | null };
    return Date.now() - d.luc < 30 * 60_000 ? d : null;
  } catch {
    return null;
  }
}

export default function Connections() {
  const { reload: reloadActivePages, trangDangChon, trangs, chonTrang } = useActivePage();
  const navigate = useNavigate();

  const [connectStep, setConnectStep] = useState(0); // 0 = đóng, 1-4 = các bước
  /**
   * Mã KÊNH vừa tạo ở bước chọn Trang (select-pages trả về) — bước 4 liệt kê đúng các kênh này. Bản cũ lọc lại danh sách
   * chọn Trang bằng mã Fanpage SAU KHI đã xoá danh sách đó → bước 4 luôn trống (kiểm toàn 23/10/2026, sơ đồ mục 5).
   */
  const [kenhVuaNoi, setKenhVuaNoi] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  /*
   * Nhịp hỏi máy chủ trong lúc chờ cấp quyền. Giữ trong ref chứ không trong
   * state: phải dừng được cả khi người dùng rời trang giữa chừng, nếu không nó
   * chạy ngầm mãi và tiếp tục đốt hạn mức gọi Zernio.
   */
  const oauthTimer = useRef<number | null>(null);
  const accountsBeforeOAuth = useRef(0);
  /**
   * Trang lấy từ Facebook, CHƯA kết nối — khách chọn cái nào thì mới tạo kênh.
   * Khác hẳn `accounts` vốn là các kênh đã kết nối rồi.
   */
  const [pagesToSelect, setPagesToSelect] = useState<
    Array<{ id: string; name: string; username: string | null; category: string | null }>
  >([]);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);

  const [catalog, setCatalog] = useState<{ social: Platform[]; ads: Platform[]; communication: Platform[] }>({
    social: [], ads: [], communication: [],
  });
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  /** Tài khoản vừa nối xong của đúng nền tảng đang chọn. */
  const justConnected = selectedPlatform
    ? accounts.find((a) => a.platform === selectedPlatform.platformKey && a.connected)
    : undefined;
  const justConnectedName =
    justConnected?.display_name || justConnected?.username || 'tài khoản của bạn';
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  /** Báo nối kênh THÀNH CÔNG sau khi quay về từ nền tảng (một dòng, màu chính của màn). */
  const [vuaNoiXong, setVuaNoiXong] = useState('');
  /** Lần tải gần nhất có thất bại không. Dùng để không khoe "mọi thứ tốt" khi chưa có dữ liệu. */
  const [taiThatBai, setTaiThatBai] = useState(false);
  const [syncing, setSyncing] = useState(false);
  /** Báo việc vừa làm xong. Đổi Trang là việc có hậu quả nên phải nói ra. */
  const [tinBao, setTinBao] = useState('');
  /** Mọi trang bán hàng của tài khoản, KỂ CẢ trang chưa có kênh (bộ chọn bộ não chỉ thấy trang có kênh). */
  const [dsTrangToi, setDsTrangToi] = useState<TrangChon[]>([]);

  /** Lưới cổng kết nối — "Tạo cửa hàng mới" xong thì cuộn tới đây. */
  const luoiKenhRef = useRef<HTMLDivElement>(null);
  /** Lỗi do lần tải danh sách gần nhất gây ra — để tải lại thành công thì chỉ xoá đúng lỗi đó. */
  const loiTaiRef = useRef('');
  const load = useCallback(async () => {
    try {
      const [platforms, accountList, trangList] = await Promise.all([
        api.connections.platforms(),
        api.connections.accounts(),
        api.connections.dsTrang(),
      ]);
      setCatalog(platforms.data);
      setAccounts(accountList.data);
      setDsTrangToi(trangList.data);
      setTaiThatBai(false);
      /*
       * Chỉ xoá lỗi do CHÍNH lần tải trước gây ra. Bản cũ xoá mọi lỗi → quay về từ trang cấp quyền với "connect=error"
       * (khách huỷ cấp quyền) thì câu báo vừa đặt bị lần tải lúc mở trang xoá mất, màn hình im lặng (rà 17/10/2026).
       */
      setErrorMessage((cu) => (cu && cu === loiTaiRef.current ? '' : cu));
      loiTaiRef.current = '';
    } catch (error) {
      setTaiThatBai(true);
      const loi = error instanceof ApiError ? error.message : 'Không tải được danh sách kênh';
      loiTaiRef.current = loi;
      setErrorMessage(loi);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Kéo lại danh sách tài khoản từ Zernio rồi làm mới màn hình. */
  const handleSync = async () => {
    setSyncing(true);
    setErrorMessage('');
    try {
      await api.connections.sync();
      await load();
      await reloadActivePages();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Đồng bộ thất bại');
    } finally {
      setSyncing(false);
    }
  };


  /*
   * ĐẶT TÊN TRANG BÁN HÀNG + CHUYỂN KÊNH SANG TRANG KHÁC (chủ dự án duyệt 12/10/2026).
   * Trang tự lấy tên kênh đầu tiên → đổi Fanpage xong trang cũ mang tên Fanpage cũ, trang mới trùng chữ với kênh;
   * Instagram / TikTok kẹt ở trang cũ. Chủ shop tự gõ tên, tự chọn trang cho kênh — app không tự đoán.
   */
  const [loiHopThoai, setLoiHopThoai] = useState('');
  const doiTenTrang = async (id: number, tenCu: string) => {
    const ten = await hoiNhap({
      tieuDe: 'Đặt tên cửa hàng',
      noiDung: 'Tên cửa hàng của bạn — chỉ hiện trong app, không đổi tên Fanpage hay tài khoản trên mạng xã hội.',
      nhan: 'Tên cửa hàng',
      macDinh: tenCu,
      goiY: 'Ví dụ: Shop tư vấn tài chính',
      nutDongY: 'Lưu tên',
      bieuTuong: 'edit',
      kiemTra: (v) => (!v.trim() ? 'Chưa nhập tên' : v.trim().length > 80 ? 'Tối đa 80 ký tự' : null),
    });
    if (ten === null || ten.trim() === tenCu) return;
    setErrorMessage('');
    try {
      const kq = await api.connections.doiTenTrang(id, ten.trim());
      setTinBao(kq.message ?? 'Đã đổi tên cửa hàng.');
      await load();
      await reloadActivePages();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không đổi được tên cửa hàng');
    }
  };

  const [chuyenKenh, setChuyenKenh] = useState<{ id: string; ten: string; nenTang: string; platform: string; trangId: number | null } | null>(null);
  const [trangChonChuyen, setTrangChonChuyen] = useState<number | null>(null);
  const [dangChuyen, setDangChuyen] = useState(false);
  const moChuyenKenh = (a: SocialAccount, nenTang: string) => {
    setChuyenKenh({ id: a.id, ten: a.display_name || a.username, nenTang, platform: a.platform, trangId: a.trang_id ?? null });
    setTrangChonChuyen(null);
    setLoiHopThoai('');
  };
  /** Tạo trang mới ngay trong hộp chọn trang rồi chọn luôn trang đó. */
  const taoTrangRoiChon = async (ten: string, chon: (id: number) => void) => {
    try {
      const kq = await api.connections.taoTrang(ten);
      setDsTrangToi((await api.connections.dsTrang()).data);
      chon(kq.data.id);
    } catch (error) {
      throw new Error(error instanceof ApiError ? error.message : 'Không tạo được cửa hàng');
    }
  };
  /** Kênh này có phải chọn trang bán hàng khi nối không (Facebook: Fanpage tự thành trang; quảng cáo: dùng chung). */
  // Mọi kênh — KỂ CẢ Facebook — vào đúng một cửa hàng (mỗi cửa hàng một Fanpage, chủ dự án 17/10/2026); chỉ tài khoản
  // quảng cáo dùng chung. Phải KHỚP điều kiện canChonTrang bên máy chủ (connect-url) — lệch là gửi thiếu cửa hàng (đã xảy ra).
  // H11: quảng cáo Meta nay cũng vào đúng một cửa hàng (A4b) — khớp laQuangCao bên máy chủ.
  const canChonTrang = (p: Platform | null) =>
    !!p && (p.id === 'fb_ads' || !catalog.ads.some((c) => c.id === p.id));
  const [trangChonNoi, setTrangChonNoi] = useState<number | null>(null);
  /** "Nối lại" một kênh đang có: đi vào đúng hồ sơ của kênh, giữ nguyên trang — KHÔNG hỏi chọn trang. */
  const [noiLaiKenh, setNoiLaiKenh] = useState<SocialAccount | null>(null);
  /** Có phải chọn trang ở hộp đang mở không (nối mới kênh không phải Facebook / quảng cáo). */
  const phaiChonTrang = () => canChonTrang(selectedPlatform) && !noiLaiKenh;
  /**
   * Khối "kết nối vào cửa hàng X" — cửa hàng đã chọn ở lưới cổng kết nối (chủ dự án 17/10/2026: tạo / chọn cửa hàng
   * trước, rồi mới tới các cổng Facebook, TikTok…). Không còn hỏi chọn cửa hàng trong hộp nối nữa.
   */
  const tenCuaHangNoi = dsTrangToi.find((t) => t.id === trangChonNoi)?.ten;
  const khoiCuaHangNoi = tenCuaHangNoi ? (
    <div className="mb-6 flex items-start gap-2.5 p-3 rounded-lg border border-thong-tin/40 bg-thong-tin/10">
      <span className="material-symbols-outlined text-thong-tin text-[20px] shrink-0">storefront</span>
      <p className="text-sm text-on-surface leading-relaxed">
        {selectedPlatform?.id === 'fb_ads'
          ? <>Kết nối vào cửa hàng <b>{tenCuaHangNoi}</b> — đẩy bài và số liệu quảng cáo của cửa hàng này chạy qua tài khoản quảng cáo này.</>
          : <>Kết nối vào cửa hàng <b>{tenCuaHangNoi}</b> — bộ não AI của cửa hàng này sẽ trả lời khách và đăng bài trên kênh.</>}
      </p>
    </div>
  ) : null;
  /** Khối báo "đang nối lại, giữ trang X" — thay cho khối chọn trang khi nối lại. */
  const khoiNoiLai = noiLaiKenh ? (
    <div className="mb-6 flex items-start gap-2.5 p-3 rounded-lg border border-thong-tin/40 bg-thong-tin/10">
      <span className="material-symbols-outlined text-thong-tin text-[20px] shrink-0">sync</span>
      <p className="text-sm text-on-surface leading-relaxed">
        Nối lại <b>{noiLaiKenh.display_name || noiLaiKenh.username}</b> — làm mới quyền cho chính kênh này
        {noiLaiKenh.trang_ten ? <>, giữ nguyên cửa hàng <b>{noiLaiKenh.trang_ten}</b></> : null}.
      </p>
    </div>
  ) : null;

  /** Telegram: mã thật đang chờ bot xác nhận (null = chưa lấy). */
  const [maTg, setMaTg] = useState<{ code: string; expiresAt: string; botUsername: string } | null>(null);
  const [tgTrangThai, setTgTrangThai] = useState<'pending' | 'expired'>('pending');
  const [dangLayMa, setDangLayMa] = useState(false);
  const layMaTg = async () => {
    if (!trangChonNoi && !noiLaiKenh) return;
    setDangLayMa(true);
    setErrorMessage('');
    try {
      const { data } = await api.connections.layMaTelegram(trangChonNoi, noiLaiKenh?.id);
      setMaTg(data);
      setTgTrangThai('pending');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không lấy được mã kết nối');
    } finally {
      setDangLayMa(false);
    }
  };
  /** Nối xong một kênh không qua đăng nhập (Telegram / Bluesky): đóng hộp, tải lại, báo thành công. */
  const noiXongKhongDangNhap = async (thongBao: string) => {
    setConnectStep(0);
    setMaTg(null);
    setVuaNoiXong(thongBao);
    setCuaHangVuaNoi(trangChonNoi);
    await load();
    await reloadActivePages();
  };
  // Dò mỗi 3 giây (tài liệu nhà cung cấp khuyên 3 giây) cho tới khi bot xác nhận hoặc mã hết hạn; đóng hộp là dừng.
  useEffect(() => {
    if (!maTg || tgTrangThai !== 'pending' || connectStep !== 2) return;
    const nhip = window.setInterval(async () => {
      try {
        const { data } = await api.connections.trangThaiTelegram(maTg.code);
        if (data.status === 'connected') {
          window.clearInterval(nhip);
          await noiXongKhongDangNhap('Đã kết nối Telegram. AI bắt đầu làm việc trên kênh này.');
        } else if (data.status === 'expired') {
          setTgTrangThai('expired');
        }
      } catch { /* mất mạng một nhịp: nhịp sau dò tiếp */ }
    }, 3000);
    return () => window.clearInterval(nhip);
  }, [maTg, tgTrangThai, connectStep]);

  /** Lưu ý + hướng dẫn của nền tảng đang nối — dùng chung cho các khối nối (cùng kiểu với khối đăng nhập). */
  const canhBaoNenTang = selectedPlatform?.warnings && selectedPlatform.warnings.length > 0 ? (
    <div className="bg-thong-tin/10 border border-thong-tin/30 rounded-xl p-4 mb-6">
      <h3 className="font-bold text-thong-tin mb-2 flex items-center gap-2 text-sm">
        <span className="material-symbols-outlined text-[18px]">info</span>
        LƯU Ý / HẠN CHẾ
      </h3>
      <ul className="list-disc list-inside text-sm text-on-surface space-y-1.5 leading-relaxed">
        {selectedPlatform.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  ) : null;
  const huongDanNenTang = selectedPlatform?.instructions && selectedPlatform.instructions.length > 0 ? (
    <div className="space-y-4 mb-6">
      <h3 className="tieu-de-muc mb-4">HƯỚNG DẪN KẾT NỐI</h3>
      {selectedPlatform.instructions.map((inst: string, idx: number) => (
        <div key={idx} className="flex gap-4">
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">{idx + 1}</div>
          <div className="pt-0.5 text-sm font-medium text-on-surface leading-relaxed">{inst}</div>
        </div>
      ))}
    </div>
  ) : null;

  /** Bluesky: tên tài khoản + mật khẩu ứng dụng — mật khẩu chỉ giữ trong ô nhập, gửi một lần rồi xoá. */
  const [bsTen, setBsTen] = useState('');
  const [bsMatKhau, setBsMatKhau] = useState('');
  const [dangNoiBs, setDangNoiBs] = useState(false);
  const noiBluesky = async () => {
    if (!trangChonNoi && !noiLaiKenh) return;
    setDangNoiBs(true);
    setErrorMessage('');
    try {
      const kq = await api.connections.noiBluesky(trangChonNoi, bsTen.trim(), bsMatKhau.trim(), noiLaiKenh?.id);
      setBsMatKhau('');
      await noiXongKhongDangNhap(kq.message ?? 'Đã kết nối Bluesky.');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được Bluesky');
    } finally {
      setDangNoiBs(false);
    }
  };
  const chuyenSangTrang = async (trangId: number, tenTrang: string) => {
    if (!chuyenKenh) return;
    // Nói trước những gì cửa hàng cũ để lại / mất trên kênh này ("kênh là nhân viên — ra đi tay trắng", đợt 3).
    let hauQua = '';
    try {
      const { data: hq } = await api.connections.hauQuaChuyenKenh(chuyenKenh.id);
      const dong = [
        hq.hoiThoaiOLai > 0 && `• ${hq.hoiThoaiOLai} hội thoại ở lại cửa hàng cũ (chỉ xem lịch sử, không trả lời qua kênh này nữa).`,
        hq.baiHenGio > 0 && `• ${hq.baiHenGio} bài hẹn giờ của cửa hàng cũ sẽ bị gỡ lịch trên kênh này.`,
        hq.baiChuaDang > 0 && `• ${hq.baiChuaDang} bài chưa đăng (nháp / chờ duyệt / lỗi) của cửa hàng cũ sẽ không đăng được qua kênh này nữa.`,
        hq.kichBanSeTat > 0 && `• ${hq.kichBanSeTat} kịch bản bình luận của cửa hàng cũ trên kênh này sẽ tắt — kênh quay về thì bạn tự bật lại.`,
        '• Quảng cáo của cửa hàng cũ trên kênh này không tự dừng — vui lòng kiểm tra ở mục Quảng cáo.',
      ].filter(Boolean);
      hauQua = `Cửa hàng cũ:\n${dong.join('\n')}\n\n`;
    } catch (error) {
      setLoiHopThoai(error instanceof ApiError ? error.message : 'Không đọc được những gì sẽ thay đổi khi chuyển kênh');
      return;
    }
    if (!(await hoiXacNhan({
      tieuDe: `Chuyển ${chuyenKenh.nenTang} "${chuyenKenh.ten}" sang cửa hàng "${tenTrang}"?`,
      noiDung:
        `Từ giờ bộ não AI của cửa hàng "${tenTrang}" (vai trò, bảng giá, kịch bản) sẽ trả lời khách và đăng bài trên kênh này. ` +
        `Khách, hội thoại, đơn và bài cũ ở lại cửa hàng cũ.\n\n` +
        hauQua +
        `Tiền kênh hôm nay vẫn tính cho cửa hàng cũ, từ ngày mai tính cho cửa hàng mới.`,
      nutDongY: 'Chuyển kênh',
      bieuTuong: 'move_down',
    }))) return;
    setDangChuyen(true);
    setLoiHopThoai('');
    try {
      const kq = await api.connections.chuyenKenhSangTrang(chuyenKenh.id, trangId);
      setTinBao(kq.message ?? 'Đã chuyển kênh.');
      setChuyenKenh(null);
      await load();
      await reloadActivePages();
    } catch (error) {
      setLoiHopThoai(error instanceof ApiError ? error.message : 'Không chuyển được kênh');
    } finally {
      setDangChuyen(false);
    }
  };

  /** Xoá trang bán hàng KHÔNG còn kênh — hỏi lại, nói rõ mất những gì (máy chủ chặn lần nữa). */
  const xoaTrang = async (id: number, ten: string) => {
    if (!(await hoiXacNhan({
      tieuDe: `Xoá cửa hàng "${ten}"?`,
      noiDung:
        'Xoá vĩnh viễn bộ não AI của cửa hàng này: vai trò, tài liệu, kịch bản, video và thư viện ảnh của cửa hàng.\n\n' +
        'Các kênh đã mất kết nối còn nằm trong cửa hàng cũng bị gỡ hẳn khỏi nền tảng (muốn dùng lại thì nối lại từ đầu).\n\n' +
        'Đơn hàng cũ vẫn giữ nhưng không còn gắn với cửa hàng. Không lấy lại được.',
      nutDongY: 'Xoá cửa hàng',
      nguyHiem: true,
      bieuTuong: 'delete',
    }))) return;
    setErrorMessage('');
    try {
      const kq = await api.connections.xoaTrang(id);
      setTinBao(kq.message ?? 'Đã xoá cửa hàng.');
      await load();
      await reloadActivePages();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không xoá được cửa hàng');
    }
  };

  const handleDisconnectPage = async (accountId: string) => {
    // Hỏi đúng KÊNH nào (bản cũ hỏi "trang này" — chữ "trang" đã dành cho trang bán hàng) và nói rõ hậu quả.
    const kenh = accounts.find((a) => a.id === accountId);
    const tenNenTang = allPlatforms.find((c) => c.platformKey === kenh?.platform)?.name ?? kenh?.platform ?? 'kênh';
    // Ngắt kết nối = kênh "nghỉ việc" (064): nói trước đúng những gì sẽ thay đổi, đọc từ máy chủ như hộp chuyển kênh.
    let hauQua = '';
    try {
      const { data: hq } = await api.connections.hauQuaChuyenKenh(accountId);
      hauQua = [
        hq.hoiThoaiOLai > 0 && `• ${hq.hoiThoaiOLai} hội thoại cũ chỉ còn xem lịch sử, không trả lời qua kênh này nữa.`,
        hq.kichBanSeTat > 0 && `• ${hq.kichBanSeTat} kịch bản bình luận trên kênh này sẽ tắt.`,
        hq.baiHenGio > 0 && `• ${hq.baiHenGio} bài hẹn giờ trên kênh này sẽ bị gỡ lịch — vui lòng hẹn lại cho kênh khác.`,
      ].filter(Boolean).join('\n');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không đọc được những gì sẽ thay đổi khi ngắt kết nối');
      return;
    }
    if (!(await hoiXacNhan({
      tieuDe: `Ngắt kết nối ${tenNenTang} "${kenh?.display_name || kenh?.username || ''}"?`,
      noiDung:
        'AI ngừng trả lời khách và đăng bài trên kênh này, kênh rời cửa hàng. Đơn hàng cũ vẫn được giữ.\n\n' +
        (hauQua ? `${hauQua}\n\n` : '') +
        'Kết nối lại sau này là bắt đầu lại từ đầu: kịch bản phải bật lại, hội thoại mới tách khỏi hội thoại cũ.',
      nutDongY: 'Ngắt kết nối',
      nguyHiem: true,
    }))) return;
    try {
      await api.connections.disconnect(accountId);
      await load();
      await reloadActivePages();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không ngắt kết nối được');
    }
  };

  const allPlatforms = [...catalog.social, ...catalog.ads, ...catalog.communication];
  /** Kênh đang mở chi tiết (quyền + thao tác) trong bảng kênh. */
  const [kenhMo, setKenhMo] = useState<string | null>(null);
  /** Bảng trang & kênh — bấm ô "đã kết nối" ở lưới nền tảng thì cuộn tới đây và mở đúng trang. */
  const bangTrangRef = useRef<HTMLDivElement>(null);
  /*
   * Kênh của TRANG đang mở (bảng "Tài khoản đã kết nối"); đang "Tất cả trang" thì mọi kênh. Tài khoản quảng cáo Meta
   * không gắn trang nào nên luôn hiện. Tình trạng chung và lưới cổng kết nối vẫn tính trên mọi kênh của tài khoản.
   */
  const kenhCuaTrang = trangDangChon
    ? accounts.filter((a) => (a.platform === 'metaads' && a.trang_id == null)
      || (trangDangChon.id != null ? a.trang_id === trangDangChon.id : trangDangChon.kenh.some((k) => k.id === a.id)))
    : accounts;
  const soKenhHong = accounts.filter((a) => a.needs_reconnection || !a.connected).length;
  const connectedPlatformCount = allPlatforms.filter((c) => c.connected).length;
  const connectablePlatformCount = allPlatforms.filter((c) => c.connectable).length;
  const activePageCount = accounts.filter((a) => a.connected && a.platform !== 'metaads').length;

  /*
   * Trạng thái sức khoẻ chung — CHỈ tín hiệu thật (chủ dự án 12/10/2026, đã nghiên cứu):
   * danger = có kênh mất kết nối (nền tảng báo, máy chủ kiểm 30 phút/lần); warning = có trang chưa có kênh (AI của
   * trang đó không làm việc được). Bỏ "sắp hết hạn" tự suy từ token_expires_at: đó là hạn mã nội bộ, nhà cung cấp tự
   * gia hạn (TikTok 24 giờ, FB/IG 60 ngày) — đo thật TikTok luôn "còn 1 ngày" mà vẫn chạy, nhà cung cấp báo "healthy".
   */
  const trangChuaCoKenh = dsTrangToi.filter((t) => t.soKenh === 0);
  const bannerState: 'normal' | 'warning' | 'danger' =
    soKenhHong > 0 ? 'danger' : trangChuaCoKenh.length > 0 ? 'warning' : 'normal';

  /*
   * CỬA HÀNG ĐANG NỐI KÊNH (chủ dự án chốt 17/10/2026): mỗi cửa hàng là một hộp, mỗi nền tảng một ngăn. Lưới cổng kết nối
   * chạy THEO cửa hàng đang chọn — ô "Đã kết nối" là ngăn của cửa hàng ĐÓ đã có, không phải "tài khoản có ở đâu đó".
   * Chỉ có một cửa hàng thì hiện luôn cửa hàng đó; nhiều cửa hàng thì chủ shop bấm chọn (không đoán thay).
   */
  const [cuaHangNoi, setCuaHangNoi] = useState<number | null>(null);
  useEffect(() => {
    if (dsTrangToi.length === 1) setCuaHangNoi(dsTrangToi[0].id);
    else setCuaHangNoi((cu) => (cu != null && dsTrangToi.some((t) => t.id === cu) ? cu : null));
  }, [dsTrangToi]);
  const chDangNoi = dsTrangToi.find((t) => t.id === cuaHangNoi) ?? null;
  /** Ô của nền tảng (không phải quảng cáo dùng chung) "đã kết nối" = ngăn đó của cửa hàng đang chọn đã có. */
  const theoCuaHang = (ds: Platform[]) =>
    ds.map((c) => ({ ...c, connected: !!chDangNoi && !!c.platformKey && chDangNoi.nenTang.includes(c.platformKey) }));
  const liveSocialChannels = theoCuaHang(catalog.social);
  // H11: ô Meta Ads cũng theo cửa hàng đang chọn; cửa hàng chưa có Fanpage → chưa nối được (đẩy bài cần Fanpage).
  const liveAdChannels = theoCuaHang(catalog.ads).map((c) =>
    c.id === 'fb_ads' && !c.connected && chDangNoi && !chDangNoi.nenTang.includes('facebook')
      ? { ...c, connectable: false, capabilityNote: 'Cửa hàng này chưa nối Fanpage. Vui lòng nối Fanpage trước, rồi mới nối quảng cáo.' }
      : c);
  const adChannelIds = new Set(catalog.ads.map((c) => c.id));
  const liveCommChannels = theoCuaHang(catalog.communication);

  /*
   * TẠO CỬA HÀNG + HƯỚNG DẪN NỐI KÊNH LẦN LƯỢT (chủ dự án 17/10/2026):
   *  - Hộp chỉ để ĐẶT TÊN; xong là đưa xuống LƯỚI "Kết nối kênh cho cửa hàng" có sẵn trên màn (không dựng lưới thứ hai
   *    trong hộp — "trùng nhau rồi thừa cho rối").
   *  - Cả lưới sáng viền + mũi tên chỉ xuống; chủ shop TỰ CHỌN bất kỳ mạng nào, nối xong ô đó sáng ✓, mũi tên vẫn
   *    chỉ để nối tiếp; bấm "Xong, không nối thêm" mới tắt ("chọn cả bảng thích chọn gì thì chọn").
   *  - Đăng nhập nền tảng làm TẢI LẠI trang → hướng dẫn giữ trong sessionStorage, tải lại thì chọn lại đúng cửa hàng đó.
   */
  const [taoCH, setTaoCH] = useState<{ ten: string } | null>(null);
  const [dangTaoCH, setDangTaoCH] = useState(false);
  const [loiTaoCH, setLoiTaoCH] = useState('');
  /** Cửa hàng vừa nối xong một kênh — băng báo đưa bước tiếp theo. */
  const [cuaHangVuaNoi, setCuaHangVuaNoi] = useState<number | null>(null);
  const [huongDan, setHuongDanTho] = useState<{ trangId: number } | null>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(KHOA_HUONG_DAN) ?? 'null');
      return d && typeof d.trangId === 'number' ? { trangId: d.trangId } : null;
    } catch { return null; }
  });
  const setHuongDan = (v: { trangId: number } | null) => {
    setHuongDanTho(v);
    try { if (v) sessionStorage.setItem(KHOA_HUONG_DAN, JSON.stringify(v)); else sessionStorage.removeItem(KHOA_HUONG_DAN); } catch { /* chặn lưu tạm: vẫn chạy trong phiên */ }
  };
  /** Bắt đầu hướng dẫn nối lần lượt cho một cửa hàng: chọn nó ở lưới và cuộn tới lưới. */
  const batDauHuongDan = (id: number) => {
    setHuongDan({ trangId: id });
    setCuaHangNoi(id);
    setTimeout(() => luoiKenhRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const moTaoCuaHang = () => { setLoiTaoCH(''); setTaoCH({ ten: '' }); };
  const xacNhanTenCuaHang = async () => {
    if (!taoCH || !taoCH.ten.trim()) return;
    setDangTaoCH(true);
    setLoiTaoCH('');
    try {
      const kq = await api.connections.taoTrang(taoCH.ten.trim());
      await load();
      setTaoCH(null);
      setTinBao(`Đã tạo cửa hàng "${kq.data.ten}". Chọn mạng xã hội muốn nối cho cửa hàng này ở lưới bên dưới — nối được nhiều kênh.`);
      batDauHuongDan(kq.data.id);
    } catch (error) {
      setLoiTaoCH(error instanceof ApiError ? error.message : 'Không tạo được cửa hàng');
    } finally {
      setDangTaoCH(false);
    }
  };
  /** Cửa hàng đang được hướng dẫn nối kênh; lưới đang hiện đúng cửa hàng đó thì sáng viền + mũi tên. */
  useEffect(() => {
    if (!huongDan || dsTrangToi.length === 0) return;
    // Tải lại trang (đăng nhập nền tảng xong) thì ô chọn cửa hàng về trống — chọn lại cửa hàng đang hướng dẫn.
    if (dsTrangToi.some((t) => t.id === huongDan.trangId)) setCuaHangNoi((cu) => cu ?? huongDan.trangId);
    else setHuongDan(null); // cửa hàng đã bị xoá
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsTrangToi, huongDan]);
  const chHuongDan = huongDan ? dsTrangToi.find((t) => t.id === huongDan.trangId) ?? null : null;
  const dangHuongDan = !!chHuongDan && cuaHangNoi === chHuongDan.id;
  /** Mở bộ não (4 AI) của một cửa hàng — bước sau khi đã có kênh. */
  const moBoNaoCuaHang = (id: number) => {
    chonTrang(`t${id}`);
    navigate('/');
  };

  /**
   * Danh sách cho bước chọn Trang.
   *
   * Sau khi cấp quyền, đây là các Trang Facebook trả về mà khách CHƯA kết nối —
   * chọn xong mới tạo kênh. Facebook chỉ trả id/tên/hạng mục ở bước này, chưa
   * có ảnh đại diện hay số người theo dõi, nên hai ô đó để trống thay vì bịa số.
   *
   * Khi không có phiên chọn nào đang chờ thì quay về hiển thị các kênh đã nối,
   * để màn hình vẫn dùng được cho việc xem lại.
   */
  const newlyConnectedPages = pagesToSelect.length > 0
    ? pagesToSelect.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: null as string | null,
        // Facebook chưa trả số người theo dõi ở bước này, nên hiện hạng mục
        // Trang — thông tin thật và đủ để khách nhận ra đúng Trang của mình.
        subtitle: p.category ?? 'Fanpage Facebook',
        connected: accounts.some((a) => a.connected && a.display_name === p.name),
      }))
    : (selectedPlatform?.platformKey
        ? accounts.filter((a) => a.platform === selectedPlatform.platformKey)
        : []
      ).map((a) => ({
        id: a.id,
        name: a.display_name || a.username,
        avatar: a.profile_picture ?? null,
        subtitle: a.followers_count != null
          ? `${a.followers_count.toLocaleString('vi-VN')} người theo dõi`
          : 'Fanpage Facebook',
        connected: a.connected,
      }));


  const [timKenh, setTimKenh] = useState('');
  const handleOpenConnect = (platform?: Platform, noiLai?: SocialAccount, trangId?: number) => {
    setErrorMessage('');
    if (platform) {
      setSelectedPlatform(platform);
      setTrangChonNoi(trangId ?? cuaHangNoi); // cửa hàng chủ shop đã chọn (hộp dẫn đường / lưới) — không đoán thay
      setNoiLaiKenh(noiLai ?? null);
      setMaTg(null);
      setBsTen(noiLai?.platform === 'bluesky' ? noiLai.username : '');
      setBsMatKhau('');
      setConnectStep(2);
    } else {
      // Chưa chọn nền tảng: đưa tới lưới cổng kết nối (không còn hộp chọn nền tảng trùng).
      luoiKenhRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setLoginSuccess(false);
    setSelectedPages([]);
  };

  /**
   * Mở luồng cấp quyền THẬT của nền tảng.
   *
   * Chuyển thẳng trang, KHÔNG mở cửa sổ con.
   *
   * Bản trước dùng window.open. Chủ shop báo "không thấy cửa sổ nào hiện ra":
   * trình duyệt chặn im lặng và vẫn trả về một đối tượng, nên mã tưởng đã mở
   * rồi ngồi chờ một cửa sổ không tồn tại — màn hình quay vô tận.
   *
   * Chuyển thẳng trang thì không có gì để chặn. Cấp quyền xong Zernio đưa
   * trình duyệt về /ket-noi?connect=select, và màn hình này tự mở lại đúng
   * bước chọn Trang nhờ dữ liệu đã cất ở máy chủ.
   */
  const handleStartOAuth = async () => {
    if (!selectedPlatform) return;
    if (!selectedPlatform.connectable) {
      setErrorMessage(selectedPlatform.capabilityNote ?? 'Kênh này chưa kết nối được.');
      return;
    }

    if (phaiChonTrang() && !trangChonNoi) {
      setErrorMessage('Chọn cửa hàng cho kênh này trước khi đăng nhập.');
      return;
    }

    setIsLoggingIn(true);
    setErrorMessage('');

    try {
      const { url, daNoi, choDongBo } = await api.connections.connectUrl(
        selectedPlatform.platformKey!,
        phaiChonTrang() ? trangChonNoi ?? undefined : undefined,
        noiLaiKenh?.id
      );
      // H11: quảng cáo Meta nối ngay (tài khoản Facebook đã có quyền quảng cáo) — không chuyển trang, kéo kênh về rồi báo.
      if (daNoi || !url) {
        const ketQua = await api.connections.sync();
        setAccounts(ketQua.data);
        await load();
        await reloadActivePages();
        setIsLoggingIn(false);
        setConnectStep(0);
        setVuaNoiXong(choDongBo
          ? 'Đã nối quảng cáo Meta. Đang đồng bộ tài khoản quảng cáo, vui lòng chờ một lát rồi bấm Đồng bộ.'
          : `Đã nối quảng cáo Meta${tenCuaHangNoi ? ` cho cửa hàng ${tenCuaHangNoi}` : ''}. Đẩy bài và số liệu quảng cáo của cửa hàng này chạy qua tài khoản này.`);
        return;
      }
      /*
       * Nhớ đang nối nền tảng nào (trang sẽ tải lại hẳn khi quay về). Quay về mà không có kênh mới thì báo rõ — đã xảy
       * ra 12/10/2026: chủ dự án nối YouTube, lượt quay về rơi đúng lúc máy chủ mất kết nối cơ sở dữ liệu, màn hình
       * im lặng, không kênh, không câu báo nào.
       */
      try {
        sessionStorage.setItem(KHOA_DANG_NOI, JSON.stringify({
          platformKey: selectedPlatform.platformKey, ten: selectedPlatform.name, luc: Date.now(),
          truoc: accounts.filter((a) => a.platform === selectedPlatform.platformKey).length,
          noiLai: noiLaiKenh?.id,
          trangId: trangChonNoi,
        }));
      } catch { /* trình duyệt chặn lưu tạm: vẫn nối được, chỉ không có câu báo đối chiếu */ }
      window.location.href = url;
    } catch (error) {
      setIsLoggingIn(false);
      setErrorMessage(error instanceof ApiError ? error.message : 'Không lấy được liên kết cấp quyền');
    }
  };

  /**
   * Một lần kiểm tra: đã cấp quyền xong chưa?
   *
   * Hỏi bảng tạm của chính mình, không gọi Zernio — nên dò dày cũng không đụng
   * vào hạn mức 60 lượt/phút dùng chung với bot trả lời khách. Chỉ khi thật sự
   * có phiên đang chờ thì máy chủ mới hỏi Facebook một lần để lấy danh sách.
   */
  const checkForPendingSelection = async (): Promise<boolean> => {
    const { data } = await api.connections.pendingSelection();
    if (data.waiting || data.pages.length === 0) return false;

    // Dựng lại nền tảng đang kết nối. Thiếu bước này thì khối bước 3 không có
    // gì để vẽ và hộp thoại hiện ra trắng trơn.
    const channel = [...catalog.social, ...catalog.ads, ...catalog.communication]
      .find((c) => c.platformKey === data.platform);
    if (channel) setSelectedPlatform(channel);

    setPagesToSelect(data.pages);
    setSelectedPages([]);
    setLoginSuccess(true);
    setConnectStep(3);
    return true;
  };

  /** Khách tự bấm khi đã cấp quyền xong, không phải ngồi chờ hết nhịp. */
  const handleCheckNow = async () => {
    setErrorMessage('');
    try {
      const found = await checkForPendingSelection();
      if (found) {
        setIsLoggingIn(false);
      } else {
        setErrorMessage(
          'Chưa nhận được kết quả cấp quyền. Vui lòng kiểm tra lại xem bạn đã cấp quyền cho ' +
            'Fanpage trong cửa sổ Facebook, rồi bấm kiểm tra lại.'
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kiểm tra được');
    }
  };

  /**
   * Chốt các Trang khách đã chọn — bước thật sự tạo kênh trên Zernio.
   */
  const handleConfirmPages = async () => {
    if (selectedPages.length === 0) return;
    setIsLoggingIn(true);
    setErrorMessage('');
    try {
      const { data } = await api.connections.selectPages(selectedPages);
      setKenhVuaNoi(data.connected);
      // Kéo kênh vừa tạo về database của mình rồi mới sang bước cuối.
      const result = await api.connections.sync();
      setAccounts(result.data);
      await load();
      await reloadActivePages();
      setPagesToSelect([]);

      if (data.failed.length > 0) {
        setErrorMessage(
          `Có ${data.failed.length} Fanpage không kết nối được: ${data.failed[0].error}`
        );
      }
      setConnectStep(4);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được Fanpage đã chọn');
    } finally {
      setIsLoggingIn(false);
    }
  };

  /*
   * Ghi nhận việc vừa quay về từ Facebook.
   *
   * Chỉ ĐỌC tín hiệu rồi cất vào state, chưa xử lý gì. Lý do: lúc này danh mục
   * kênh chưa tải xong, mà bước chọn Trang cần biết đang kết nối nền tảng nào
   * mới vẽ được. Bản trước xử lý luôn tại đây nên dựng lại nền tảng thất bại và
   * hộp thoại hiện ra RỖNG — đúng thứ chủ shop gặp.
   */
  const [vuaQuayVe, setVuaQuayVe] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ket_qua = params.get('connect');
    if (!ket_qua) return;

    window.history.replaceState({}, '', '/ket-noi');

    if (ket_qua === 'error') {
      docDangNoi();
      setErrorMessage(params.get('message') ?? 'Cấp quyền chưa hoàn tất. Vui lòng thử lại.');
      return;
    }
    // H11: nối xong phía nhà cung cấp, kênh quảng cáo chưa về kịp — báo chờ (không phải lỗi), bỏ phép đối chiếu số kênh.
    if (ket_qua === 'cho-dong-bo') {
      docDangNoi();
      setVuaNoiXong(params.get('message') ?? 'Đang đồng bộ, vui lòng chờ một lát rồi bấm Đồng bộ.');
      return;
    }
    setVuaQuayVe(ket_qua);
  }, []);

  /*
   * Xử lý thật, chỉ chạy khi danh mục kênh đã có.
   */
  useEffect(() => {
    if (vuaQuayVe !== 'select') return;
    const daTaiDanhMuc = catalog.social.length > 0;
    if (!daTaiDanhMuc) return;

    setVuaQuayVe(null);

    (async () => {
      try {
        const { data } = await api.connections.pendingSelection();

        // Không cần chọn gì thêm: kênh đã được tạo, chỉ việc kéo về — rồi ĐỐI CHIẾU có kênh mới thật không.
        if (data.waiting || data.pages.length === 0) {
          const result = await api.connections.sync();
          setAccounts(result.data);
          await load();
          await reloadActivePages();
          const dangNoi = docDangNoi();
          if (dangNoi) {
            const sau = result.data.filter((a) => a.platform === dangNoi.platformKey).length;
            // Nối lại: số kênh không đổi — thành công là chính kênh đó đã hoạt động lại (không còn "cần nối lại").
            const kenhNoiLai = dangNoi.noiLai ? result.data.find((a) => a.id === dangNoi.noiLai) : null;
            if (dangNoi.noiLai) {
              if (kenhNoiLai?.connected && !kenhNoiLai.needs_reconnection) {
                setVuaNoiXong(`Đã nối lại ${dangNoi.ten} ${kenhNoiLai.display_name || kenhNoiLai.username}. AI làm việc lại trên kênh này.`);
              } else {
                setErrorMessage(`Chưa nối lại được ${dangNoi.ten} — lượt cấp quyền chưa hoàn tất. Bấm "Nối lại" ở kênh đó để thử lại.`);
              }
            } else if (sau > dangNoi.truoc) {
              setVuaNoiXong(`Đã kết nối ${dangNoi.ten}. AI bắt đầu làm việc trên kênh này.`);
              setCuaHangVuaNoi(dangNoi.trangId ?? null);
            } else {
              setErrorMessage(
                `Chưa thấy kênh ${dangNoi.ten} mới — lượt cấp quyền chưa hoàn tất phía ${dangNoi.ten} (có thể đã đóng ` +
                  `giữa chừng, hoặc mạng bị gián đoạn lúc quay về). Bấm vào ô ${dangNoi.ten} ở khung "Kết nối kênh cho cửa hàng" để nối lại.`
              );
            }
          }
          return;
        }

        const channel = [...catalog.social, ...catalog.ads, ...catalog.communication]
          .find((c) => c.platformKey === data.platform);

        if (!channel) {
          setErrorMessage(
            `Đã cấp quyền xong nhưng hệ thống chưa nhận ra nền tảng "${data.platform}".`
          );
          return;
        }

        setSelectedPlatform(channel);
        setPagesToSelect(data.pages);
        setSelectedPages([]);
        setLoginSuccess(true);
        setConnectStep(3);
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError ? error.message : 'Không lấy được danh sách Fanpage'
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuaQuayVe, catalog]);

  const handleFinishConnection = async () => {
    const dangNoi = docDangNoi();
    // Báo xong + đưa bước tiếp theo (nối thêm kênh / mở bộ não) — không để chủ shop tự mò.
    setVuaNoiXong(`Đã kết nối ${selectedPlatform?.name ?? 'kênh'}. AI bắt đầu làm việc trên kênh này.`);
    setCuaHangVuaNoi(dangNoi?.trangId ?? trangChonNoi);
    await load();
    await reloadActivePages();
    setConnectStep(0);
    setLoginSuccess(false);
    setSelectedPages([]);
    setKenhVuaNoi([]);
  };

  /**
   * Băng thông báo lỗi.
   *
   * Trước đây màn hình này có 20 chỗ đặt thông báo lỗi và KHÔNG chỗ nào hiển
   * thị. Mọi thất bại đều bị nuốt im lặng: khách bấm, không có gì xảy ra, cũng
   * không biết vì sao. Đó là lý do lỗi kết nối trông giống như treo máy.
   */
  const errorBanner = errorMessage ? (
    <div className="flex items-start gap-3 text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3">
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
      <span className="flex-1 leading-relaxed"><b>Lỗi:</b> {errorMessage}</span>
      {taiThatBai && (
        <button
          onClick={() => { setLoading(true); load(); }}
          className="shrink-0 px-3 py-1 rounded-lg border border-error/40 font-bold hover:bg-error/10 transition-colors"
        >
          Thử lại
        </button>
      )}
      <button
        onClick={() => setErrorMessage('')}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        title="Đóng"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  ) : null;

  /** Tài khoản quảng cáo không gắn trang (Meta Ads) — dùng chung mọi trang. */
  const kenhQuangCaoChung = accounts.filter((a) => a.platform === 'metaads' && a.trang_id == null);

  /** MỘT dòng kênh (bấm mở quyền + thao tác) — dùng trong bảng trang (mỗi trang mở ra các kênh của nó) và khung quảng cáo chung. */
  /*
   * Thao tác của MỘT kênh (cột cuối bảng cây): kênh hỏng thì nút "Nối lại" đứng ngoài — việc cần làm ngay; còn lại gom
   * sau dấu ⋯ (hàng nghìn dòng mà dòng nào cũng 3 nút thì rối mắt). Ngắt kết nối vẫn hỏi lại bằng HopHoi.
   */
  const nenTangCua = (p: string) => {
    const c = allPlatforms.find((x) => x.platformKey === p) ?? allPlatforms.find((x) => x.id === 'fb_ads' && p === 'metaads');
    return { icon: c?.icon ?? 'public', ten: c?.name ?? p };
  };
  const thaoTacKenh = (a: SocialAccount) => {
    const kenh = allPlatforms.find((c) => c.platformKey === a.platform)
      ?? allPlatforms.find((c) => c.id === 'fb_ads' && a.platform === 'metaads');
    const hong = a.needs_reconnection || !a.connected;
    const ten = a.display_name || a.username;
    const muc: MucMenu[] = [];
    // Mọi kênh (kể cả Facebook) chuyển được sang cửa hàng khác; "Đổi Fanpage" đã bỏ (chủ dự án 17/10/2026).
    if (a.platform !== 'metaads') muc.push({ ten: 'Chuyển sang cửa hàng khác', onChon: () => moChuyenKenh(a, kenh?.name ?? a.platform) });
    if (kenh && !hong) muc.push({ ten: 'Nối lại', onChon: () => handleOpenConnect(kenh, a) });
    muc.push({ ten: 'Ngắt kết nối', onChon: () => handleDisconnectPage(a.id), nguyHiem: true });
    return (
      <>
        {hong && kenh && (
          <button
            onClick={() => handleOpenConnect(kenh, a)}
            className="h-8 px-3 rounded-lg border border-loi/60 text-loi text-xs font-bold inline-flex items-center gap-1 hover:bg-loi/10 transition"
          >
            Nối lại
          </button>
        )}
        <MenuQuanLyTrang muc={muc} tieuDe={ten} nhan={`Thao tác kênh ${ten}`} />
      </>
    );
  };

  return (
    <main className="p-4 md:p-8 max-w-[1600px] mx-auto w-full relative">

      {errorBanner && <div className="mb-6">{errorBanner}</div>}
      {vuaNoiXong && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/60 bg-primary/10 px-4 py-3 text-sm text-on-surface shadow-[0_0_20px_-8px_var(--color-primary)]">
          <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 font-black">✓</span>
          <span className="flex-1">{vuaNoiXong}</span>
          {/* BƯỚC TIẾP THEO — nối xong không để chủ shop tự mò: nối thêm kênh cho cửa hàng này, hoặc mở bộ não để dạy AI. */}
          {cuaHangVuaNoi != null && dsTrangToi.some((t) => t.id === cuaHangVuaNoi) && huongDan?.trangId !== cuaHangVuaNoi && (
            <span className="flex flex-wrap gap-2 shrink-0">
              <button type="button" onClick={() => { setVuaNoiXong(''); batDauHuongDan(cuaHangVuaNoi); }}
                className="h-8 px-3 rounded-lg border border-primary/60 text-primary text-xs font-bold hover:bg-primary/10">
                + Nối thêm kênh cho "{dsTrangToi.find((t) => t.id === cuaHangVuaNoi)?.ten}"
              </button>
              <button type="button" onClick={() => moBoNaoCuaHang(cuaHangVuaNoi)}
                className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110">
                Mở bộ não của "{dsTrangToi.find((t) => t.id === cuaHangVuaNoi)?.ten}" →
              </button>
            </span>
          )}
          <button type="button" onClick={() => setVuaNoiXong('')} aria-label="Đóng thông báo" className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {tinBao && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-surface-container border border-primary/30">
          <span className="material-symbols-outlined text-primary shrink-0">info</span>
          <span className="flex-1 leading-relaxed text-sm text-on-surface">{tinBao}</span>
          <button onClick={() => setTinBao('')} className="text-on-surface-variant hover:text-on-surface shrink-0" aria-label="Đóng">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}


      {/*
        CHUYỂN KÊNH SANG TRANG BÁN HÀNG KHÁC — nói rõ hậu quả ngay trên hộp (bộ não nào trả lời khách, tiền tính từ
        hôm nào), cùng kiểu dòng trang với bảng "Trang bán hàng và kênh đã nối".
      */}
      {chuyenKenh && (
        <HopThoai
          co="vua"
          bieuTuong="move_down"
          tieuDe="Chuyển kênh sang cửa hàng khác"
          phuDe={<>{chuyenKenh.nenTang} <span className="text-on-surface font-bold">{chuyenKenh.ten}</span>{dsTrangToi.find((t) => t.id === chuyenKenh.trangId) && <> đang thuộc cửa hàng <span className="text-on-surface font-bold">{dsTrangToi.find((t) => t.id === chuyenKenh.trangId)!.ten}</span></>}.</>}
          onDong={() => setChuyenKenh(null)}
          chan={
            <>
              <button type="button" onClick={() => setChuyenKenh(null)} className={NUT_PHU}>
                Huỷ
              </button>
              <button
                type="button"
                disabled={!trangChonChuyen || dangChuyen}
                onClick={() => {
                  const t = dsTrangToi.find((x) => x.id === trangChonChuyen);
                  if (t) chuyenSangTrang(t.id, t.ten);
                }}
                className={NUT_CHINH}
              >
                {dangChuyen ? 'Đang chuyển…' : 'Chuyển kênh'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-thong-tin/40 bg-thong-tin/10">
              <span className="material-symbols-outlined text-thong-tin text-[20px] shrink-0">info</span>
              <p className="text-sm text-on-surface leading-relaxed">
                Kênh thuộc cửa hàng nào thì <span className="font-bold">bộ não AI của cửa hàng đó</span> (vai trò, bảng giá, kịch bản) trả lời khách và đăng bài trên kênh.
                Tiền kênh hôm nay vẫn tính cho cửa hàng cũ, từ ngày mai tính cho cửa hàng mới.
              </p>
            </div>
            {loiHopThoai && <p className="text-sm text-loi">Lỗi: {loiHopThoai}</p>}
            <ChonTrangBanHang
              ds={dsTrangToi}
              platformKey={chuyenKenh.platform}
              tenNenTang={chuyenKenh.nenTang}
              giaTri={trangChonChuyen}
              onChon={setTrangChonChuyen}
              onTaoMoi={(ten) => taoTrangRoiChon(ten, setTrangChonChuyen)}
              boQua={chuyenKenh.trangId}
            />
          </div>
        </HopThoai>
      )}

      {/* TẠO CỬA HÀNG — chỉ đặt tên; xong đưa xuống lưới có sẵn + thanh hướng dẫn nối kênh lần lượt. */}
      {taoCH && (
        <HopThoai
          co="vua"
          bieuTuong="add_business"
          tieuDe="Tạo cửa hàng mới"
          phuDe="Mỗi cửa hàng có một bộ não AI riêng và đựng được 1 Fanpage, 1 TikTok, 1 YouTube… Muốn thêm Fanpage / TikTok thứ hai thì tạo thêm cửa hàng."
          onDong={() => setTaoCH(null)}
          dauPhu={
            <ol className="flex items-center gap-2" aria-label="Các bước tạo cửa hàng">
              {['Đặt tên', 'Chọn mạng xã hội để nối', 'Dạy bộ não AI'].map((ten, i) => (
                <li key={ten} className="flex items-center gap-2 min-w-0">
                  {i > 0 && <span className="h-px w-5 sm:w-10 shrink-0 bg-outline-variant" />}
                  <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border',
                    i === 0 ? 'bg-primary text-on-primary border-primary shadow-[0_0_14px_-2px_var(--color-primary)]' : 'border-outline-variant text-on-surface-variant')}>
                    {i + 1}
                  </span>
                  <span className={clsx('text-xs font-bold whitespace-nowrap', i === 0 ? 'text-on-surface' : 'hidden sm:inline text-on-surface-variant')}>{ten}</span>
                </li>
              ))}
            </ol>
          }
          chan={
            <>
              <button type="button" onClick={() => setTaoCH(null)} className={NUT_PHU}>Huỷ</button>
              <button type="button" onClick={xacNhanTenCuaHang} disabled={!taoCH.ten.trim() || dangTaoCH} className={NUT_CHINH}>
                {dangTaoCH ? 'Đang tạo…' : 'Tạo & bắt đầu nối kênh →'}
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <label htmlFor="ten-cua-hang-moi" className="block text-sm font-bold text-on-surface">Tên cửa hàng</label>
            <input
              id="ten-cua-hang-moi"
              autoFocus
              value={taoCH.ten}
              maxLength={80}
              onChange={(e) => setTaoCH({ ten: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') xacNhanTenCuaHang(); }}
              placeholder="Ví dụ: Shop mỹ phẩm Hà Nội"
              className="w-full h-12 px-4 rounded-xl bg-surface-container-high border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-on-surface-variant">Tạo xong, app đưa bạn xuống lưới mạng xã hội — chọn bất kỳ mạng nào muốn nối, nối được nhiều kênh.</p>
            {loiTaoCH && <p className="text-sm text-loi">Lỗi: {loiTaoCH}</p>}
          </div>
        </HopThoai>
      )}

      {/*
        TRANG & KÊNH (rà soát giao diện lượt 2 — T1, T6, §3): nơi DUY NHẤT chọn khối não và nối kênh.
        - Bỏ lưới 20 thẻ "Các kênh có thể kết nối" (trùng hộp "Bạn muốn kết nối nền tảng nào?") → nút "Kết nối kênh".
        - Bỏ ô chọn trang ở thanh menu → bảng "Trang bán hàng" (tìm, lọc, gom theo tài khoản, 25 dòng mỗi trang).
        - Thẻ tài khoản 520px → mỗi kênh một dòng; bấm dòng mới hiện quyền đã cấp và các nút thao tác.
      */}
      {/*
        ĐẦU TRANG + 4 Ô TÓM TẮT (phương pháp thiết kế đã chốt 12/10/2026): màn này là nền chung của cả 4 AI → màu thương hiệu.
        Số đếm trên MỌI kênh của tài khoản; màu ô theo nghĩa: trang chưa có kênh cam ⚠, mất kết nối đỏ (0 thì trung tính ✓).
      */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <span className="o-bieu-tuong !w-12 !h-12 !rounded-2xl" style={{ ['--nhan' as string]: MAU_THUONG_HIEU }}>
            <span className="material-symbols-outlined text-[26px]">hub</span>
          </span>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-on-surface">Kênh bán hàng của bạn</h2>
            <p className="text-sm text-on-surface-variant">Mỗi cửa hàng có một bộ não AI riêng · nối kênh để AI nhận tin, đăng bài và chạy quảng cáo</p>
          </div>
        </div>
        {/* Chủ dự án 17/10/2026: "Kết nối kênh mới" → "Tạo cửa hàng mới" — tạo cửa hàng, đặt tên, rồi tới các cổng kết nối. */}
        <button
          onClick={moTaoCuaHang}
          className="self-start md:self-auto shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-sm text-[#003640] transition hover:brightness-110"
          style={{ background: MAU_THUONG_HIEU, boxShadow: `0 8px 22px -8px ${MAU_THUONG_HIEU}` }}
        >
          <span className="material-symbols-outlined text-[20px]">add_business</span>
          Tạo cửa hàng mới
        </button>
      </div>

      {/* VIỆC CẦN LÀM NGAY (đứng trước 4 ô số — phương pháp đã chốt). Tình trạng chung — một dòng, màu theo mức quan trọng (đỏ mất kết nối · cam trang chưa có kênh · ✓ trắng ổn). */}
      {!taiThatBai && (
        <div className={clsx(
          'mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3',
          bannerState === 'danger' ? 'border-loi/50 bg-loi/10' : bannerState === 'warning' ? 'border-canh-bao/50 bg-canh-bao/10' : 'border-outline-variant bg-surface-container'
        )}>
          <span className={clsx('material-symbols-outlined shrink-0',
            bannerState === 'danger' ? 'text-loi' : bannerState === 'warning' ? 'text-canh-bao' : 'text-on-surface')}>
            {bannerState === 'danger' ? 'gpp_bad' : bannerState === 'warning' ? 'warning' : 'check_circle'}
          </span>
          <p className="flex-1 text-sm text-on-surface">
            {bannerState === 'danger'
              ? <><b className="text-loi">{soKenhHong} kênh mất kết nối</b> — AI không trả lời được trên kênh đó cho tới khi nối lại. Tin của khách vẫn được lưu.</>
              : bannerState === 'warning'
                ? <><b className="text-canh-bao">{trangChuaCoKenh.length} cửa hàng chưa có kênh</b>{trangChuaCoKenh.length === 1 ? ` — ${trangChuaCoKenh[0].ten}` : ''}. AI của cửa hàng đó chưa làm việc được — chọn cửa hàng đó ở khung "Kết nối kênh cho cửa hàng" rồi nối kênh.</>
                : <>Mọi kết nối đang hoạt động · AI chạy trên {activePageCount} kênh</>}
          </p>
          {bannerState === 'danger' && (
            <button onClick={handleSync} disabled={syncing} className={clsx(NUT_PHU, 'h-9 px-4 text-sm shrink-0')}>
              {syncing ? 'Đang kiểm tra…' : 'Kiểm tra lại kết nối'}
            </button>
          )}
        </div>
      )}

      {!taiThatBai && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            // Đếm MỌI trang (kể cả chưa có kênh) — bảng bên dưới cũng đếm vậy; bản trước đếm theo bộ chọn bộ não → "1" cạnh bảng "3 trang".
            { nhan: 'Cửa hàng', so: dsTrangToi.length, phu: 'mỗi cửa hàng một bộ não AI', icon: 'storefront', mau: MAU_THUONG_HIEU },
            { nhan: 'Kênh đang chạy', so: activePageCount, phu: `${connectedPlatformCount}/${connectablePlatformCount} nền tảng đã nối`, icon: 'podcasts', mau: MAU_THUONG_HIEU },
            { nhan: 'Cửa hàng chưa có kênh', so: trangChuaCoKenh.length, phu: trangChuaCoKenh.length ? 'AI của cửa hàng đó chưa làm việc được' : 'cửa hàng nào cũng đã có kênh', icon: trangChuaCoKenh.length ? 'warning' : 'task_alt', mau: trangChuaCoKenh.length ? 'var(--color-canh-bao)' : '#94a3b8' },
            { nhan: 'Mất kết nối', so: soKenhHong, phu: soKenhHong ? 'AI đang dừng trên kênh này' : 'mọi kênh đều ổn', icon: soKenhHong ? 'link_off' : 'verified', mau: soKenhHong ? 'var(--color-loi)' : '#94a3b8' },
          ].map((o) => (
            <div key={o.nhan} className="the p-4 md:p-5 min-w-0" style={{ ['--nhan' as string]: o.mau }}>
              <div className="flex items-center gap-3">
                <span className="o-bieu-tuong !w-8 !h-8 md:!w-9 md:!h-9 shrink-0"><span className="material-symbols-outlined text-[18px] md:text-[20px]">{o.icon}</span></span>
                <span className="text-xs md:text-sm font-bold text-on-surface-variant leading-tight">{o.nhan}</span>
              </div>
              <div className="mt-3 so-lon text-3xl md:text-4xl font-black text-on-surface">{loading ? '…' : o.so}</div>
              <div className="mt-1 text-xs text-on-surface-variant leading-snug">{o.phu}</div>
            </div>
          ))}
        </div>
      )}

      {/*
        THỨ TỰ (chủ dự án 12/10/2026): "Thêm kênh mới" CỐ ĐỊNH ở trên; trang bán hàng + tài khoản đã kết nối ở CUỐI —
        hai phần này dài dần theo số trang / kênh, đặt cuối để kéo dài không đẩy phần cố định xuống.
      */}
      {/*
        CÁC KÊNH CÓ THỂ KẾT NỐI — giữ lưới cổng kết nối (chủ dự án 11/10/2026), làm GỌN để chịu được rất nhiều kênh:
        ô thấp (một hàng biểu tượng + tên + nhãn nhỏ), 2→6 cột theo bề rộng, ô tìm nền tảng, ba nhóm như cũ. Nhãn
        "Chỉ đăng bài" / "Lưu ý" nằm dòng dưới tên — bản cũ đặt cùng hàng nên đè lên tên và nút "+".
      */}
      <section ref={luoiKenhRef} className="khung-muc mau-xanh mb-8 scroll-mt-6">
        <div className="dau-muc flex flex-wrap items-center justify-between gap-3">
          <h3 className="tieu-de-muc">Kết nối kênh cho cửa hàng</h3>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
            <input
              value={timKenh}
              onChange={(e) => setTimKenh(e.target.value)}
              placeholder="Tìm nền tảng…"
              className="h-9 w-52 pl-8 pr-3 rounded-lg bg-surface-container-high border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-on-surface"
            />
          </div>
        </div>
        {/* CHỌN CỬA HÀNG để nối kênh — cửa hàng đang chọn sáng; mỗi cửa hàng một hộp (1 Fanpage, 1 TikTok…). */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {dsTrangToi.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCuaHangNoi(t.id)}
              aria-pressed={cuaHangNoi === t.id}
              // Đang chọn phải NỔI HẲN (viền dày + chữ màu chính + ✓ + quầng báo trạng thái) — bản đầu chỉ tô nền mờ, rê chuột
              // sang ô khác là trông như ô kia đang được chọn.
              className={clsx('h-9 px-3 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 transition-colors',
                cuaHangNoi === t.id
                  ? 'border-2 border-primary bg-primary/15 text-primary shadow-[0_0_16px_-6px_var(--color-primary)]'
                  : 'border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]')}
            >
              <span className="material-symbols-outlined text-[18px]">{cuaHangNoi === t.id ? 'check_circle' : 'storefront'}</span>
              {t.ten}
              <span className="text-xs font-semibold text-on-surface-variant">· {t.soKenh} kênh</span>
            </button>
          ))}
          <button type="button" onClick={moTaoCuaHang}
            className="h-9 px-3 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-on-surface inline-flex items-center gap-1.5 hover:border-primary/60">
            <span className="material-symbols-outlined text-[18px] text-primary">add_business</span>
            Tạo cửa hàng mới
          </button>
        </div>
        {chDangNoi && !chDangNoi.hopRieng && (
          <p className="text-sm text-canh-bao mb-4">
            ⚠ Cửa hàng "{chDangNoi.ten}" còn sót từ cách làm cũ, dùng chung hộp với cửa hàng khác — kênh nối vào sẽ rơi sang
            cửa hàng kia. Vui lòng xoá cửa hàng này (⋯ → Xoá cửa hàng) và tạo cửa hàng mới.
          </p>
        )}
        {!chDangNoi && dsTrangToi.length > 0 && (
          <p className="text-sm text-canh-bao mb-4">⚠ Chọn một cửa hàng ở trên để xem và kết nối kênh cho cửa hàng đó.</p>
        )}
        {/* Chú giải biểu tượng — một dòng, để chủ shop không phải rê chuột đoán nghĩa. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 font-bold text-on-surface"><span className="w-4 h-4 rounded-full bg-thanh-cong flex items-center justify-center text-[10px] font-black text-[#04281b]">✓</span>Đã kết nối</span>
          <span className="hidden sm:inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">add_circle</span>Bấm để kết nối</span>
          <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">schedule</span>Sắp có (chưa nối được)</span>
          <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">edit_note</span>Chỉ đăng bài (không nhận tin nhắn)</span>
          <span className="inline-flex items-center gap-1 text-thong-tin"><span className="material-symbols-outlined text-[16px]">info</span>Có lưu ý<span className="hidden sm:inline">&nbsp;— rê chuột để đọc</span><span className="sm:hidden">&nbsp;— hiện khi bấm kết nối</span></span>
        </div>
        {/*
          HƯỚNG DẪN NỐI KÊNH (chủ dự án 17/10/2026): sau khi tạo cửa hàng, cả LƯỚI sáng viền + mũi tên chỉ xuống — chủ shop
          TỰ CHỌN bất kỳ mạng nào (không bắt theo thứ tự). Nối xong ô đó sáng ✓, mũi tên vẫn chỉ tiếp xuống lưới để nối thêm;
          bấm "Xong, không nối thêm" thì tắt mũi tên.
        */}
        {dangHuongDan && chHuongDan && (
          <div className="flex flex-col items-center text-center gap-2 mb-3">
            <p className="text-sm text-on-surface">
              Chọn mạng xã hội muốn nối cho cửa hàng <b className="text-primary">{chHuongDan.ten}</b> — nối được nhiều kênh,
              nối xong ô đó sáng <b className="text-thanh-cong">✓</b>.{chHuongDan.soKenh > 0 && <> Đã nối <b>{chHuongDan.soKenh}</b> kênh.</>}
            </p>
            <button type="button" onClick={() => setHuongDan(null)}
              className="h-8 px-4 rounded-lg border border-outline text-xs font-bold text-on-surface hover:bg-white/[0.05]">
              Xong, không nối thêm
            </button>
            <span className="material-symbols-outlined text-[34px] text-primary animate-bounce motion-reduce:animate-none" aria-hidden>south</span>
          </div>
        )}
        <div className={clsx('space-y-5 transition-shadow', dangHuongDan && 'rounded-2xl p-3 -mx-3 ring-2 ring-primary shadow-[0_0_34px_-12px_var(--color-primary)]')}>
          {([
            ['Mạng xã hội', 'share', liveSocialChannels, ''],
            ['Tài khoản quảng cáo', 'campaign', liveAdChannels, 'Quảng cáo Meta nối riêng cho từng cửa hàng, sau khi đã nối Fanpage.'],
            ['Tin nhắn và điện thoại', 'forum', liveCommChannels, 'Nhắn tin hoặc gọi cho khách sau khi AI đã lấy được số điện thoại.'],
          ] as [string, string, Platform[], string][]).map(([ten, icon, ds, ghiChu]) => {
            // Đã kết nối đứng đầu nhóm — thấy ngay mình đang có gì.
            const loc = ds
              .filter((c) => !timKenh.trim() || c.name.toLowerCase().includes(timKenh.trim().toLowerCase()))
              // Đã kết nối đứng đầu, "sắp có" xuống cuối nhóm.
              .sort((x, y) => Number(y.connected) - Number(x.connected) || Number(y.connectable) - Number(x.connectable));
            if (loc.length === 0) return null;
            return (
              <div key={ten}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant self-center">{icon}</span>
                  <span className="text-sm font-bold text-on-surface">{ten}</span>
                  <span className="text-xs text-on-surface-variant">
                    {/* Đếm trên nền tảng NỐI ĐƯỢC — "0/7 đã kết nối" khi cả 7 đều "sắp có" là nói sai. */}
                    {ds.some((c) => c.connectable || c.connected)
                      ? `${ds.filter((c) => c.connected).length}/${ds.filter((c) => c.connectable || c.connected).length} đã kết nối`
                      : 'chưa nối được qua hệ thống'}{ghiChu && ` · ${ghiChu}`}
                  </span>
                </div>
                {/*
                  LƯỚI ĐỀU (chủ dự án 12/10/2026): mọi ô CÙNG kích thước, thẳng hàng thẳng cột — bề rộng cố định vừa tên dài nhất
                  (không kéo giãn thừa trống), cao bằng nhau. Điện thoại: 2 cột đều.
                  ĐÃ KẾT NỐI = màu THÀNH CÔNG (lục bảo, viền + nền nhạt + quầng) + dấu ✓. Bản tô đặc xanh ngọc đã bỏ (chủ dự án
                  12/10/2026: trùng màu các nút chính) — trả về màu lục bảo này.
                */}
                <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,228px)] gap-2.5">
                  {loc.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (!c.connected) {
                          // Chưa chọn cửa hàng (nhiều cửa hàng) thì chưa nối được — kênh phải vào một hộp cụ thể.
                          if (c.connectable && chDangNoi && !chDangNoi.hopRieng && (c.id === 'fb_ads' || !adChannelIds.has(c.id))) {
                            setErrorMessage(`Cửa hàng "${chDangNoi.ten}" dùng chung hộp với cửa hàng khác — xoá nó và tạo cửa hàng mới để nối kênh.`);
                            return;
                          }
                          if (c.connectable && !chDangNoi && (c.id === 'fb_ads' || !adChannelIds.has(c.id))) {
                            setErrorMessage('Chọn cửa hàng ở đầu khung "Kết nối kênh cho cửa hàng" trước, rồi bấm nền tảng muốn nối.');
                            return;
                          }
                          handleOpenConnect(c);
                          return;
                        }
                        setKenhMo(accounts.find((a) => a.platform === c.platformKey && (!chDangNoi || a.trang_id === chDangNoi.id))?.id ?? null);
                        bangTrangRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      title={!c.connectable && !c.connected ? (c.capabilityNote ?? 'Chưa kết nối được') : c.warnings?.[0] ?? (c.connected ? 'Đã kết nối — bấm để xem ở bảng "Cửa hàng và kênh đã nối"' : `Kết nối ${c.name}`)}
                      className={clsx('group relative h-[60px] w-full flex items-center gap-2 sm:gap-2.5 pl-2 pr-2 sm:pl-2.5 sm:pr-3 rounded-2xl border text-left transition-all min-w-0',
                        c.connected
                          ? 'border-thanh-cong/70 bg-thanh-cong/10 shadow-[0_0_22px_-8px_var(--color-thanh-cong)] text-on-surface hover:bg-thanh-cong/15'
                          : !c.connectable
                            // Chưa nối được (beta / chưa mở): mờ + "Sắp có" — bản cũ ghi "Kết nối" như mọi ô, bấm vào mới biết không được.
                            ? 'border-outline-variant/60 border-dashed text-on-surface-variant opacity-75 hover:opacity-100'
                            : 'border-outline-variant text-on-surface hover:border-[color-mix(in_srgb,var(--mau)_60%,transparent)] hover:bg-white/[0.03] hover:-translate-y-0.5')}
                    >
                      <span className={clsx('w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl shrink-0 flex items-center justify-center border',
                        c.connected ? 'border-thanh-cong/50 bg-thanh-cong/15 text-thanh-cong' : 'bg-white/5 border-white/15 text-on-surface-variant group-hover:text-primary')}>
                        <span className="material-symbols-outlined text-[20px] max-sm:text-[18px]!" aria-hidden>{c.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Điện thoại ô hẹp: tên XUỐNG DÒNG, không cắt; màn rộng một dòng (đã đo vừa mọi tên). */}
                        <span className="block text-[13px] sm:text-sm font-bold leading-tight sm:truncate">{c.name}</span>
                        <span className={clsx('flex items-center gap-0.5 sm:gap-1.5 text-[11px] whitespace-nowrap', c.connected ? 'font-bold text-thanh-cong' : 'text-on-surface-variant')}>
                          {/* Meta Ads chưa nối được vì cửa hàng chưa có Fanpage (H11) — không phải "sắp có". */}
                          {c.connected ? 'Đã kết nối' : c.connectable ? 'Kết nối' : c.id === 'fb_ads' ? 'Nối Fanpage trước' : 'Sắp có'}
                          {/* Nhãn phụ thành biểu tượng nhỏ (rê chuột để đọc) — giữ một dòng, không đè chữ. */}
                          {c.publishOnly && (
                            <span className="inline-flex" title="Chỉ đăng bài — không có tin nhắn / bình luận cho AI bán hàng">
                              <span className="material-symbols-outlined text-[14px] max-sm:text-[13px]!">edit_note</span>
                            </span>
                          )}
                          {c.warnings && c.warnings.length > 0 && (
                            // Lưu ý của nền tảng là THÔNG TIN (lam), không phải cảnh báo — bản cũ ⚠ cam làm cả lưới như báo động.
                            <span className={clsx('inline-flex', !c.connected && 'text-thong-tin')} title={`Lưu ý: ${c.warnings.join(' ')}`}>
                              <span className="material-symbols-outlined text-[15px] max-sm:text-[13px]!">info</span>
                            </span>
                          )}
                        </span>
                      </span>
                      {c.connected ? (
                        // Điện thoại: ✓ thành huy hiệu GÓC (không chiếm chỗ của tên); màn rộng nằm cuối ô.
                        <span className="absolute -top-1.5 -right-1.5 sm:static w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-thanh-cong text-[#04281b] text-[11px] sm:text-[13px] font-black flex items-center justify-center shrink-0 ring-2 ring-background sm:ring-0 shadow-[0_0_10px_var(--color-thanh-cong)]" aria-label="Đã kết nối">✓</span>
                      ) : (
                        // Ẩn trên điện thoại (chữ "Kết nối" đã đủ nghĩa); bọc ngoài vì lớp biểu tượng của font tự đặt display, đè lớp "hidden".
                        <span className="hidden sm:flex shrink-0"><span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary" aria-hidden>{c.connectable ? 'add_circle' : c.id === 'fb_ads' ? 'link' : 'schedule'}</span></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div ref={bangTrangRef} className="scroll-mt-6">
        <BangTrangBanHang
          thaoTacKenh={thaoTacKenh}
          thaoTacTrang={(n) => n.id != null && (
            <MenuQuanLyTrang tieuDe={n.ten} nhan={`Thao tác cửa hàng ${n.ten}`} muc={[
              { ten: 'Kết nối kênh cho cửa hàng này', onChon: () => batDauHuongDan(n.id!) },
              { ten: 'Đặt tên cửa hàng', onChon: () => doiTenTrang(n.id!, n.ten) },
              // Chỉ trang KHÔNG còn kênh mới xoá được (xoá cả bộ não) — trang còn kênh thì chuyển / ngắt kênh trước.
              ...(n.kenh.length === 0 && dsTrangToi.length > 1 ? [{ ten: 'Xoá cửa hàng', onChon: () => xoaTrang(n.id!, n.ten), nguyHiem: true }] : []),
            ]} />
          )}
          kenhMo={kenhMo}
          tatCaTrang={dsTrangToi}
          nenTang={nenTangCua}
        />
      </div>

      {/*
        Tài khoản quảng cáo Meta không gắn trang nào (dùng chung) — không nằm trong bảng trang, hiện riêng một dòng gọn.
        Kênh của từng trang nằm NGAY TRONG bảng "Trang bán hàng & kênh" phía trên (bấm trang để mở).
      */}
      {kenhQuangCaoChung.length > 0 && (
        <section className="khung-muc mb-8 @container">
          <h3 className="tieu-de-muc dau-muc">Tài khoản quảng cáo dùng chung ({kenhQuangCaoChung.length})</h3>
          <div className="divide-y divide-outline-variant/60 -mx-1">
            {kenhQuangCaoChung.map((a) => <DongKenh key={a.id} k={a} nenTang={nenTangCua} thaoTac={thaoTacKenh(a)} con={false} />)}
          </div>
        </section>
      )}

      {/* Connect Modal */}
      {connectStep > 0 && (
        <HopThoai
          co="lon"
          bieuTuong="cable"
          tieuDe={connectStep > 1 && selectedPlatform ? `Kết nối ${selectedPlatform.name}` : 'Kết nối kênh bán hàng'}
          onDong={() => setConnectStep(0)}
          dongKhiBamNgoai={false}
          // Kiểu một bước (nhập thông tin) không có thanh bước: không lỗi thì bỏ hẳn dải đầu — bản cũ để một dải trống.
          dauPhu={!errorBanner && selectedPlatform && (!selectedPlatform.connectionType.startsWith('oauth') || !selectedPlatform.connectable) ? undefined :
            <div className="space-y-3">
              {errorBanner}
              {/*
                THANH BƯỚC có số + tên (bản cũ là 2–3 vạch không chữ — không biết đang ở bước mấy trên mấy bước). Bước
                đã qua ✓, bước đang làm tô đặc màu chính của màn, bước sau viền.
              */}
              {selectedPlatform?.connectable && (() => {
                const loai = selectedPlatform.connectionType;
                const buoc: { so: number; ten: string }[] =
                  loai === 'oauth_with_selection' ? [{ so: 2, ten: 'Đăng nhập' }, { so: 3, ten: `Chọn ${selectedPlatform.selectionLabel ?? 'tài khoản'}` }, { so: 4, ten: 'Hoàn tất' }]
                    : loai === 'oauth_simple' ? [{ so: 2, ten: 'Đăng nhập' }, { so: 4, ten: 'Hoàn tất' }]
                      : [{ so: 2, ten: 'Nhập thông tin' }];
                if (buoc.length < 2) return null;
                return (
                  <ol className="flex items-center gap-2" aria-label="Các bước kết nối">
                    {buoc.map((b, i) => {
                      const xong = connectStep > b.so || (b.so === 4 && loginSuccess && connectStep === 4);
                      const dang = !xong && connectStep === b.so;
                      return (
                        <li key={b.so} className="flex items-center gap-2 min-w-0">
                          {i > 0 && <span className={clsx('h-px w-5 sm:w-10 shrink-0', connectStep >= b.so ? 'bg-primary' : 'bg-outline-variant')} />}
                          <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border',
                            xong ? 'bg-primary text-on-primary border-primary'
                              : dang ? 'bg-primary text-on-primary border-primary shadow-[0_0_14px_-2px_var(--color-primary)]'
                                : 'border-outline-variant text-on-surface-variant')}>
                            {xong ? '✓' : i + 1}
                          </span>
                          {/* Điện thoại: chỉ ghi tên bước đang làm (các bước khác chỉ số) — không dính chữ. */}
                          <span className={clsx('text-xs font-bold whitespace-nowrap', dang ? 'text-on-surface' : 'hidden sm:inline', xong ? 'text-on-surface' : !dang && 'text-on-surface-variant')}>{b.ten}</span>
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
            </div>
          }
        >
            <div>
              {/*
                Lưới an toàn: từ bước 2 trở đi mọi nhánh đều cần selectedPlatform.
                Thiếu nó thì trước đây hộp thoại hiện ra TRẮNG TRƠN, không chữ
                không nút — chủ shop không biết đang xảy ra chuyện gì. Thà nói
                thẳng là chưa dựng lại được và cho đường quay lại.
              */}
              {connectStep > 1 && !selectedPlatform && (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant opacity-40">help</span>
                  <h2 className="text-xl font-bold text-on-surface mt-4 mb-2">Chưa dựng lại được bước đang dở</h2>
                  <p className="text-sm text-on-surface-variant mb-6 max-w-[380px] mx-auto leading-relaxed">
                    Phiên cấp quyền vẫn còn hiệu lực. Vui lòng bấm nút bên dưới để mở lại
                    danh sách Fanpage cần chọn.
                  </p>
                  <button
                    onClick={handleCheckNow}
                    className="py-3 px-8 bg-primary text-on-primary font-bold rounded-xl hover:scale-105 transition-transform"
                  >
                    Mở lại danh sách Fanpage
                  </button>
                </div>
              )}

              {/*
                Bước "Bạn muốn kết nối nền tảng nào?" đã bỏ — trùng lưới "Các kênh có thể kết nối" ngay trên trang
                (chủ dự án 11/10/2026). Hộp này mở thẳng từ bước của nền tảng đã bấm trong lưới.
              */}
              {/*
                NỀN TẢNG CHƯA NỐI ĐƯỢC (SMS / Voice Twilio, Snapchat beta, các tài khoản quảng cáo chưa mở) — nói thật, không
                dựng biểu mẫu giả. Bản cũ có ô Account SID / Auth Token và nút "Kết nối" bấm vào chỉ đóng hộp, không làm gì.
              */}
              {connectStep === 2 && selectedPlatform && !selectedPlatform.connectable && (
                <div className="text-center py-6">
                  <span className="o-bieu-tuong !w-16 !h-16 !rounded-2xl mx-auto mb-5" style={{ ['--nhan' as string]: '#94a3b8' }}>
                    <span className="material-symbols-outlined text-[32px]">{selectedPlatform.icon}</span>
                  </span>
                  <h2 className="text-2xl font-bold text-on-surface mb-2">{selectedPlatform.id === 'fb_ads' ? selectedPlatform.name : `${selectedPlatform.name} — sắp có`}</h2>
                  <p className="text-on-surface-variant leading-relaxed max-w-[28rem] mx-auto">
                    {selectedPlatform.capabilityNote ?? 'Kênh này chưa kết nối được qua hệ thống.'}
                  </p>
                  <button type="button" onClick={() => setConnectStep(0)} className={clsx(NUT_PHU, 'mt-8')}>Đóng</button>
                </div>
              )}

              {/*
                TELEGRAM — nối bằng MÃ (tài liệu nhà cung cấp): chọn trang → lấy mã thật → thêm bot làm quản trị kênh / nhóm,
                gửi mã cho bot → app tự dò mỗi 3 giây, nối xong tự báo. Mã do nhà cung cấp đặt (dạng "ZRN-…"), app không đổi được.
              */}
              {connectStep === 2 && selectedPlatform?.connectable && selectedPlatform.connectionType === 'access_code' && (
                <>
                  <p className="text-on-surface-variant leading-relaxed mb-6 -mt-1">Telegram nối bằng mã, không cần đăng nhập.</p>
                  {canhBaoNenTang}
                  {!maTg ? (
                    <>
                      {khoiNoiLai ?? khoiCuaHangNoi}
                      <button type="button" onClick={layMaTg} disabled={(!trangChonNoi && !noiLaiKenh) || dangLayMa} className={clsx(NUT_CHINH, 'w-full')}>
                        {dangLayMa ? 'Đang lấy mã…' : trangChonNoi || noiLaiKenh ? 'Lấy mã kết nối' : 'Chọn cửa hàng ở lưới kết nối trước'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-outline-variant p-5 mb-6 text-center">
                        <h3 className="tieu-de-muc mb-3">MÃ KẾT NỐI</h3>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <span className="text-3xl font-mono font-bold text-on-surface tracking-widest">{maTg.code}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(maTg.code)} title="Sao chép mã" aria-label="Sao chép mã"
                            className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant text-on-surface hover:border-primary">
                            <span className="material-symbols-outlined text-[20px]">content_copy</span>
                          </button>
                        </div>
                        <p className={clsx('text-xs font-bold', tgTrangThai === 'expired' ? 'text-loi' : 'text-canh-bao')}>
                          {tgTrangThai === 'expired' ? 'Lỗi: mã đã hết hạn — lấy mã mới' : `Mã hết hạn lúc ${new Date(maTg.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <div className="space-y-4 mb-6">
                        <h3 className="tieu-de-muc">LÀM THEO 3 BƯỚC</h3>
                        {[
                          <>Thêm <b>@{maTg.botUsername}</b> làm <b>quản trị viên (Admin)</b> trong kênh / nhóm Telegram của bạn.</>,
                          <>Mở trò chuyện riêng với <b>@{maTg.botUsername}</b>.</>,
                          <>Kênh có tên công khai: gửi <b className="font-mono">{maTg.code} @tenkenh</b>. Kênh riêng tư: chuyển tiếp một tin bất kỳ của kênh cho bot, kèm mã <b className="font-mono">{maTg.code}</b>.</>,
                        ].map((buoc, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">{i + 1}</div>
                            <div className="pt-0.5 text-sm text-on-surface leading-relaxed">{buoc}</div>
                          </div>
                        ))}
                      </div>
                      {tgTrangThai === 'expired' ? (
                        <button type="button" onClick={layMaTg} disabled={dangLayMa} className={clsx(NUT_CHINH, 'w-full')}>Lấy mã mới</button>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-sm font-bold text-primary">
                          <span className="relative flex w-2 h-2">
                            <span className="absolute inset-0 rounded-full bg-primary animate-ping motion-reduce:animate-none" />
                            <span className="relative w-2 h-2 rounded-full bg-primary" />
                          </span>
                          Đang chờ bot xác nhận — xong sẽ tự báo
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/*
                BLUESKY — nối bằng tên tài khoản + MẬT KHẨU ỨNG DỤNG (tài liệu nhà cung cấp). Mật khẩu chỉ đi qua máy chủ để nối,
                không lưu. Bản cũ xếp Bluesky vào luồng đăng nhập thường → không nối được.
              */}
              {connectStep === 2 && selectedPlatform?.connectable && selectedPlatform.connectionType === 'credentials' && (
                <>
                  <p className="text-on-surface-variant leading-relaxed mb-6 -mt-1">Bluesky nối bằng mật khẩu ứng dụng — không phải mật khẩu đăng nhập chính.</p>
                  {canhBaoNenTang}
                  {huongDanNenTang}
                  {khoiNoiLai ?? khoiCuaHangNoi}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label htmlFor="bs-ten" className="block text-sm font-bold text-on-surface mb-2">Tên tài khoản Bluesky</label>
                      <input id="bs-ten" value={bsTen} onChange={(e) => setBsTen(e.target.value)} placeholder="tenban.bsky.social" autoComplete="off"
                        className="w-full h-11 px-4 rounded-xl bg-surface-container-high border border-outline-variant text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label htmlFor="bs-mk" className="block text-sm font-bold text-on-surface mb-2">Mật khẩu ứng dụng</label>
                      <input id="bs-mk" type="password" value={bsMatKhau} onChange={(e) => setBsMatKhau(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" autoComplete="new-password"
                        className="w-full h-11 px-4 rounded-xl bg-surface-container-high border border-outline-variant text-on-surface focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <button type="button" onClick={noiBluesky} disabled={(!trangChonNoi && !noiLaiKenh) || !bsTen.trim() || !bsMatKhau.trim() || dangNoiBs} className={clsx(NUT_CHINH, 'w-full')}>
                    {dangNoiBs ? 'Đang kết nối…' : !trangChonNoi && !noiLaiKenh ? 'Chọn cửa hàng ở lưới kết nối trước' : noiLaiKenh ? 'Nối lại Bluesky' : 'Kết nối Bluesky'}
                  </button>
                </>
              )}

              {connectStep === 2 && selectedPlatform?.connectable && (selectedPlatform.connectionType === 'oauth_simple' || selectedPlatform.connectionType === 'oauth_with_selection') && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[32px] text-primary">{selectedPlatform.icon}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-on-surface mb-3">Đăng nhập tài khoản {selectedPlatform.name}</h2>
                  <p className="text-on-surface-variant font-medium leading-relaxed mb-8">
                    Bạn sẽ được chuyển sang {selectedPlatform.name} để đăng nhập. Chúng tôi không nhìn thấy mật khẩu của bạn.
                  </p>

                  {/* Nối lại: giữ cửa hàng; nối mới: vào cửa hàng đã chọn ở lưới cổng kết nối. */}
                  {!loginSuccess && (khoiNoiLai ?? (phaiChonTrang() ? khoiCuaHangNoi : null))}

                  {selectedPlatform.warnings && selectedPlatform.warnings.length > 0 && (
  <div className="bg-thong-tin/10 border border-thong-tin/30 rounded-xl p-4 mb-8">
    <h3 className="font-bold text-thong-tin mb-2 flex items-center gap-2 text-sm">
      <span className="material-symbols-outlined text-[18px]">info</span>
      LƯU Ý / HẠN CHẾ
    </h3>
    <ul className="list-disc list-inside text-sm text-on-surface space-y-1.5 leading-relaxed">
      {selectedPlatform.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
    </ul>
  </div>
)}

{selectedPlatform.instructions && selectedPlatform.instructions.length > 0 ? (
  <div className="space-y-4 mb-8">
    <h3 className="tieu-de-muc mb-4">HƯỚNG DẪN KẾT NỐI</h3>
    {selectedPlatform.instructions.map((inst: string, idx: number) => (
      <div key={idx} className="flex gap-4">
        <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">{idx + 1}</div>
        <div className="pt-0.5 text-sm font-medium text-on-surface leading-relaxed">{inst}</div>
      </div>
    ))}
  </div>
) : (
  <div className="space-y-4 mb-8">
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">1</div>
      <div className="pt-0.5 text-sm font-medium text-on-surface">Bấm nút bên dưới, một cửa sổ {selectedPlatform.name} sẽ mở ra</div>
    </div>
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">2</div>
      <div className="pt-0.5 text-sm font-medium text-on-surface">
        Đăng nhập tài khoản {selectedPlatform.name} của bạn
      </div>
    </div>
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/50 flex items-center justify-center text-sm font-bold text-primary shrink-0">3</div>
      <div className="pt-0.5 text-sm font-medium text-on-surface">Cấp đủ các quyền được yêu cầu</div>
    </div>
  </div>
)}

                  <div className="bg-surface-container border border-outline-variant/50 rounded-xl p-5 mb-8">
                    <h3 className="tieu-de-muc mb-4">CÁC QUYỀN SẼ ĐƯỢC XIN</h3>
                    <div className="space-y-4">
                      {(selectedPlatform.requestedPermissions || [
                        { icon: 'api', name: `Truy cập API ${selectedPlatform.name}`, desc: 'Cho phép hệ thống kết nối và trao đổi dữ liệu với tài khoản của bạn.' },
                        { icon: 'manage_accounts', name: 'Quản lý tài nguyên', desc: 'Đọc thông tin, danh sách tài khoản và thiết lập để AI có thể hoạt động.' }
                      ]).map((perm: any, idx: number) => (
                        <div key={idx} className="flex gap-3">
                          <span className="material-symbols-outlined text-primary text-[20px]">{perm.icon || 'api'}</span>
                          <div>
                            {/* Dòng chính = ý nghĩa tiếng Việt; mã quyền kỹ thuật lùi xuống dòng phụ (bản cũ ngược lại). */}
                            <div className="text-sm font-bold text-on-surface mb-0.5 leading-snug">{perm.desc}</div>
                            <div className="text-[11px] font-mono text-on-surface-variant">{perm.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    {/*
                      Lúc đang chờ, nút này KHÔNG bị khoá. Bản trước khoá nút và
                      quay mãi: cấp quyền xong rồi mà màn hình vẫn quay, bấm gì
                      cũng không được, không có đường thoát nào ngoài tải lại
                      trang. Nay bấm vào là kiểm tra ngay lập tức.
                    */}
                    {!loginSuccess ? (
                      <button 
                        onClick={isLoggingIn ? handleCheckNow : handleStartOAuth}
                        disabled={!isLoggingIn && phaiChonTrang() && !trangChonNoi}
                        className="w-full py-3.5 px-4 bg-primary text-on-primary font-bold text-lg rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                      >
                        {isLoggingIn ? (
                          <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            Đang chuyển sang {selectedPlatform.name}…
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined">link</span>
                            {phaiChonTrang() && !trangChonNoi ? 'Chọn cửa hàng ở lưới kết nối trước' : `Đăng nhập với ${selectedPlatform.name}`}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="w-full py-3.5 px-4 bg-primary/10 border border-primary/50 text-primary font-bold text-lg rounded-xl flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        Đã đăng nhập: {justConnectedName}
                      </div>
                    )}
                  </div>
                </>
              )}

              {connectStep === 3 && selectedPlatform && selectedPlatform.connectionType === 'oauth_with_selection' && (
                <>
                  <h2 className="text-2xl font-bold text-on-surface mb-2">Chọn {selectedPlatform.selectionLabel} muốn kết nối</h2>
                  <p className="text-on-surface-variant font-medium leading-relaxed mb-6">
                    Đã tìm thấy {newlyConnectedPages.length} {selectedPlatform.selectionLabel?.toLowerCase()} từ tài khoản vừa cấp quyền. Mỗi {selectedPlatform.selectionLabel?.toLowerCase()} kết nối tính là một lượt trong gói của bạn.
                  </p>

                  <div className="space-y-3 mb-6">
                    {newlyConnectedPages.map(page => (
                      <label key={page.id} className={clsx("flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer", page.connected ? "bg-surface-variant border-outline-variant/60 opacity-70" : selectedPages.includes(page.id) ? "bg-primary/5 border-primary shadow-[0_0_20px_-8px_var(--color-primary)]" : "bg-surface-container border-outline-variant hover:border-outline")}>
                        <div className="flex-1 flex items-center gap-4">
                          <AnhDaiDien src={page.avatar} ten={page.name} lop="w-12 h-12 border border-outline-variant/50" />
                          <div>
                            <div className="text-base font-bold text-on-surface mb-0.5">{page.name}</div>
                            <div className="text-sm text-on-surface-variant">{page.subtitle}</div>
                          </div>
                        </div>
                        {page.connected ? (
                          <div className="text-sm font-bold text-on-surface-variant bg-surface px-3 py-1 rounded-full border border-outline-variant/50">Đã kết nối</div>
                        ) : (
                          <div className={clsx("w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors", selectedPages.includes(page.id) ? "bg-primary border-primary text-on-primary" : "bg-transparent border-outline-variant")}>
                            {selectedPages.includes(page.id) && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
                          </div>
                        )}
                        {!page.connected && (
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={selectedPages.includes(page.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedPages.length < MOI_LUOT_MOT_TRANG) {
                                  setSelectedPages([...selectedPages, page.id]);
                                }
                              } else {
                                setSelectedPages(selectedPages.filter(id => id !== page.id));
                              }
                            }}
                          />
                        )}
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="text-sm">
                      <span className="text-on-surface-variant">Đã chọn: </span>
                      <span className="font-bold text-on-surface">{selectedPages.length} {selectedPlatform.selectionLabel?.toLowerCase()}</span>
                    </div>
                    {/*
                      * Nói đúng thứ đang thật sự xảy ra.
                      *
                      * Trước đây chỗ này ghi "Gói của bạn còn 1 lượt kết nối" /
                      * "Gói của bạn đã hết lượt" — cả hai đều gắn cứng số 1 và
                      * chẳng liên quan gì tới gói dịch vụ. Máy chủ hiện KHÔNG
                      * chặn theo gói; con số 1 ở đây chỉ là mỗi lượt kết nối
                      * chọn một trang. Hứa theo gói trong khi không có gì chặn
                      * là nói sai với người trả tiền.
                      *
                      * Khi nào hạn mức theo gói được thực thi ở máy chủ thì
                      * thay MOI_LUOT_MOT_TRANG bằng số còn lại thật của gói.
                      */}
                    {selectedPages.length >= MOI_LUOT_MOT_TRANG ? (
                      <div className="text-sm font-medium text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        Mỗi cửa hàng một Fanpage — muốn chạy thêm Fanpage thì tạo thêm cửa hàng rồi nối Fanpage vào cửa hàng đó
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-on-surface-variant">
                        Mỗi lượt kết nối chọn <span className="text-on-surface font-bold">{MOI_LUOT_MOT_TRANG}</span> Fanpage
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex gap-3 justify-end">
                    <button 
                      onClick={() => setConnectStep(2)}
                      className="py-3 px-6 bg-surface-container border border-outline-variant text-on-surface font-bold rounded-xl hover:bg-surface-variant transition-colors"
                    >
                      Quay lại
                    </button>
                    <button 
                      disabled={selectedPages.length === 0 || isLoggingIn}
                      onClick={handleConfirmPages}
                      className="py-3 px-8 bg-primary text-on-primary font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {isLoggingIn ? 'Đang kết nối Fanpage…' : 'Tiếp tục'}
                    </button>
                  </div>
                </>
              )}

              {connectStep === 4 && selectedPlatform && (selectedPlatform.connectionType === 'oauth_simple' || selectedPlatform.connectionType === 'oauth_with_selection') && (
                <>
                  <h2 className="text-2xl font-bold text-on-surface mb-8 text-center">Xác nhận kết nối</h2>
                  
                  <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-outline-variant/50">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[24px] text-primary">{selectedPlatform.icon}</span>
                      </div>
                      <div>
                        <div className="text-sm text-on-surface-variant mb-1">Nền tảng & Tài khoản</div>
                        <div className="text-lg font-bold text-on-surface">{selectedPlatform.name} — {justConnectedName}</div>
                      </div>
                    </div>
                    
                    {selectedPlatform.connectionType === 'oauth_with_selection' && (
                      <div>
                        <div className="text-sm text-on-surface-variant mb-4">Các {selectedPlatform.selectionLabel?.toLowerCase()} đã kết nối:</div>
                        <div className="space-y-3">
                          {accounts.filter((a) => kenhVuaNoi.includes(a.id)).map((a) => (
                            <div key={a.id} className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                              <AnhDaiDien src={a.profile_picture ?? null} ten={a.display_name || a.username} lop="w-6 h-6 text-xs" />
                              <span className="font-bold text-on-surface">{a.display_name || a.username}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Không có "Quay lại": kênh đã được tạo ở bước 3 — quay lại chọn tiếp không huỷ được kênh vừa nối. */}
                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={handleFinishConnection}
                      className="flex-1 py-3.5 px-4 bg-primary text-on-primary font-bold text-lg rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                      Hoàn tất kết nối
                    </button>
                  </div>
                </>
              )}
            </div>
        </HopThoai>
      )}
    </main>
  );
}
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { BON_AI, MAU_THUONG_HIEU } from '../lib/bon-ai';
import { SUPPORT_URL, IS_EXTERNAL_SUPPORT } from '../lib/ho-tro';

// Đường hỗ trợ dùng chung (src/lib/ho-tro.ts): chưa cài thì "Sắp có", không dẫn vòng sang trang khác.

export default function Sidebar({
  onLogout,
  laQuanTri = false,
  moKhung = false,
  onDong,
}: {
  onLogout?: () => void;
  /*
   * Trên điện thoại thanh menu là NGĂN KÉO, mặc định trượt ra ngoài màn hình.
   *
   * Đã dựng lại trên màn 375px: thanh menu rộng cố định 288px chiếm 77% bề
   * ngang, đẩy toàn bộ nội dung ra khỏi mép phải — tiêu đề trang bị cắt, các ô
   * số bị cắt, không thao tác được gì. Mà chủ shop thì xem hàng trên điện
   * thoại là chính.
   *
   * Từ lg trở lên nó vẫn đứng cố định như cũ, không đổi gì.
   */
  moKhung?: boolean;
  onDong?: () => void;
  /*
   * Chỉ quản trị mới thấy mục Quản Trị Hệ Thống.
   * Giấu trên giao diện không phải là bảo vệ — máy chủ vẫn kiểm lại vai trò từ
   * database ở mọi lời gọi. Đây chỉ để người thường không nhìn thấy cái nút
   * họ không bấm được.
   */
  laQuanTri?: boolean;
}) {
  const viTri = useLocation();

  /*
   * Chọn một mục là đóng ngăn kéo.
   *
   * Không đóng thì trên điện thoại chủ shop bấm sang trang mới xong vẫn chỉ
   * nhìn thấy cái menu phủ kín màn hình, tưởng là bấm không ăn.
   */
  useEffect(() => { onDong?.(); }, [viTri.pathname]);

  /*
   * MENU THEO KHỐI NÃO (chủ dự án chốt 10/10/2026 — docs/khoi-nao.md).
   *
   *   KHỐI NÃO AI                 ← 4 AI cố định, liền mạch, luôn đi cùng nhau
   *   (Không có bộ chọn trang ở đầu menu — chủ dự án 11/10/2026: trang bán hàng quản lý DUY NHẤT ở Kết nối kênh.)
   *     Tổng quan khối não
   *     ① AI Nội dung · ② AI Quảng cáo · ③ AI Bán hàng · ④ AI Điều hành
   *   DỮ LIỆU CỦA TRANG           ← thứ thay đổi được để điều hướng AI
   *   QUẢN LÝ                     ← chủ chuỗi / quản trị
   *
   * Chưa có trang nào (vd. chủ chuỗi chưa lập trang) thì không bày khối não rỗng — chỉ phần quản lý.
   */
  /*
   * THỨ TỰ MENU (chủ dự án 11/10/2026):
   *   Tổng quan            ← tổng quan TOÀN HỆ THỐNG (không chỉ một khối não)
   *   Kết nối kênh         ← luôn đứng TRƯỚC khối não: kênh phải nối trước thì AI mới làm việc được; luôn hiện, kể cả
   *                          shop mới chưa có trang nào (nối Fanpage là cách có trang đầu tiên)
   *   Khối não AI: 4 AI    ← không bọc khung riêng, trình bày như các nhóm khác
   *   Dữ liệu của trang    ← Báo cáo Telegram
   *   Quản lý              ← Gói dịch vụ, rồi Quản lý tài khoản (quản trị toàn hệ thống) ở CUỐI CÙNG
   */
  /*
   * Mọi tài khoản thấy ĐỦ menu y hệt tài khoản mẫu của quản trị tổng (chủ dự án 18/10/2026: "nhân bản 100%"), kể cả
   * khi chưa nối kênh — màn trong bộ não tự hướng dẫn đi nối kênh. Bản trước giấu khối não khi chưa có kênh: tài khoản
   * mới nhìn khác hẳn tài khoản mẫu.
   */
  const coNao = true;
  // Tổng quan thuộc miền ④ Điều hành (xanh ngọc — bảng màu đã thống nhất).
  const mucTongQuan = { name: 'Tổng quan', icon: 'dashboard', path: '/', mau: MAU_THUONG_HIEU };
  const mucKetNoi = { name: 'Kết nối kênh', icon: 'cable', path: '/ket-noi', mau: MAU_THUONG_HIEU };
  const nhomNao = coNao
    ? BON_AI.map((a) => ({ name: a.ten, icon: a.bieuTuong, path: a.duong, so: a.so, mau: a.hex }))
    : [];
  const nhomDuLieu = coNao
    ? [{ name: 'Báo cáo Telegram', icon: 'notifications_active', path: '/telegram' }]
    : [];
  const nhomQuanLy = [
    { name: 'Gói dịch vụ', icon: 'workspace_premium', path: '/pricing' },
    // Chỉ quản trị tổng. Đứng cuối cùng.
    ...(laQuanTri ? [{ name: 'Quản lý tài khoản', icon: 'manage_accounts', path: '/admin' }] : []),
  ];
  /*
   * THANH MENU VÀNG GOLD (chủ dự án 30/10/2026: "giống 100% ảnh mẫu" — khung kim loại vàng vát cạnh, kính đen, mục đang chọn
   * viên viền vàng phát sáng, mũi tên ›, số 4 AI trong vòng tròn màu miền, vạch vàng phát sáng ở đáy). Chỉ đổi phần NHÌN:
   * đường dẫn, nhóm, quyền, ngăn kéo điện thoại, Trợ giúp "Sắp có" giữ nguyên.
   */
  const nhan = (chu: string) => (
    <div className="px-3 pb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#E8EDF2]/45">{chu}</div>
  );
  const vach = <div className="mx-2 my-3 [@media(max-height:860px)]:my-2 h-px shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,226,160,0.14) 18%, rgba(255,226,160,0.14) 82%, transparent)' }} />;
  const muiTen = (sang: boolean) => (
    <span
      className="material-symbols-outlined relative z-10 ml-auto shrink-0 transition-colors duration-300"
      style={{ fontSize: '20px', color: sang ? '#FFF4D6' : 'rgba(232,237,242,0.5)', fontVariationSettings: "'wght' 300" }}
    >
      chevron_right
    </span>
  );

  /** Mục đang chọn: một màu VÀNG GOLD cho mọi mục (ảnh mẫu); số của 4 AI vẫn giữ màu miền trong vòng tròn. */
  const MAU_HE_THONG = VANG.chinh;
  const renderNavGroup = (items: any[]) => (
    <div className="flex flex-col relative gap-1.5 [@media(max-height:860px)]:gap-1">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => clsx(
            "relative flex items-center gap-2.5 pl-2.5 pr-2 rounded-[13px] transition-all duration-300 group shrink-0 cursor-pointer h-[43px] [@media(max-height:860px)]:h-[38px]",
            !isActive && "hover:bg-[#F5C451]/[0.06]"
          )}
          style={({ isActive }) => ({
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: '15px',
            fontWeight: isActive ? 700 : 500,
            letterSpacing: '0.1px',
            color: isActive ? '#FFFFFF' : '#E8EDF2',
            border: '1.5px solid transparent',
            ...(isActive
              ? {
                  // Kính vàng SẪM (ảnh mẫu): nền nâu vàng tối, vệt sáng mỏng phía trên, viền vàng sáng sắc nét.
                  background: `linear-gradient(180deg, rgba(255,226,150,0.10) 0%, rgba(255,226,150,0) 50%) padding-box, linear-gradient(100deg, rgba(122,84,20,0.72) 0%, rgba(82,56,14,0.66) 45%, rgba(46,32,9,0.72) 100%) padding-box, ${VANG.vienSang} border-box`,
                  boxShadow: `0 0 12px ${MAU_HE_THONG}b3, 0 0 30px ${MAU_HE_THONG}4d, inset 0 0 18px ${MAU_HE_THONG}40, inset 0 1px 0 rgba(255,244,214,0.45)`,
                }
              : {}),
          })}
        >
          {({ isActive }) => (
            <>
              {/* Số thứ tự + màu riêng của từng AI trong khối não (src/lib/bon-ai.ts) — vòng tròn màu miền như ảnh mẫu. */}
              {item.so && (
                <span
                  className="relative z-10 w-[25px] h-[25px] shrink-0 rounded-full flex items-center justify-center font-mono text-[13px] font-bold"
                  style={{ color: item.mau, border: `1.5px solid ${item.mau}`, boxShadow: `0 0 8px ${item.mau}55, inset 0 0 6px ${item.mau}33`, textShadow: `0 0 6px ${item.mau}99` }}
                >
                  {item.so}
                </span>
              )}
              {/* Icon: nét mảnh khi thường; đang chọn thì vàng, tô đầy, phát sáng. */}
              <span
                className="material-symbols-outlined relative z-10 transition-all duration-300 flex items-center justify-center w-[26px] shrink-0"
                style={{
                  color: isActive ? VANG.sang : 'inherit',
                  fontSize: '24px',
                  fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 300",
                  ...(isActive ? { filter: `drop-shadow(0 0 6px ${MAU_HE_THONG}cc)` } : {}),
                }}
              >
                {item.icon}
              </span>

              {/* Text */}
              <span className={clsx("relative z-10 min-w-0 truncate transition-colors duration-300", !isActive && "group-hover:text-white")}>
                {item.name}
              </span>
              {muiTen(isActive)}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  /** Trợ giúp / Đăng xuất: mờ hơn menu chính, cùng hàng mũi tên. */
  const kieuChan = { color: 'rgba(232,237,242,0.55)', fontSize: '15px', fontWeight: 400, height: '40px', fontFamily: "'Be Vietnam Pro', sans-serif" };
  const bieuTuongChan = { fontSize: '23px', color: 'inherit', fontVariationSettings: "'wght' 300" };

  return (
    <>
    {/* Nền mờ sau ngăn kéo: bấm ra ngoài là đóng. Chỉ có trên điện thoại. */}
    {moKhung && (
      <div
        onClick={onDong}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/60 lg:hidden"
      />
    )}
    <aside
      className={`w-72 h-screen fixed left-0 top-0 flex flex-col z-50 bg-[#030509] p-2 transition-transform duration-300 lg:translate-x-0 ${moKhung ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* KHUNG KIM LOẠI VÀNG: vành ngoài vát cạnh (dải sáng – tối như kim loại đánh bóng) + quầng sáng vàng. */}
      <div
        className="relative h-full rounded-[26px] p-[5px]"
        style={{
          background: VANG.khung,
          boxShadow: '0 0 0 1px rgba(255,236,180,0.55), 0 0 16px rgba(245,196,81,0.55), 0 0 44px rgba(245,170,50,0.22), inset 0 1px 1px rgba(255,250,225,0.8), inset 0 -1px 2px rgba(60,35,5,0.8)',
        }}
      >
        {/* Rãnh tối + chỉ vàng mảnh bên trong (vát hai lớp như ảnh mẫu). */}
        <div className="relative h-full rounded-[21px] p-[2px]" style={{ background: 'linear-gradient(160deg, #1A1206, #0A0805 40%, #140E05)' }}>
          <div
            className="relative h-full rounded-[19px] overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(180deg, #0E1015 0%, #090B0F 45%, #07080B 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255,214,120,0.45), inset 0 0 6px rgba(245,196,81,0.18), inset 0 0 30px rgba(0,0,0,0.85)',
            }}
          >
            {/* Ánh kính: vệt sáng chéo rất nhẹ ở nửa trên. */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 28%, transparent 46%)' }} />

            {/* Main Content Wrapper */}
            <div className="relative z-10 px-3 h-full flex flex-col pt-4 pb-3">

              {/* Brand Header: lục giác viền vàng + khối lập phương; tên + "AI 5.0 PLATFORM". */}
              <div className="flex items-center gap-2.5 px-1 shrink-0">
                <div className="relative w-[46px] h-[46px] shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full" aria-hidden>
                    <defs>
                      <linearGradient id="vienLogoVang" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FFF1C1" />
                        <stop offset="35%" stopColor="#F5C451" />
                        <stop offset="70%" stopColor="#B07A22" />
                        <stop offset="100%" stopColor="#F5C451" />
                      </linearGradient>
                    </defs>
                    <polygon points="26,3 46,14.5 46,37.5 26,49 6,37.5 6,14.5" fill="rgba(245,196,81,0.08)" stroke="url(#vienLogoVang)" strokeWidth="2.2" strokeLinejoin="round" />
                  </svg>
                  <span
                    className="material-symbols-outlined relative z-10"
                    style={{ fontSize: '25px', color: VANG.chinh, fontVariationSettings: "'wght' 400", filter: 'drop-shadow(0 0 5px rgba(245,196,81,0.6))' }}
                  >
                    deployed_code
                  </span>
                </div>
                <div className="min-w-0">
                  {/* Tên tạm (chủ dự án 23/10/2026 đồng ý bỏ chữ "LOGO"); tên sản phẩm thật chờ chủ dự án chọn — sơ đồ 8.4. */}
                  <h2 className="text-[16.5px] font-extrabold tracking-wide text-white leading-tight whitespace-nowrap">Quản lý Fanpage</h2>
                  <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E8EDF2]/50 whitespace-nowrap">AI 5.0 Platform</div>
                </div>
              </div>
              {vach}

              <nav className="flex flex-col min-h-0 overflow-y-auto no-scrollbar -mx-2.5 px-2.5 -my-2.5 py-2.5">
                {renderNavGroup([mucTongQuan])}
                {vach}
                {nhan('Kênh bán hàng')}
                {renderNavGroup([mucKetNoi])}
                {coNao && (
                  <>
                    {vach}
                    {nhan('Bộ não AI')}
                    {renderNavGroup(nhomNao)}
                    {vach}
                    {nhan('Dữ liệu của cửa hàng')}
                    {renderNavGroup(nhomDuLieu)}
                  </>
                )}
                {vach}
                {nhan('Quản lý')}
                {renderNavGroup(nhomQuanLy)}
              </nav>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Đáy: vạch vàng phát sáng, rồi Trợ giúp / Đăng xuất. */}
              <div className="flex flex-col shrink-0 mt-3">
                <div className="mx-3 h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #F5C451 20%, #FFF1C1 50%, #F5C451 80%, transparent)', boxShadow: '0 0 8px rgba(245,196,81,0.9), 0 0 18px rgba(245,170,50,0.45)' }}></div>
                <div style={{ height: '10px' }}></div>
                <div className="flex flex-col" style={{ gap: '2px' }}>
                  {SUPPORT_URL ? (
                  <a
                    className="flex items-center gap-2.5 pl-2.5 pr-2 rounded-[13px] hover:bg-white/5 hover:text-white transition-colors group shrink-0"
                    href={SUPPORT_URL}
                    {...(IS_EXTERNAL_SUPPORT ? { target: '_blank', rel: 'noreferrer' } : {})}
                    style={kieuChan}
                  >
                    <span className="material-symbols-outlined flex items-center justify-center w-[26px]" style={bieuTuongChan}>
                      help
                    </span>
                    <span className="whitespace-nowrap">Trợ giúp</span>
                    {muiTen(false)}
                  </a>
                  ) : (
                    // Chưa có đường hỗ trợ: mục mờ, không bấm, không nhận Tab/Enter (không phải nút, không phải liên kết).
                    <div
                      aria-disabled="true"
                      className="flex items-center gap-2.5 pl-2.5 pr-2 rounded-[13px] shrink-0 cursor-default select-none"
                      style={{ ...kieuChan, color: 'rgba(232,237,242,0.3)' }}
                    >
                      <span className="material-symbols-outlined flex items-center justify-center w-[26px]" style={bieuTuongChan}>
                        help
                      </span>
                      <span className="whitespace-nowrap">Trợ giúp</span>
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wide border border-white/15 rounded px-1.5 py-0.5">Sắp có</span>
                    </div>
                  )}
                  <button
                    className="flex items-center gap-2.5 pl-2.5 pr-2 rounded-[13px] hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors group shrink-0 w-full text-left"
                    onClick={onLogout}
                    style={kieuChan}
                  >
                    <span className="material-symbols-outlined flex items-center justify-center w-[26px]" style={bieuTuongChan}>
                      logout
                    </span>
                    <span className="whitespace-nowrap">Đăng xuất</span>
                    {muiTen(false)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

/** Bảng màu vàng gold của khung menu (ảnh mẫu 30/10/2026). */
const VANG = {
  chinh: '#F5C451',
  sang: '#FFD978',
  // Kim loại đánh bóng: dải sáng – tối xen kẽ theo đường chéo.
  khung: 'linear-gradient(155deg, #7A4F10 0%, #F5C451 10%, #FFF1C1 17%, #D39A33 28%, #6E4710 42%, #C88E2A 55%, #FFE8A8 66%, #E0AA40 76%, #7C5213 88%, #F1C65A 100%)',
  vienSang: 'linear-gradient(95deg, #FFF1C1 0%, #F5C451 25%, #B98023 60%, #F5C451 85%, #FFE3A0 100%)',
};

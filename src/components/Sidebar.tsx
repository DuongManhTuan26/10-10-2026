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
  const nhan = (chu: string) => (
    <div className="px-3 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#E8EDF2]/50">{chu}</div>
  );

  /** Màu sáng của mục khi đang chọn: 4 AI theo màu miền; Tổng quan + mục hệ thống màu thương hiệu (chủ dự án 23/10/2026: học theo Tổng quan). */
  const MAU_HE_THONG = MAU_THUONG_HIEU;
  const renderNavGroup = (items: any[]) => (
    <div className="flex flex-col relative" style={{ gap: '8px' }}>
      {items.map((item) => { const mau: string = item.mau ?? MAU_HE_THONG; return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => clsx(
            "relative flex items-center gap-3 px-3 rounded-lg transition-all duration-300 group overflow-hidden shrink-0 cursor-pointer"
          )}
          style={({ isActive }) => ({
            height: '40px',
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontSize: '15px',
            fontWeight: isActive ? 700 : 600,
            letterSpacing: '0.2px',
            color: isActive ? '#FFFFFF' : '#E8EDF2',
            background: isActive ? `linear-gradient(90deg, ${mau}26 0%, ${mau}03 100%)` : 'transparent',
            borderTop: isActive ? `1px solid ${mau}26` : '1px solid transparent',
            borderRight: isActive ? `1px solid ${mau}26` : '1px solid transparent',
            borderBottom: isActive ? `1px solid ${mau}26` : '1px solid transparent',
            borderLeft: 'none',
          })}
        >
          {({ isActive }) => (
            <>
              {/* Hover background for inactive items */}
              {!isActive && (
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}

              {/* Laser left border for active item */}
              {isActive && (
                <div className="absolute left-0 top-[15%] bottom-[15%] w-[3px] rounded-r-md z-20" style={{ background: mau }}></div>
              )}

              {/* Số thứ tự + màu riêng của từng AI trong khối não (src/lib/bon-ai.ts). */}
              {item.so && (
                <span
                  className="relative z-10 w-5 h-5 shrink-0 rounded-md flex items-center justify-center font-mono text-[11px] font-black"
                  style={{ color: item.mau, border: `1px solid ${item.mau}80`, background: `${item.mau}1a` }}
                >
                  {item.so}
                </span>
              )}
              {/* Icon */}
              <span 
                className="material-symbols-outlined relative z-10 transition-all duration-300 flex items-center justify-center w-6" 
                style={{
                  color: isActive ? mau : 'inherit',
                  strokeWidth: isActive ? 2.5 : 2,
                  fontSize: '24px',
                  ...(isActive ? { fontVariationSettings: "'FILL' 1" } : {}),
                }}
              >
                {item.icon}
              </span> 
              
              {/* Text */}
              <span className={clsx("relative z-10 whitespace-nowrap transition-colors duration-300", !isActive && "group-hover:text-white")}>
                {item.name}
              </span>

            </>
          )}
        </NavLink>
      ); })}
    </div>
  );

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
      className={`w-72 h-screen fixed left-0 top-0 flex flex-col z-50 overflow-hidden bg-[#030509] transition-transform duration-300 lg:translate-x-0 ${moKhung ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Deep Space / Cyberpunk Ambient Background Effects */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00e5ff]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-[40%] -left-32 w-80 h-80 bg-[#d946ef]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#00e5ff]/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Subtle Grid Pattern for Tech Vibe */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      ></div>

      {/* The Strongest Line: Neon Right Border */}
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#00e5ff] to-transparent shadow-[0_0_20px_#00e5ff,0_0_40px_#00e5ff,0_0_10px_#ffffff] z-20"></div>

      {/* Main Content Wrapper */}
      <div className="relative z-10 px-5 h-full flex flex-col pt-6 pb-6">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 shrink-0" style={{ marginBottom: '24px' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden group border border-[#00e5ff]/30 bg-[#00e5ff]/10 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00e5ff]/20 to-transparent"></div>
            <span className="material-symbols-outlined text-[#00e5ff] text-[20px] relative z-10 filter drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]">token</span>
          </div>
          <div>
            {/* Tên tạm (chủ dự án 23/10/2026 đồng ý bỏ chữ "LOGO"); tên sản phẩm thật chờ chủ dự án chọn — sơ đồ 8.4. */}
            <h2 className="text-[16px] font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50">Quản lý Fanpage</h2>
          </div>
        </div>

        <nav className="flex flex-col min-h-0 overflow-y-auto no-scrollbar">
          {renderNavGroup([mucTongQuan])}
          <div style={{ height: '20px', flexShrink: 0 }}></div>
          {nhan('Kênh bán hàng')}
          {renderNavGroup([mucKetNoi])}
          {coNao && (
            <>
              <div style={{ height: '20px', flexShrink: 0 }}></div>
              {nhan('Bộ não AI')}
              {renderNavGroup(nhomNao)}
              <div style={{ height: '20px', flexShrink: 0 }}></div>
              {nhan('Dữ liệu của cửa hàng')}
              {renderNavGroup(nhomDuLieu)}
            </>
          )}
          <div style={{ height: '20px', flexShrink: 0 }}></div>
          {nhan('Quản lý')}
          {renderNavGroup(nhomQuanLy)}
        </nav>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* CTA & Footer */}
        <div className="flex flex-col shrink-0 mt-4">
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.2), transparent)' }}></div>
          <div style={{ height: '16px' }}></div>
          <div className="flex flex-col" style={{ gap: '4px' }}>
            {SUPPORT_URL ? (
            <a
              className="flex items-center gap-3 px-3 rounded-lg hover:bg-white/5 transition-colors group shrink-0"
              href={SUPPORT_URL}
              {...(IS_EXTERNAL_SUPPORT ? { target: '_blank', rel: 'noreferrer' } : {})}
              style={{
                color: 'rgba(232,237,242,0.4)',
                fontSize: '13px',
                fontWeight: 400,
                height: '40px',
                fontFamily: "'Be Vietnam Pro', sans-serif"
              }}
            >
              <span 
                className="material-symbols-outlined transition-colors group-hover:text-white flex items-center justify-center w-6" 
                style={{ strokeWidth: 1.5, color: 'inherit', fontSize: '20px' }}
              >
                help
              </span> 
              <span className="whitespace-nowrap group-hover:text-white transition-colors">Trợ giúp</span>
            </a>
            ) : (
              // Chưa có đường hỗ trợ: mục mờ, không bấm, không nhận Tab/Enter (không phải nút, không phải liên kết).
              <div
                aria-disabled="true"
                className="flex items-center gap-3 px-3 rounded-lg shrink-0 cursor-default select-none"
                style={{ color: 'rgba(232,237,242,0.3)', fontSize: '13px', fontWeight: 400, height: '40px', fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                <span className="material-symbols-outlined flex items-center justify-center w-6" style={{ strokeWidth: 1.5, color: 'inherit', fontSize: '20px' }}>
                  help
                </span>
                <span className="whitespace-nowrap">Trợ giúp</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide border border-white/15 rounded px-1.5 py-0.5">Sắp có</span>
              </div>
            )}
            <button 
              className="flex items-center gap-3 px-3 rounded-lg hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors group shrink-0 w-full text-left" 
              onClick={onLogout}
              style={{ 
                color: 'rgba(232,237,242,0.4)', 
                fontSize: '13px', 
                fontWeight: 400, 
                height: '40px',
                fontFamily: "'Be Vietnam Pro', sans-serif"
              }}
            >
              <span 
                className="material-symbols-outlined transition-colors flex items-center justify-center w-6" 
                style={{ strokeWidth: 1.5, color: 'inherit', fontSize: '20px' }}
              >
                logout
              </span> 
              <span className="whitespace-nowrap transition-colors">Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

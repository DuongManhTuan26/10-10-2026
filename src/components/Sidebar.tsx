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
                  background: `linear-gradient(180deg, rgba(255,226,150,0.08) 0%, rgba(255,226,150,0) 45%) padding-box, linear-gradient(100deg, rgba(70,48,12,0.85) 0%, rgba(34,24,8,0.88) 55%, rgba(22,16,6,0.9) 100%) padding-box, ${VANG.vienSang} border-box`,
                  boxShadow: `0 0 10px ${MAU_HE_THONG}cc, 0 0 28px ${MAU_HE_THONG}59, inset 0 0 14px ${MAU_HE_THONG}59, inset 0 1px 0 rgba(255,244,214,0.4)`,
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
      className={`w-76 h-screen fixed left-0 top-0 flex flex-col z-50 bg-[#030509] transition-transform duration-300 lg:translate-x-0 ${moKhung ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/*
        LỚP KHUNG 3D — chỉ trang trí (chủ dự án 30/10/2026, ảnh mẫu): tấm kim loại vàng NGHIÊNG có phối cảnh (xoay quanh mép
        trái, mép phải lùi xa), có ĐỘ DÀY (lớp bóng đắp lộ cạnh trái + cạnh đáy), viền nhiều lớp đồng tâm, bóng gương, điểm loé,
        phản chiếu dưới cạnh đáy. Chữ + nút nằm ở LỚP NỘI DUNG phẳng bên dưới — không xoay theo nên không méo.
      */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ perspective: '1000px', perspectiveOrigin: '0% 46%' }}>
        <div
          className="absolute"
          style={{ left: '14px', top: '10px', right: '16px', bottom: '34px', transform: 'rotateY(11deg)', transformOrigin: '0% 50%' }}
        >
          {/* Thân khối: vành gương ngoài + độ dày đắp lớp (lệch xuống – sang trái) + quầng neon. */}
          <div
            className="absolute inset-0 rounded-[30px]"
            style={{ background: VANG.khung, boxShadow: VANG.khoi }}
          />
          {/* Rãnh tối 1 */}
          <div className="absolute inset-[4px] rounded-[26px]" style={{ background: 'linear-gradient(160deg, #1B1306, #080603 45%, #150F05)' }} />
          {/* Vành vàng giữa (lớp 2) */}
          <div className="absolute inset-[6px] rounded-[24px]" style={{ background: VANG.vanhGiua, boxShadow: '0 0 6px rgba(255,190,70,0.55)' }} />
          {/* Rãnh tối 2 */}
          <div className="absolute inset-[8.5px] rounded-[22px]" style={{ background: '#0B0804' }} />
          {/* Mặt kính đen + chỉ neon trong cùng (lớp 3) */}
          <div
            className="absolute inset-[10px] rounded-[20px] overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #0F1116 0%, #0A0C10 45%, #07080B 100%)',
              boxShadow: 'inset 0 0 0 1.5px rgba(255,210,110,0.8), inset 0 0 10px rgba(255,180,60,0.35), inset 0 0 40px rgba(0,0,0,0.9)',
            }}
          >
            {/* Bóng gương: vệt sáng chéo trên kính */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(158deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 26%, transparent 44%), linear-gradient(200deg, transparent 70%, rgba(255,200,110,0.05) 100%)' }} />
          </div>
          {/* Vệt loé gương dọc cạnh trái + cạnh trên (ánh sáng chiếu từ trái) */}
          <div className="absolute inset-0 rounded-[30px]" style={{ background: 'linear-gradient(90deg, rgba(255,252,235,0.75) 0%, rgba(255,252,235,0) 1.6%), linear-gradient(180deg, rgba(255,252,235,0.6) 0%, rgba(255,252,235,0) 0.9%)', mixBlendMode: 'screen' }} />
          {/* Điểm loé sáng hình sao ở góc + giữa cạnh */}
          {[
            { left: '2px', top: '18px', s: 34 },
            { right: '10px', top: '4px', s: 22 },
            { left: '-4px', bottom: '40px', s: 30 },
            { right: '34%', bottom: '-14px', s: 26 },
            { left: '38%', top: '-5px', s: 18 },
          ].map(({ s: c, ...vt }, n) => (
            <div key={n} className="absolute" style={{ ...vt, width: c, height: c, transform: 'translate(-50%,-50%)', background: LOE }} />
          ))}
        </div>
        {/* PHẢN CHIẾU dưới cạnh đáy: dải vàng mờ dần + quầng trên "sàn" */}
        <div className="absolute" style={{ left: '14px', right: '16px', bottom: '2px', height: '30px', transform: 'rotateY(11deg)', transformOrigin: '0% 50%' }}>
          <div
            className="absolute inset-x-[6px] top-0 h-full rounded-b-[30px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,200,90,0.42) 0%, rgba(255,170,50,0.12) 40%, transparent 85%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 90%)',
              maskImage: 'linear-gradient(180deg, #000 0%, transparent 90%)',
              filter: 'blur(2px)',
            }}
          />
          <div className="absolute left-[10%] right-[20%] top-[2px] h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,235,180,0.75), transparent)', filter: 'blur(1px)' }} />
        </div>
      </div>

      {/* LỚP NỘI DUNG — PHẲNG (không xoay): nằm gọn trong mặt kính của khung nghiêng. */}
      <div className="relative z-10 h-full flex flex-col" style={{ padding: '38px 50px 66px 30px' }}>
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
    </aside>
    </>
  );
}

/** Bảng màu vàng gold của khung menu (ảnh mẫu 30/10/2026). */
const VANG = {
  chinh: '#F5C451',
  sang: '#FFD978',
  // Kim loại đánh bóng: dải sáng – tối xen kẽ theo đường chéo.
  khung: 'linear-gradient(158deg, #5E3A08 0%, #FFE08A 6%, #FFFBEA 10%, #F2B841 16%, #7A4D0C 27%, #C98A22 38%, #FFF3C9 47%, #E8A935 55%, #5C3707 66%, #D99A2E 77%, #FFEBB0 86%, #B97818 93%, #6A430B 100%)',
  vienSang: 'linear-gradient(95deg, #FFF1C1 0%, #F5C451 25%, #B98023 60%, #F5C451 85%, #FFE3A0 100%)',
  vanhGiua: 'linear-gradient(170deg, #FFE7A0 0%, #C88A22 22%, #7A4D0C 40%, #E9B44A 60%, #FFF0C0 75%, #9C6516 100%)',
  // Độ dày khối: các lớp bóng đắp lệch xuống – sang trái (lộ cạnh trái + cạnh đáy), tối dần như mặt bên kim loại; rồi neon.
  khoi: [
    '-1px 1px 0 #E3AC45', '-2px 2px 0 #C98F2C', '-3px 3px 0 #B07A20', '-4px 4px 0 #976518', '-5px 5px 0 #7E5212',
    '-6px 6px 0 #67420D', '-7px 7px 0 #523409', '-8px 8px 1px #3E2706', '-9px 10px 6px rgba(0,0,0,0.6)',
    '0 0 0 1px rgba(255,240,195,0.9)', '0 0 8px rgba(255,195,70,0.85)', '0 0 22px rgba(255,170,40,0.55)', '0 0 50px rgba(255,150,30,0.25)',
  ].join(', '),
};

/** Điểm loé sáng hình sao: lõi trắng + tia ngang / dọc. */
const LOE =
  'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,246,210,0.9) 10%, rgba(255,210,120,0.35) 26%, transparent 55%), ' +
  'linear-gradient(90deg, transparent 0%, rgba(255,250,225,0.9) 50%, transparent 100%) center / 100% 1.5px no-repeat, ' +
  'linear-gradient(180deg, transparent 0%, rgba(255,250,225,0.9) 50%, transparent 100%) center / 1.5px 100% no-repeat';

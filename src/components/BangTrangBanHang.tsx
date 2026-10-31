import { useEffect, useMemo, useState, type Key, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useActivePage, type TrangNao } from '../lib/ActivePage';
import type { SocialAccount } from '../lib/api';
import { bienThe, MAU_THUONG_HIEU, VIEN_HE_THONG } from '../lib/bon-ai';

/** Số dòng mỗi trang của bảng — đủ nhìn một lượt, không bắt cuộn dài khi có rất nhiều trang. */
const MOI_TRANG = 25;

/*
 * TÌNH TRẠNG CHỈ LẤY TÍN HIỆU THẬT (chủ dự án 12/10/2026, đã nghiên cứu): bỏ "sắp hết hạn" tự suy từ token_expires_at.
 * Đó là hạn của MÃ NỘI BỘ, nhà cung cấp tự gia hạn (TikTok mã 24 giờ gia hạn hằng ngày; Facebook / Instagram 60 ngày
 * gia hạn lại) — đo thật: TikTok nối từ 13/09 mà "hạn" vẫn luôn là ngày mai, nhà cung cấp báo cả 3 kênh "healthy".
 * Kênh chỉ chết khi nền tảng báo (needs_reconnection / mất kết nối) — máy chủ tự kiểm 30 phút một lần.
 */
type TinhTrang = 'su-co' | 'chua-noi' | 'on';
type Loc = 'tat-ca' | Exclude<TinhTrang, 'on'>;

/** Thứ tự xếp: có vấn đề lên đầu. */
const THU_TU: Record<TinhTrang, number> = { 'su-co': 0, 'chua-noi': 1, on: 2 };

export const kenhHong = (k: SocialAccount) => !k.connected || k.needs_reconnection;

const tinhTrang = (n: TrangNao): TinhTrang =>
  n.kenh.length === 0 ? 'chua-noi' : n.kenh.some(kenhHong) ? 'su-co' : 'on';

const CHIP = 'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap';
const CHIP_ON = 'text-thanh-cong border-thanh-cong/50 bg-thanh-cong/10';
const CHIP_LOI = 'text-loi border-loi/50 bg-loi/10';
const CHIP_CAM = 'text-canh-bao border-canh-bao/50 bg-canh-bao/10';

/*
 * BẢNG DẠNG CÂY (chuẩn PatternFly / Atlassian table-tree): nút mở ▸ ở cột ĐẦU; dòng con dùng CHUNG các cột với dòng cha,
 * chỉ cột tên thụt vào — ô nền tảng nằm đúng dưới NỀN TẢNG, tình trạng đúng dưới TÌNH TRẠNG, thao tác ở cột cuối.
 */
// Chuyển sang dạng cột theo BỀ RỘNG KHUNG (container query), không theo màn hình: màn ~800px có thanh menu thì khung
// còn hẹp, ép 5 cột vào là cột tên bị cắt chữ (đã thấy) → khung dưới 48rem xếp dọc như điện thoại.
const LUOI = '@3xl:grid @3xl:grid-cols-[24px_minmax(0,1fr)_128px_160px_150px] @3xl:items-center @3xl:gap-4';

type NenTang = (platform: string) => { icon: string; ten: string };

/**
 * MỘT DÒNG KÊNH — chỉ phần cốt lõi (chủ dự án 12/10/2026): tên tài khoản · nền tảng · tình trạng · thao tác.
 * Quyền / số liệu AI đã có ở Tổng quan và màn từng AI, không nhắc lại ở đây.
 * Dùng cả trong bảng cây (thụt vào dưới trang) lẫn cho tài khoản quảng cáo dùng chung (không thụt).
 */
export function DongKenh({ k, nenTang, thaoTac, con = true, noiBat = false }: {
  k: SocialAccount;
  nenTang: NenTang;
  /** Nút thao tác ở cột cuối (Nối lại khi hỏng + menu ⋯). */
  thaoTac: ReactNode;
  /** Dòng con của một trang — thụt vào, có vạch nối. */
  con?: boolean;
  /** Kênh vừa được chọn từ lưới "Thêm kênh mới" — tô nhẹ để mắt tìm thấy. */
  noiBat?: boolean;
  key?: Key;
}) {
  const nt = nenTang(k.platform);
  const hong = kenhHong(k);
  const ten = k.display_name || k.username;
  return (
    <div className={clsx('relative px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg', LUOI, noiBat && 'bg-primary/[0.07] ring-1 ring-primary/40')}>
      <span className="hidden @3xl:block" />
      {/* Tên: thụt vào + vạch nối └ để thấy ngay kênh này thuộc trang phía trên. */}
      <span className={clsx('flex items-center gap-2.5 min-w-0 basis-full @3xl:basis-auto', con && 'pl-3 @3xl:pl-5')}>
        {/* Nhánh cây: nối từ đường dọc của trang (xem khối trang) sang kênh này. */}
        {con && <span className="w-4 h-px shrink-0 bg-outline" aria-hidden />}
        {k.profile_picture
          ? <img src={k.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
          : <span className="w-7 h-7 rounded-full bg-surface-variant text-on-surface text-xs font-bold flex items-center justify-center shrink-0">{(ten || '?').charAt(0).toUpperCase()}</span>}
        <span className="min-w-0">
          {/* Cấp PHỤ: chữ thường đậm vừa, nhỏ hơn tên trang — nhìn là biết đây là kênh nằm trong trang. */}
          <span className="block text-sm font-semibold text-on-surface break-words">{ten}</span>
          {hong
            ? <span className="block text-xs text-loi">AI tạm dừng trên kênh này</span>
            : k.username && k.username !== ten && <span className="block text-xs text-on-surface-variant break-words">@{k.username}</span>}
        </span>
      </span>
      {/* Điện thoại: nền tảng · tình trạng · thao tác chung một hàng dưới tên. Màn rộng: mỗi ô một cột (@3xl:contents). */}
      <span className={clsx('flex flex-wrap items-center gap-2 w-full @3xl:contents', con && 'pl-6 @3xl:pl-0')}>
        <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant min-w-0">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0" aria-hidden>{nt.icon}</span>
          <span className="truncate">{nt.ten}</span>
        </span>
        <span>
          <span className={clsx(CHIP, hong ? CHIP_LOI : CHIP_ON)}>
            {hong ? (k.needs_reconnection ? 'Cần nối lại' : 'Mất kết nối') : '✓ Hoạt động'}
          </span>
        </span>
        <span className="ml-auto @3xl:ml-0 flex items-center justify-end gap-2">{thaoTac}</span>
      </span>
    </div>
  );
}

/**
 * TRANG BÁN HÀNG VÀ KÊNH ĐÃ NỐI — một bảng dạng cây cho cả nghìn, triệu trang:
 * mỗi trang một dòng (tình trạng tổng hợp + bộ não), bấm ▸ mở các kênh của trang ngay bên dưới, thẳng cột.
 * Trang có vấn đề tự lên đầu; tìm theo tên trang / kênh; nút lọc CHỈ hiện khi có trang cần xử lý; 25 dòng mỗi trang.
 */
export default function BangTrangBanHang({
  nenTang,
  thaoTacKenh,
  thaoTacTrang,
  kenhMo,
  tatCaTrang,
}: {
  /** Biểu tượng + tên của một nền tảng (theo danh mục kênh). */
  nenTang: NenTang;
  /** Thao tác của một kênh (Nối lại / Đổi Fanpage / Chuyển trang / Ngắt kết nối) — sống ở màn Kết nối kênh. */
  thaoTacKenh: (k: SocialAccount) => ReactNode;
  /** Thao tác của một trang (Đặt tên trang) — nút ⋯ cạnh "Mở bộ não". */
  thaoTacTrang?: (n: TrangNao) => ReactNode;
  /** Kênh đang được chọn từ chỗ khác (bấm ô "đã kết nối" ở Thêm kênh mới) → tự mở trang chứa nó. */
  kenhMo?: string | null;
  /** Mọi trang của tài khoản (từ máy chủ) — để hiện cả trang CHƯA CÓ KÊNH, bộ chọn bộ não không thấy được. */
  tatCaTrang?: Array<{ id: number; ten: string }>;
}) {
  const { trangs: trangCoKenh, trangDangChon, chonTrang } = useActivePage();
  // Trang có kênh (từ bộ chọn bộ não) + trang chưa có kênh nào (từ máy chủ): chủ shop phải thấy để đặt tên, nối kênh vào.
  const trangs = useMemo<TrangNao[]>(() => [
    ...trangCoKenh,
    ...(tatCaTrang ?? [])
      .filter((r) => !trangCoKenh.some((t) => t.id === r.id))
      .map((r) => ({ khoa: `t${r.id}`, id: r.id, ten: r.ten, kenh: [] as SocialAccount[] })),
  ], [trangCoKenh, tatCaTrang]);
  const navigate = useNavigate();
  const [tim, setTim] = useState('');
  const [loc, setLoc] = useState<Loc>('tat-ca');
  const [trang, setTrang] = useState(0);
  const [moRa, setMoRa] = useState<Set<string>>(() => new Set(trangDangChon ? [trangDangChon.khoa] : []));

  // Trang đang mở tự mở sẵn danh sách kênh (danh sách trang tải xong SAU lần vẽ đầu nên phải theo dõi).
  useEffect(() => {
    if (trangDangChon) setMoRa((cu) => (cu.has(trangDangChon.khoa) ? cu : new Set(cu).add(trangDangChon.khoa)));
  }, [trangDangChon?.khoa]);

  // Bấm ô "đã kết nối" ở lưới nền tảng → mở đúng trang chứa kênh đó.
  useEffect(() => {
    if (!kenhMo) return;
    const t = trangs.find((n) => n.kenh.some((k) => k.id === kenhMo));
    if (t) setMoRa((cu) => new Set(cu).add(t.khoa));
  }, [kenhMo, trangs]);

  const dem = useMemo(() => {
    const d: Record<TinhTrang, number> = { 'su-co': 0, 'chua-noi': 0, on: 0 };
    for (const n of trangs) d[tinhTrang(n)] += 1;
    return d;
  }, [trangs]);
  const tongKenh = useMemo(() => trangs.reduce((t, n) => t + n.kenh.length, 0), [trangs]);

  const ds = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return trangs
      .filter((n) => !t
        || n.ten.toLowerCase().includes(t)
        || n.kenh.some((k) => `${k.display_name ?? ''} ${k.username ?? ''} ${k.platform}`.toLowerCase().includes(t)))
      .filter((n) => loc === 'tat-ca' || tinhTrang(n) === loc)
      // Có vấn đề lên đầu (mất kết nối → chưa có kênh), rồi theo tên.
      .sort((a, b) => THU_TU[tinhTrang(a)] - THU_TU[tinhTrang(b)] || a.ten.localeCompare(b.ten, 'vi'));
  }, [trangs, tim, loc]);

  const soTrang = Math.max(1, Math.ceil(ds.length / MOI_TRANG));
  const trangHien = Math.min(trang, soTrang - 1);
  const dong = ds.slice(trangHien * MOI_TRANG, (trangHien + 1) * MOI_TRANG);

  /*
   * Nút lọc CHỈ hiện khi có trang thuộc nhóm đó (thông lệ: ẩn lựa chọn ra danh sách rỗng). Nút đang chọn vẫn giữ
   * để bỏ chọn được. Mọi trang đều ổn → không hiện hàng lọc nào.
   */
  const nutLoc = ([
    ['su-co', 'Mất kết nối', dem['su-co'], 'text-loi'],
    ['chua-noi', 'Chưa có kênh', dem['chua-noi'], 'text-canh-bao'],
  ] as [Loc, string, number, string][]).filter(([ma, , so]) => so > 0 || loc === ma);

  const batTat = (khoa: string) => setMoRa((cu) => {
    const moi = new Set(cu);
    if (moi.has(khoa)) moi.delete(khoa); else moi.add(khoa);
    return moi;
  });
  const moBoNao = (n: TrangNao) => {
    if (n.khoa !== trangDangChon?.khoa) chonTrang(n.khoa);
    navigate('/');
  };

  if (trangs.length === 0) return null;

  return (
    <section className="khung-muc mb-6 @container">
      <div className="dau-muc flex flex-wrap items-center justify-between gap-3">
        <h3 className="tieu-de-muc">Cửa hàng và kênh đã nối ({trangs.length} cửa hàng · {tongKenh} kênh)</h3>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
          <input
            value={tim}
            onChange={(e) => { setTim(e.target.value); setTrang(0); }}
            placeholder="Tìm cửa hàng hoặc kênh…"
            className="h-9 w-60 pl-8 pr-3 rounded-lg bg-surface-container-high border border-outline-variant text-sm text-on-surface focus:outline-none focus:border-on-surface"
          />
        </div>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">
        Mỗi <b className="text-on-surface">cửa hàng</b> có một bộ não AI riêng · <b className="text-on-surface">kênh</b> là tài khoản mạng xã hội gắn vào cửa hàng đó.
      </p>

      {nutLoc.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {([['tat-ca', 'Tất cả', trangs.length, ''], ...nutLoc] as [Loc, string, number, string][]).map(([ma, ten, so, mau]) => (
            <button
              key={ma}
              onClick={() => { setLoc(ma); setTrang(0); }}
              className={clsx('h-8 px-3 rounded-full text-xs font-bold border transition-colors inline-flex items-center gap-1.5',
                loc === ma ? 'bg-on-surface text-background border-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface')}
            >
              {ten}
              <span className={clsx('tabular-nums', loc !== ma && mau)}>{so.toLocaleString('vi-VN')}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cột tiêu đề (màn rộng) — dòng trang và dòng kênh đều thẳng theo đúng các cột này. */}
      <div className={clsx('hidden px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant', LUOI)}>
        <span /><span>Tên</span><span>Nền tảng</span><span>Tình trạng</span><span className="text-right">Bộ não · Thao tác</span>
      </div>

      {dong.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Không có cửa hàng nào khớp.</p>
      ) : (
        <div className="space-y-3">
          {dong.map((n) => {
            const tt = tinhTrang(n);
            const soHong = n.kenh.filter(kenhHong).length;
            const dangMo = n.khoa === trangDangChon?.khoa;
            const mo = moRa.has(n.khoa);
            return (
              /*
                PHÂN TẦNG (chủ dự án 17/10/2026: "phải có phân tầng, điểm nhấn, phần chính phần phụ"): mỗi TRANG là một KHỐI
                có viền riêng; đầu khối là cấp CHÍNH (dải nền + vạch nhấn màu thương hiệu, tên to đậm, nhãn "TRANG BÁN
                HÀNG"); kênh là cấp PHỤ nằm trong khối, chữ nhỏ hơn, nối bằng đường cây. Trang đang mở: viền sáng (báo
                trạng thái, không trang trí).
              */
              <div
                key={n.khoa}
                // KHÔNG overflow-hidden: menu ⋯ của khối phải tràn ra ngoài được (bị cắt + vẽ lại giật — chủ dự án 17/10/2026).
                className="rounded-2xl border"
                style={{
                  borderColor: dangMo ? `color-mix(in srgb, ${VIEN_HE_THONG} 55%, transparent)` : 'var(--color-outline-variant)',
                  boxShadow: dangMo ? `0 0 22px -10px ${VIEN_HE_THONG}` : undefined,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={mo}
                  onClick={() => batTat(n.khoa)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); batTat(n.khoa); } }}
                  // KHÔNG hover:brightness: bộ lọc bật/tắt cả khối khi chuột đi từ nút ⋯ xuống menu → nhấp nháy (chủ dự án
                  // 17/10/2026). Bo góc đặt thẳng cho dải đầu vì khối không cắt phần tràn nữa.
                  className={clsx('px-3 py-3 cursor-pointer border-l-4 rounded-t-[15px] flex flex-wrap items-center gap-x-3 gap-y-2', !mo && 'rounded-b-[15px]', LUOI)}
                  style={{
                    borderLeftColor: VIEN_HE_THONG,
                    background: `color-mix(in srgb, ${MAU_THUONG_HIEU} ${dangMo ? 10 : 6}%, transparent)`,
                  }}
                >
                  <span className={clsx('material-symbols-outlined text-[22px] text-on-surface-variant transition-transform shrink-0', mo && 'rotate-90')} aria-hidden>chevron_right</span>
                  {/* Tên trang */}
                  <span className="flex items-center gap-3 min-w-0 flex-1 @3xl:flex-none">
                    <span className="o-bieu-tuong !w-10 !h-10 shrink-0" style={bienThe(MAU_THUONG_HIEU)}>
                      <span className="material-symbols-outlined text-[22px]">storefront</span>
                    </span>
                    <span className="min-w-0">
                      {/* Nhãn cấp + tên to đậm: cấp CHÍNH, không lẫn với tên kênh bên dưới. */}
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: MAU_THUONG_HIEU }}>Cửa hàng</span>
                      <span className="block text-lg font-black text-on-surface leading-tight break-words">{n.ten}</span>
                      <span className="block text-xs text-on-surface-variant">{n.kenh.length} kênh</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 w-full pl-9 @3xl:pl-0 @3xl:contents">
                    {/* Nền tảng: chỉ khi ĐÓNG — xem nhanh trang có kênh nào; mở ra thì các dòng kênh bên dưới đã ghi rõ. */}
                    <span className="flex items-center gap-1.5 min-w-0">
                      {!mo && n.kenh.slice(0, 5).map((k) => (
                        <span
                          key={k.id}
                          title={`${nenTang(k.platform).ten} · ${k.display_name || k.username}${kenhHong(k) ? ' — mất kết nối' : ''}`}
                          className={clsx('w-7 h-7 rounded-lg border flex items-center justify-center shrink-0',
                            kenhHong(k) ? 'border-loi/70 text-loi bg-loi/10' : 'border-outline-variant text-on-surface-variant')}
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden>{nenTang(k.platform).icon}</span>
                        </span>
                      ))}
                      {!mo && n.kenh.length > 5 && <span className="text-xs font-bold text-on-surface-variant">+{n.kenh.length - 5}</span>}
                    </span>
                    {/* Tình trạng tổng hợp của trang */}
                    <span>
                      {tt === 'su-co' ? (
                        <span className={clsx(CHIP, CHIP_LOI)}>
                          <span className="material-symbols-outlined text-[14px]">link_off</span>{soHong}/{n.kenh.length} kênh mất kết nối
                        </span>
                      ) : tt === 'chua-noi' ? (
                        <span className={clsx(CHIP, CHIP_CAM)}>⚠ Chưa có kênh</span>
                      ) : (
                        <span className={clsx(CHIP, CHIP_ON)}>✓ Hoạt động</span>
                      )}
                    </span>
                    {/* Bộ não — cả cửa hàng CHƯA CÓ KÊNH cũng mở được (chủ dự án chốt 22/10/2026: dạy AI trước khi nối kênh;
                        hoàn thiện "chọn được cả cửa hàng chưa có kênh" của A4). Câu nhắc nối kênh bên dưới vẫn giữ. */}
                    <span className="ml-auto @3xl:ml-0 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {dangMo ? (
                        <span className="inline-flex items-center gap-2 text-xs font-bold h-8" style={{ color: MAU_THUONG_HIEU }}>
                          <span className="relative flex w-2 h-2">
                            <span className="absolute inset-0 rounded-full animate-ping motion-reduce:animate-none" style={{ background: MAU_THUONG_HIEU }} />
                            <span className="relative w-2 h-2 rounded-full" style={{ background: MAU_THUONG_HIEU }} />
                          </span>
                          Đang mở
                        </span>
                      ) : (
                        <button
                          onClick={() => moBoNao(n)}
                          className="h-8 px-3 rounded-lg border text-xs font-bold transition-colors hover:bg-[color-mix(in_srgb,var(--mau)_15%,transparent)]"
                          style={{ borderColor: `${VIEN_HE_THONG}99`, color: MAU_THUONG_HIEU }}
                        >
                          Mở bộ não
                        </button>
                      )}
                      {thaoTacTrang?.(n)}
                    </span>
                  </span>
                </div>

                {/* Kênh của trang — dòng con, thẳng cột với dòng trang. */}
                {mo && (
                  n.kenh.length === 0 ? (
                    <p className="pl-12 @3xl:pl-[76px] pr-3 py-3 text-sm text-canh-bao border-t border-outline-variant/60">
                      ⚠ Cửa hàng này chưa có kênh — bấm ⋯ → "Kết nối kênh cho cửa hàng này" để AI bắt đầu làm việc.
                    </p>
                  ) : (
                    <div className="relative py-1.5 border-t border-outline-variant/60">
                      {/* Đường cây dọc: từ trang xuống các kênh (mỗi kênh có một nhánh ngang nối vào). */}
                      <span className="absolute top-0 bottom-[22px] left-[24px] @3xl:left-[72px] w-px bg-outline" aria-hidden />
                      {n.kenh.map((k) => (
                        <DongKenh key={k.id} k={k} nenTang={nenTang} thaoTac={thaoTacKenh(k)} noiBat={k.id === kenhMo} />
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {soTrang > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm text-on-surface-variant">
          <span className="tabular-nums">
            {(trangHien * MOI_TRANG + 1).toLocaleString('vi-VN')}–{Math.min(ds.length, (trangHien + 1) * MOI_TRANG).toLocaleString('vi-VN')} / {ds.length.toLocaleString('vi-VN')} trang
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setTrang(trangHien - 1)} disabled={trangHien === 0} className="h-8 px-3 rounded-lg border border-outline-variant disabled:opacity-40">‹ Trước</button>
            <span className="px-2 tabular-nums">Trang {trangHien + 1}/{soTrang}</span>
            <button onClick={() => setTrang(trangHien + 1)} disabled={trangHien >= soTrang - 1} className="h-8 px-3 rounded-lg border border-outline-variant disabled:opacity-40">Sau ›</button>
          </div>
        </div>
      )}
    </section>
  );
}

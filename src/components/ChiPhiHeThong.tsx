import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { api, ApiError, type LocLuot, type NguongCanhBao, type SaoKeChiPhi } from '../lib/api';
import { chi, chiDu, daChi, mauChi, so, vnd } from '../lib/tien-chi';
import NhatKyChiPhi from './NhatKyChiPhi';

/**
 * Chi phí hệ thống — BẢN MẪU cho cách trình bày chung của cả app.
 *
 * Nguyên tắc (chủ dự án đặt): bên ngoài CHỈ có phần chính, ngắn và nổi bật —
 * mỗi bên thứ ba một dòng số tiền đã chi, cộng một dòng tổng. Chi tiết chỉ hiện
 * khi bấm vào đúng dòng đó; cài đặt cất sau biểu tượng bánh răng. Không bao giờ
 * để phần chính và phần con cùng nằm ngoài.
 */

type Dong = 'ai' | 'kenh';
type CachXem = 'viec' | 'taiKhoan';
/**
 * BA CẤP, mỗi cấp một kiểu — nhìn là biết cái nào nằm trong cái nào.
 * Đã bị chê: phần mở ra không có dòng kẻ, chữ mục con đậm ngang dòng chính,
 * "phân chia cỡ chữ mục chính, mục phụ lẫn lộn hết lên".
 *   Cấp 1 — dòng chính: chữ to, đậm (AI, Kết nối kênh, Tổng).
 *   Cấp 2 — mục con: khung nền tối hơn, kẻ dòng, chữ vừa, không đậm.
 *   Cấp 3 — chi tiết của mục con: thụt sâu hơn, vạch dọc bên trái, chữ nhỏ, nhạt.
 */
const KHUNG_CON = 'bg-surface-container-lowest border-t border-outline-variant/60 divide-y divide-outline-variant/60';
const LE_CAP2 = 'pl-[2.6rem] pr-5';
const LE_CAP3 =
  "relative pl-[3.6rem] pr-5 before:content-[''] before:absolute before:left-[2.95rem] before:top-0 before:bottom-0 before:w-px before:bg-outline-variant";

interface Hang {
  khoa: string;
  nhan: ReactNode;
  giaTri?: ReactNode;
  mauGiaTri?: string;
  /** Chữ phụ nhỏ trước số tiền, ví dụ "15 lượt". */
  phu?: string;
  onClick?: () => void;
  /** Có cấp con: undefined = không có; true/false = đang mở/đóng. */
  moRong?: boolean;
}
type TaiKhoan = SaoKeChiPhi['so']['theoTaiKhoan'][number];

/** "01/10" theo giờ Việt Nam. Đã thấy toLocaleDateString('vi-VN') ra "01-10", lệch với chỗ khác. */
const ngayVN = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.day}/${p.month}`;
};

/** Mỗi tài khoản một dòng, tiền nhiều xếp trên (tầng chủ chuỗi đã bỏ — chủ dự án 18/10/2026). */
function xepTaiKhoan(ds: TaiKhoan[]) {
  return [...ds].sort((a, b) => b.usd - a.usd);
}

/** Toàn bộ chi phí trả cho bên thứ ba — màn quản lý của quản trị tổng. */
export default function ChiPhiHeThong() {
  const [du, setDu] = useState<SaoKeChiPhi | null>(null);
  const [mo, setMo] = useState<Dong | null>(null);
  const [moCaiDat, setMoCaiDat] = useState(false);
  const [cachXem, setCachXem] = useState<CachXem>('viec');
  const [moNhom, setMoNhom] = useState<string | null>(null);
  const [moDoiChieu, setMoDoiChieu] = useState(false);
  const [nhatKy, setNhatKy] = useState<{ loc: LocLuot; tieuDe: string } | null>(null);
  const [nguong, setNguong] = useState<NguongCanhBao | null>(null);
  const [thongBao, setThongBao] = useState('');
  const [loi, setLoi] = useState('');

  const tai = useCallback(async () => {
    try {
      const { data } = await api.admin.chiPhi(0);
      setDu(data);
      setNguong(data.nguong);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa tải được chi phí');
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  /** Cảnh báo của một dòng, nặng nhất trước. Gồm cả "chưa đọc được" (lưu ý). */
  const canhBao = (nhom: Dong) => {
    const thuTu = { nguy_cap: 0, can_lam: 1, luu_y: 2 } as const;
    return (du?.canhBao.filter((c) => c.ma.startsWith(nhom === 'ai' ? 'ai_' : 'kenh_')) ?? []).sort(
      (a, b) => thuTu[a.mucDo] - thuTu[b.mucDo]
    );
  };

  /*
   * Dòng AI = TỔNG các khoản chi tiết bên trong (sổ của app, tháng theo giờ
   * Việt Nam). Đã thấy: lấy số "tháng này" của nhà cung cấp (tháng theo giờ
   * quốc tế, bắt đầu 7h sáng ngày 1 giờ VN) thì dòng chính ghi 0,04 mà mở ra
   * lại thấy 0,85 — hai con số khác kỳ đặt cạnh nhau là rối.
   */
  const tienAi = du ? du.so.theoNhom.reduce((t, v) => t + v.usd, 0) : null;
  const cay = useMemo(() => xepTaiKhoan(du?.so.theoTaiKhoan ?? []), [du]);
  const tienKenh = du?.kenh.ok ? du.kenh.tieuKyNayUsd ?? 0 : null;
  const tong = (tienAi ?? 0) + (tienKenh ?? 0);

  const dong = (id: Dong, ten: string, tien: number | null) => {
    const cb = canhBao(id);
    // Xám = chưa đọc được nhà cung cấp, không biết ổn hay không — không được tô xanh.
    const mucDo = cb.some((c) => c.mucDo === 'nguy_cap')
      ? 'do'
      : cb.some((c) => c.mucDo === 'can_lam')
        ? 'cam'
        : cb.length
          ? 'xam'
          : 'xanh';
    return (
      <button
        type="button"
        onClick={() => setMo(mo === id ? null : id)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-surface-container-high/40 transition-colors"
        aria-expanded={mo === id}
      >
        <span
          className={clsx(
            'w-2.5 h-2.5 rounded-full shrink-0',
            mucDo === 'do' ? 'bg-red-500' : mucDo === 'cam' ? 'bg-amber-400' : mucDo === 'xam' ? 'bg-on-surface-variant' : 'bg-green-400'
          )}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-base font-bold text-on-surface">{ten}</span>
          {cb[0] && (
            <span
              className={clsx(
                'block text-xs mt-0.5',
                mucDo === 'do' ? 'text-red-400' : mucDo === 'cam' ? 'text-amber-400' : 'text-on-surface-variant'
              )}
            >
              {cb[0].tomTat}
              {cb.length > 1 && ` (+${cb.length - 1})`}
            </span>
          )}
        </span>
        <span className={clsx('text-lg font-bold tabular-nums', mauChi(tien))}>{chi(tien)}</span>
        <span className={clsx('material-symbols-outlined text-on-surface-variant transition-transform', mo === id && 'rotate-90')}>
          chevron_right
        </span>
      </button>
    );
  };

  /** Một dòng cấp 2 hoặc cấp 3. Bấm được thì là nút, không thì là dòng tĩnh. */
  const hang = (cap: 2 | 3, h: Hang) => {
    const noiDung = (
      <>
        <span className={clsx('flex-1 min-w-0', cap === 2 ? 'text-sm text-on-surface' : 'text-xs text-on-surface-variant')}>{h.nhan}</span>
        {h.phu && <span className="text-[11px] text-on-surface-variant tabular-nums whitespace-nowrap">{h.phu}</span>}
        {h.giaTri !== undefined && (
          <span
            className={clsx(
              'tabular-nums text-right whitespace-nowrap shrink-0',
              cap === 2 ? 'text-sm font-semibold' : 'text-xs',
              h.mauGiaTri ?? 'text-on-surface'
            )}
          >
            {h.giaTri}
          </span>
        )}
        <span
          className={clsx(
            'material-symbols-outlined text-[18px] w-[18px] shrink-0 text-on-surface-variant transition-transform',
            h.moRong && 'rotate-90'
          )}
        >
          {h.moRong !== undefined || h.onClick ? 'chevron_right' : ''}
        </span>
      </>
    );
    const lop = clsx(
      cap === 2 ? LE_CAP2 : LE_CAP3,
      'w-full flex items-center gap-3 text-left',
      cap === 2 ? 'py-2.5' : 'py-2',
      h.onClick && 'hover:bg-surface-container-high/40 transition-colors'
    );
    return h.onClick ? (
      <button key={h.khoa} type="button" onClick={h.onClick} className={lop}>
        {noiDung}
      </button>
    ) : (
      <div key={h.khoa} className={lop}>
        {noiDung}
      </div>
    );
  };

  /** Tiêu đề nhỏ viết hoa ngăn các nhóm trong cấp 2. */
  const tieuDeMuc = (chu: string, phai?: ReactNode) => (
    <div className={clsx(LE_CAP2, 'pt-3 pb-2 flex items-center justify-between gap-3')}>
      <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-on-surface-variant">{chu}</span>
      {phai}
    </div>
  );

  /** Hàng nút cuối khung con. */
  const hangNut = (nut: ReactNode) => <div className={clsx(LE_CAP2, 'py-3 flex items-center gap-4')}>{nut}</div>;

  const nutChinh = 'px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold';

  const ai = du?.ai;
  const kenh = du?.kenh;
  const dc = du?.doiChieu ?? null;
  const tbNgay = ai?.tuanNayUsd ? ai.tuanNayUsd / 7 : 0;
  const thieuTien = du?.canhBao.some((c) => c.ma === 'ai_sap_het' || c.ma === 'ai_het_tien') ?? false;

  const moNhatKy = (loc: LocLuot, tieuDe: string) => setNhatKy({ loc, tieuDe });

  const kieuDoiChieu = !dc
    ? { ky: 'help', mau: 'text-on-surface-variant', chu: 'Chưa đối chiếu được với nhà cung cấp' }
    : dc.trangThai === 'khop'
      ? { ky: 'check_circle', mau: 'text-green-400', chu: 'Khớp tuyệt đối với nhà cung cấp' }
      : dc.trangThai === 'dang_cho'
        ? { ky: 'schedule', mau: 'text-amber-400', chu: `Đang chờ nhà cung cấp chốt ${dc.sauMoc.soLuotCho} lượt` }
        : { ky: 'error', mau: 'text-red-400', chu: `Lệch ${chiDu(Math.abs(dc.sauMoc.lechUsd)).replace('−', '')} so với nhà cung cấp` };

  return (
    <section className="mb-10 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="tieu-de-muc">Chi phí tháng này</h2>
        {(<button
          type="button"
          onClick={() => setMoCaiDat(!moCaiDat)}
          title="Cài đặt cảnh báo"
          className={clsx('material-symbols-outlined text-[20px]', moCaiDat ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface')}
        >
          settings
        </button>)}
      </div>

      {loi && <p className="mb-3 text-xs text-error">{loi}</p>}

      <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant/60 overflow-hidden">
        {dong('ai', 'AI', tienAi)}
        {/*
         * Sổ của app vẫn hiện khi nhà cung cấp tạm không trả lời. Đã thấy: điều
         * kiện ai.ok giấu sạch phần chi tiết — bấm vào không ra gì, không lý do.
         */}
        {mo === 'ai' && du && (
          <div className={KHUNG_CON}>
            {canhBao('ai').map((c) =>
              hang(2, {
                khoa: `cb-${c.ma}`,
                nhan: (
                  <span className={c.mucDo === 'nguy_cap' ? 'text-red-400' : c.mucDo === 'can_lam' ? 'text-amber-400' : 'text-on-surface-variant'}>
                    {c.noiDung}
                  </span>
                ),
              })
            )}

            {tieuDeMuc('Đối chiếu')}
            {hang(2, {
              khoa: 'doi-chieu',
              nhan: (
                <span className={clsx('flex items-center gap-2', kieuDoiChieu.mau)}>
                  <span className="material-symbols-outlined text-[18px]">{kieuDoiChieu.ky}</span>
                  {kieuDoiChieu.chu}
                </span>
              ),
              onClick: dc ? () => setMoDoiChieu(!moDoiChieu) : undefined,
              moRong: dc ? moDoiChieu : undefined,
            })}
            {moDoiChieu &&
              dc &&
              (
                [
                  ['Nhà cung cấp đã trừ, từ trước tới nay', dc.nhaCungCapUsd],
                  ['Sổ của app ghi, từ trước tới nay', dc.soAppUsd],
                  ...(daChi(dc.ngoaiSoTruocMocUsd)
                    ? [[`Ngoài sổ, trước ${ngayVN(dc.mocLuc)} (chạy thử, sổ cũ ghi thiếu)`, dc.ngoaiSoTruocMocUsd]]
                    : []),
                  [`Từ ${ngayVN(dc.mocLuc)}: nhà cung cấp trừ`, dc.sauMoc.nhaCungCapUsd],
                  // Chi NGOÀI app đã đối chiếu có căn cứ — hiện từng khoản (đã trừ trước khi so, không giấu).
                  ...dc.chiNgoaiSo.map((c) => [
                    `Đã đối chiếu: chi ngoài app — ${c.lyDo} (${ngayVN(c.tu)}${ngayVN(c.den) !== ngayVN(c.tu) ? `–${ngayVN(c.den)}` : ''})`,
                    c.usd,
                  ]),
                  [`Từ ${ngayVN(dc.mocLuc)}: sổ ghi`, dc.sauMoc.soDaChotUsd + dc.sauMoc.soChoUsd],
                ] as [string, number][]
              ).map(([k, v]) => hang(3, { khoa: `dc-${k}`, nhan: k, giaTri: chiDu(v), mauGiaTri: mauChi(v) }))}

            {ai?.ok && ai.conLaiUsd !== undefined && (
              <>
                {tieuDeMuc('Số dư')}
                {hang(2, {
                  khoa: 'con-lai',
                  nhan: 'Còn lại',
                  giaTri: `${so(ai.conLaiUsd ?? 0)} USD${tbNgay > 0 ? ` · đủ ~${Math.floor((ai.conLaiUsd ?? 0) / tbNgay)} ngày` : ''}`,
                  mauGiaTri: thieuTien ? 'text-amber-400' : 'text-green-400',
                })}
              </>
            )}

            {tieuDeMuc(
              'Tháng này',
              <div className="flex gap-1">
                {(
                  [
                    ['viec', 'Theo việc'],
                    ['taiKhoan', 'Theo tài khoản'],
                  ] as const
                ).map(([k, ten]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCachXem(k)}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-[11px] font-bold',
                      cachXem === k ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface'
                    )}
                  >
                    {ten}
                  </button>
                ))}
              </div>
            )}

            {cachXem === 'viec' &&
              du.so.theoNhom.flatMap((g) => [
                hang(2, {
                  khoa: `n-${g.nhom}`,
                  nhan: g.ten,
                  phu: `${g.lan.toLocaleString('vi-VN')} lượt`,
                  giaTri: chiDu(g.usd),
                  mauGiaTri: mauChi(g.usd),
                  onClick: () => setMoNhom(moNhom === g.nhom ? null : g.nhom),
                  moRong: moNhom === g.nhom,
                }),
                ...(moNhom === g.nhom
                  ? g.viec.map((v) =>
                      hang(3, {
                        khoa: `v-${g.nhom}-${v.viec}`,
                        nhan: v.ten,
                        phu: `${v.lan.toLocaleString('vi-VN')} lượt`,
                        giaTri: chiDu(v.usd),
                        mauGiaTri: mauChi(v.usd),
                        onClick: () => moNhatKy({ viec: v.viec ?? 'chua_phan_loai' }, v.ten),
                      })
                    )
                  : []),
              ])}

            {cachXem === 'taiKhoan' &&
              cay.map((t) =>
                hang(2, {
                  khoa: `t-${t.userId}`,
                  nhan: t.ten,
                  phu: `${t.lan.toLocaleString('vi-VN')} lượt`,
                  giaTri: chiDu(t.usd),
                  mauGiaTri: mauChi(t.usd),
                  onClick: () => moNhatKy({ tk: t.userId ?? 'chung' }, t.ten),
                })
              )}

            {du.so.theoNhom.length === 0 && hang(2, { khoa: 'trong', nhan: 'Tháng này chưa dùng AI.' })}

            {hangNut(
              <>
                {du.linkNap && (
                  <a href={du.linkNap.openrouter} target="_blank" rel="noreferrer" className={nutChinh}>
                    Nạp tiền AI
                  </a>
                )}
                <button type="button" onClick={() => moNhatKy({}, 'Từng lượt dùng AI')} className="text-xs text-primary hover:underline">
                  Xem từng lượt ›
                </button>
              </>
            )}
          </div>
        )}

        {dong('kenh', 'Kết nối kênh', tienKenh)}
        {mo === 'kenh' && kenh && (
          <div className={KHUNG_CON}>
            {canhBao('kenh').map((c) =>
              hang(2, {
                khoa: `cb-${c.ma}`,
                nhan: (
                  <span className={c.mucDo === 'nguy_cap' ? 'text-red-400' : c.mucDo === 'can_lam' ? 'text-amber-400' : 'text-on-surface-variant'}>
                    {c.noiDung}
                  </span>
                ),
              })
            )}
            {kenh.ok && (
              <>
                {hang(2, {
                  khoa: 'trang-thai',
                  nhan: 'Trạng thái',
                  giaTri: kenh.conHoatDong ? 'Đang hoạt động' : `Tạm dừng — ${kenh.lyDoTamDung ?? 'chưa thanh toán'}`,
                  mauGiaTri: kenh.conHoatDong ? 'text-green-400' : 'text-red-400',
                })}
                {hang(2, {
                  khoa: 'can-tra',
                  nhan: 'Cần trả',
                  giaTri: kenh.canTraUsd ? chi(kenh.canTraUsd) : 'Không',
                  mauGiaTri: mauChi(kenh.canTraUsd),
                })}
                {hang(2, { khoa: 'goi', nhan: 'Gói', giaTri: kenh.goi ?? '—', mauGiaTri: 'text-on-surface-variant' })}
              </>
            )}
            {hangNut(
              <a
                href={(kenh.ok && kenh.linkHoaDon) || du?.linkNap?.kenh}
                target="_blank"
                rel="noreferrer"
                className={nutChinh}
              >
                {kenh.ok && kenh.linkHoaDon ? 'Trả hoá đơn' : 'Trang thanh toán'}
              </a>
            )}
          </div>
        )}

        <div className="px-5 py-4 flex items-center gap-3 bg-surface-container-high">
          <span className="w-2.5 shrink-0" />
          <span className="flex-1 text-base font-bold text-on-surface">Tổng</span>
          <span className="text-right">
            <span className={clsx('block text-xl font-bold tabular-nums', du ? mauChi(tong) : 'text-on-surface-variant')}>
              {du ? chi(tong) : '—'}
            </span>
            {du && <span className={clsx('block text-[11px] tabular-nums', daChi(tong) ? 'text-red-400/70' : 'text-on-surface-variant')}>{vnd(tong)}</span>}
            {/* Chưa đọc được kênh thì tổng chưa đủ — nói rõ, không để tưởng là tổng thật. */}
            {du && tienKenh === null && <span className="block text-[11px] text-on-surface-variant">chưa gồm kết nối kênh</span>}
          </span>
          <span className="w-6 shrink-0" />
        </div>
      </div>

      {moCaiDat && nguong && (
        <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container p-5 space-y-3">
          <p className="text-xs text-on-surface-variant">Nhắn Telegram khi:</p>
          {(
            [
              ['soDuToiThieuUsd', 'Tiền AI còn dưới (USD)', 0.5],
              ['soNgayToiThieu', 'Hoặc chỉ còn đủ dưới (ngày)', 1],
              ['heSoTieuQua', 'Tiêu trong ngày gấp (lần) mức thường', 0.5],
            ] as const
          ).map(([khoa, ten, buoc]) => (
            <label key={khoa} className="flex items-center justify-between gap-3 text-xs text-on-surface">
              {ten}
              <input
                type="number"
                step={buoc}
                value={nguong[khoa]}
                onChange={(e) => setNguong({ ...nguong, [khoa]: Number(e.target.value) })}
                className="bg-surface-container-high w-24 rounded-lg border border-outline-variant px-2 py-1 text-right text-on-surface"
              />
            </label>
          ))}
          <p className="text-[11px] text-on-surface-variant">Kết nối kênh bị dừng hoặc có hoá đơn thì luôn nhắn.</p>
          {thongBao && <p className="text-[11px] text-primary">{thongBao}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setNguong((await api.admin.luuNguongChiPhi(nguong)).data);
                  setThongBao('Đã lưu.');
                  void tai();
                } catch (error) {
                  setThongBao(error instanceof ApiError ? error.message : 'Chưa lưu được');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.admin.thuCanhBaoChiPhi();
                  setThongBao('Đã gửi thử tới Telegram của bạn.');
                } catch (error) {
                  setThongBao(error instanceof ApiError ? error.message : 'Chưa gửi được');
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold"
            >
              Gửi thử
            </button>
          </div>
        </div>
      )}
      {nhatKy && <NhatKyChiPhi loc={nhatKy.loc} tieuDe={nhatKy.tieuDe} onDong={() => setNhatKy(null)} />}
    </section>
  );
}

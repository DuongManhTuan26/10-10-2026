import { useCallback, useEffect, useMemo, useState } from 'react';
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
/** [nhãn, giá trị, màu chữ của giá trị]. Giá trị rỗng = tiêu đề nhóm. */
type Hang = [string, string, string?];
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

/**
 * Cây tài khoản: tài khoản cha (admin con) đứng trên, tài khoản trang của nó
 * thụt vào dưới. Mỗi tài khoản giữ tiền RIÊNG; dòng cha có thêm tổng cả chuỗi.
 */
function dungCay(ds: TaiKhoan[]) {
  // Chỉ có hai tầng: admin con không có cha, tài khoản trang trỏ về admin con.
  const con = new Map<number, TaiKhoan[]>();
  for (const t of ds) if (t.chaId !== null) con.set(t.chaId, [...(con.get(t.chaId) ?? []), t]);
  const goc = ds.filter((t) => t.chaId === null);
  // Cha chưa tiêu gì nhưng con có tiêu: vẫn dựng dòng cha (tiền riêng = 0).
  for (const [chaId, dsCon] of con) {
    if (!goc.some((t) => t.userId === chaId)) {
      goc.push({ userId: chaId, ten: dsCon[0].chaTen ?? `Tài khoản #${chaId}`, email: null, vaiTro: 'admin_con', chaId: null, chaTen: null, lan: 0, usd: 0 });
    }
  }
  return goc
    .map((t) => {
      const cacCon = t.userId !== null ? (con.get(t.userId) ?? []).sort((a, b) => b.usd - a.usd) : [];
      return { ...t, con: cacCon, tongChuoi: t.usd + cacCon.reduce((tong, c) => tong + c.usd, 0) };
    })
    .sort((a, b) => b.tongChuoi - a.tongChuoi);
}

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
  const cay = useMemo(() => dungCay(du?.so.theoTaiKhoan ?? []), [du]);
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
          <span className="block text-sm font-bold text-on-surface">{ten}</span>
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

  const chiTiet = (hang: Hang[], nut?: { ten: string; link?: string }) => (
    <div className="px-5 pb-4 pl-[2.6rem] space-y-1.5">
      {hang.map(([k, v, mau]) => (
        <div key={k} className={clsx('flex justify-between gap-4 text-xs', !v && 'pt-2')}>
          <span className={v ? 'text-on-surface-variant' : 'text-[11px] font-bold text-primary'}>{k}</span>
          <span className={clsx('tabular-nums text-right', mau ?? 'text-on-surface')}>{v}</span>
        </div>
      ))}
      {nut?.link && (
        <a href={nut.link} target="_blank" rel="noreferrer" className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">
          {nut.ten}
        </a>
      )}
    </div>
  );

  const ai = du?.ai;
  const kenh = du?.kenh;
  const dc = du?.doiChieu ?? null;
  const tbNgay = ai?.tuanNayUsd ? ai.tuanNayUsd / 7 : 0;
  const thieuTien = du?.canhBao.some((c) => c.ma === 'ai_sap_het' || c.ma === 'ai_het_tien') ?? false;

  const moNhatKy = (loc: LocLuot, tieuDe: string) => setNhatKy({ loc, tieuDe });

  /** Một dòng bấm được trong phần con: tên, số lượt, số tiền. */
  const dongCon = (khoa: string, ten: string, lan: number, usd: number, onClick: () => void, thut = false, dam = false) => (
    <button
      key={khoa}
      type="button"
      onClick={onClick}
      className={clsx('w-full flex items-center gap-3 py-1.5 text-xs text-left hover:bg-surface-container-high/40 rounded', thut && 'pl-4')}
    >
      <span className={clsx('flex-1 min-w-0 truncate', dam ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>{ten}</span>
      <span className="text-on-surface-variant/70 tabular-nums">{lan.toLocaleString('vi-VN')} lượt</span>
      <span className={clsx('shrink-0 text-right tabular-nums whitespace-nowrap', dam && 'font-bold', mauChi(usd))}>{chiDu(usd)}</span>
    </button>
  );

  const dongDoiChieu = () => {
    const kieu = !dc
      ? { ky: 'help', mau: 'text-on-surface-variant', chu: 'Chưa đối chiếu được với nhà cung cấp' }
      : dc.trangThai === 'khop'
        ? { ky: 'check_circle', mau: 'text-green-400', chu: 'Khớp tuyệt đối với nhà cung cấp' }
        : dc.trangThai === 'dang_cho'
          ? { ky: 'schedule', mau: 'text-amber-400', chu: `Đang chờ nhà cung cấp chốt ${dc.sauMoc.soLuotCho} lượt` }
          : { ky: 'error', mau: 'text-red-400', chu: `Lệch ${chiDu(Math.abs(dc.sauMoc.lechUsd)).replace('−', '')} so với nhà cung cấp` };
    return (
      <div>
        <button type="button" onClick={() => setMoDoiChieu(!moDoiChieu)} className={clsx('w-full flex items-center gap-2 text-xs text-left', kieu.mau)}>
          <span className="material-symbols-outlined text-[16px]">{kieu.ky}</span>
          <span className="flex-1 font-bold">{kieu.chu}</span>
          <span className={clsx('material-symbols-outlined text-[16px] transition-transform', moDoiChieu && 'rotate-90')}>chevron_right</span>
        </button>
        {moDoiChieu && dc && (
          <div className="mt-1.5 pl-6 space-y-1 text-xs">
            {(
              [
                ['Nhà cung cấp đã trừ, từ trước tới nay', dc.nhaCungCapUsd],
                ['Sổ của app ghi, từ trước tới nay', dc.soAppUsd],
                ...(daChi(dc.ngoaiSoTruocMocUsd)
                  ? [[`Ngoài sổ, trước ${ngayVN(dc.mocLuc)} (chạy thử, sổ cũ ghi thiếu)`, dc.ngoaiSoTruocMocUsd]]
                  : []),
                [`Từ ${ngayVN(dc.mocLuc)}: nhà cung cấp trừ`, dc.sauMoc.nhaCungCapUsd],
                [`Từ ${ngayVN(dc.mocLuc)}: sổ ghi`, dc.sauMoc.soDaChotUsd + dc.sauMoc.soChoUsd],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-on-surface-variant min-w-0">{k}</span>
                <span className={clsx('tabular-nums text-right whitespace-nowrap shrink-0', mauChi(v))}>{chiDu(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="mb-10 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[11px] font-bold text-primary tracking-wider uppercase">Chi phí tháng này</h2>
        <button
          type="button"
          onClick={() => setMoCaiDat(!moCaiDat)}
          title="Cài đặt cảnh báo"
          className={clsx('material-symbols-outlined text-[20px]', moCaiDat ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface')}
        >
          settings
        </button>
      </div>

      {loi && <p className="mb-3 text-xs text-error">{loi}</p>}

      <div className="rounded-2xl border border-outline-variant bg-surface-container/40 divide-y divide-outline-variant/60 overflow-hidden">
        {dong('ai', 'AI', tienAi)}
        {/*
         * Sổ của app vẫn hiện khi nhà cung cấp tạm không trả lời. Đã thấy: điều
         * kiện ai.ok giấu sạch phần chi tiết — bấm vào không ra gì, không lý do.
         */}
        {mo === 'ai' && du && (
          <div className="px-5 pb-4 pl-[2.6rem] space-y-3">
            {canhBao('ai').map((c) => (
              <p key={c.ma} className={clsx('text-xs', c.mucDo === 'nguy_cap' ? 'text-red-400' : c.mucDo === 'can_lam' ? 'text-amber-400' : 'text-on-surface-variant')}>
                {c.noiDung}
              </p>
            ))}

            {dongDoiChieu()}

            {ai?.ok && (
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-on-surface-variant">Còn lại</span>
                <span className={clsx('tabular-nums', thieuTien ? 'text-amber-400' : 'text-green-400')}>
                  {so(ai.conLaiUsd ?? 0)} USD{tbNgay > 0 ? ` · đủ ~${Math.floor((ai.conLaiUsd ?? 0) / tbNgay)} ngày` : ''}
                </span>
              </div>
            )}

            <div>
              <div className="flex gap-1 mb-1.5">
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

              {cachXem === 'viec' &&
                du.so.theoNhom.map((g) => (
                  <div key={g.nhom}>
                    {dongCon(`n-${g.nhom}`, g.ten, g.lan, g.usd, () => setMoNhom(moNhom === g.nhom ? null : g.nhom), false, true)}
                    {moNhom === g.nhom &&
                      g.viec.map((v) =>
                        dongCon(`v-${v.viec}`, v.ten, v.lan, v.usd, () => moNhatKy({ viec: v.viec ?? 'chua_phan_loai' }, v.ten), true)
                      )}
                  </div>
                ))}

              {cachXem === 'taiKhoan' &&
                cay.map((t) => (
                  <div key={`t-${t.userId}`}>
                    {dongCon(
                      `t-${t.userId}`,
                      t.con.length ? `${t.ten} — cả chuỗi` : t.ten,
                      t.lan + t.con.reduce((s2, c) => s2 + c.lan, 0),
                      t.tongChuoi,
                      () => moNhatKy({ tk: t.userId ?? 'chung', kemCon: t.con.length > 0 }, t.con.length ? `${t.ten} — cả chuỗi` : t.ten),
                      false,
                      true
                    )}
                    {t.con.length > 0 && daChi(t.usd) &&
                      dongCon(`r-${t.userId}`, `${t.ten} — riêng`, t.lan, t.usd, () => moNhatKy({ tk: t.userId ?? 'chung' }, `${t.ten} — riêng`), true)}
                    {t.con.map((c) => dongCon(`c-${c.userId}`, c.ten, c.lan, c.usd, () => moNhatKy({ tk: c.userId ?? 'chung' }, c.ten), true))}
                  </div>
                ))}

              {du.so.theoNhom.length === 0 && <p className="text-xs text-on-surface-variant py-1.5">Tháng này chưa dùng AI.</p>}
            </div>

            <div className="flex items-center gap-4">
              <a
                href={du.linkNap.openrouter}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
              >
                Nạp tiền AI
              </a>
              <button type="button" onClick={() => moNhatKy({}, 'Từng lượt dùng AI')} className="text-xs text-primary hover:underline">
                Xem từng lượt ›
              </button>
            </div>
          </div>
        )}

        {dong('kenh', 'Kết nối kênh', tienKenh)}
        {mo === 'kenh' && kenh && !kenh.ok && (
          <div className="px-5 pb-4 pl-[2.6rem]">
            <p className="text-xs text-on-surface-variant">Chưa đọc được nhà cung cấp kênh: {kenh.loi ?? 'không rõ lý do'}</p>
            <a href={du?.linkNap.kenh} target="_blank" rel="noreferrer" className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold">
              Trang thanh toán
            </a>
          </div>
        )}
        {mo === 'kenh' &&
          kenh?.ok &&
          chiTiet(
            [
              [
                'Trạng thái',
                kenh.conHoatDong ? 'Đang hoạt động' : `Tạm dừng — ${kenh.lyDoTamDung ?? 'chưa thanh toán'}`,
                kenh.conHoatDong ? 'text-green-400' : 'text-red-400',
              ],
              ['Cần trả', kenh.canTraUsd ? chi(kenh.canTraUsd) : 'Không', mauChi(kenh.canTraUsd)],
              ['Gói', kenh.goi ?? '—'],
            ],
            { ten: kenh.linkHoaDon ? 'Trả hoá đơn' : 'Trang thanh toán', link: kenh.linkHoaDon ?? du?.linkNap.kenh }
          )}

        <div className="px-5 py-4 flex items-center gap-3 bg-surface-container-high/30">
          <span className="w-2.5 shrink-0" />
          <span className="flex-1 text-sm font-bold text-on-surface">Tổng</span>
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
        <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container/40 p-5 space-y-3">
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
                className="w-24 bg-surface rounded-lg border border-outline-variant px-2 py-1 text-right text-on-surface"
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

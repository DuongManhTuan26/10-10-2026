import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type BaoCaoDieuHanh, type ChiSoSucKhoe, type Conversation, type SucKhoeTrang } from '../lib/api';
import { BON_AI } from '../lib/bon-ai';

/*
 * KHỐI NÃO "4 VĂN PHÒNG" (chủ dự án 30/10/2026 — ảnh mẫu, đồng ý dùng chính ảnh làm nền cảnh, 0 đ).
 *
 * Ảnh public/giao-dien/khoi-nao.webp (1975×660, cắt sát khung vàng) CHỈ là phông cảnh: người, bàn, quả địa cầu, lan can.
 * Mọi màn hình có SỐ trong ảnh được ĐÈ bằng khung HTML thật hiện số THẬT của cửa hàng (báo cáo AI Điều hành + bảng sức
 * khoẻ + hộp thư) — số mẫu trong ảnh (12.5tr, 92%, ROAS…) không bao giờ lộ ra. Chưa có số → "Chưa đủ dữ liệu" / "—".
 * Toạ độ đo trên ảnh (px ảnh); chữ co theo bề rộng khối (cqw) nên khung luôn khớp ảnh ở mọi bề rộng.
 * Màn hẹp (< xl): 4 thẻ, mỗi thẻ cắt đúng cảnh văn phòng của AI đó + số thật bên dưới.
 */

const ANH = '/giao-dien/khoi-nao.webp';
const W = 1975;
const H = 660;
/** px ảnh → đơn vị theo bề rộng khối. */
const p = (n: number) => `${((n / W) * 100).toFixed(3)}cqw`;
const hop = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`,
});

const [NOI_DUNG, QUANG_CAO, BAN_HANG, DIEU_HANH] = BON_AI;

/** Tiền VND gọn: 12,5 tr · 850.000 đ · 0 đ. */
function vnd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return `${Math.round(v).toLocaleString('vi-VN')} đ`;
}
const so = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('vi-VN'));
const phanTram = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

/** Giá trị chỉ số sức khoẻ đúng đơn vị (giống TongQuanBoNao cũ). */
function giaTriChiSo(c: ChiSoSucKhoe | undefined): string {
  const v = c?.gan.giaTri;
  if (v === null || v === undefined) return '—';
  return c!.donVi === 'ti_le' ? phanTram(v) : v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}
/** Độ dài thanh "sức khoẻ" theo MỨC do code thống kê chấm (không phải số bịa): mạnh / ổn / tụt / chưa đủ. */
const DAI_THANH = { dang_manh: 92, on: 64, tut: 30, chua_du: 0 } as const;
const CHU_MUC = { dang_manh: 'Đang mạnh', on: 'Ổn', tut: 'Tụt', chua_du: 'Chưa đủ dữ liệu' } as const;

export interface SoLieuKhoiNao {
  bao: BaoCaoDieuHanh | null;
  suc: SucKhoeTrang | null;
  hoiThoai: Conversation[];
}

/** Đọc số thật cho khối não của cửa hàng đang chọn (3 lời gọi sẵn có, chỉ đọc). */
export function useSoLieuKhoiNao(trangId: number | null | undefined): SoLieuKhoiNao & { loi: string } {
  const [bao, setBao] = useState<BaoCaoDieuHanh | null>(null);
  const [suc, setSuc] = useState<SucKhoeTrang | null>(null);
  const [hoiThoai, setHoiThoai] = useState<Conversation[]>([]);
  const [loi, setLoi] = useState('');
  useEffect(() => {
    if (!trangId) return;
    let huy = false;
    setBao(null); setSuc(null); setHoiThoai([]); setLoi('');
    api.dieuHanh.baoCao('thang_nay').then(({ data }) => !huy && setBao(data)).catch(() => !huy && setLoi('Chưa tải được'));
    api.dieuHanh.sucKhoe().then(({ data }) => !huy && setSuc(data)).catch(() => !huy && setLoi('Chưa tải được'));
    api.inbox.conversations({ soDong: 4 }).then(({ data }) => !huy && setHoiThoai(data.slice(0, 4))).catch(() => {});
    return () => { huy = true; };
  }, [trangId]);
  return { bao, suc, hoiThoai, loi };
}

/**
 * Vị trí 3 NHÂN VIÊN NỮ trong ảnh (tâm đầu, px ảnh — đo 30/10/2026). Khung số của ①②③ KHOÉT hình đầu + vai đúng chỗ
 * này (viền mềm) để người ngồi TRƯỚC màn hình luôn lộ ra — chủ dự án: không che đầu, sau này làm chuyển động cho họ.
 */
export const NHAN_VIEN: Record<'noi_dung' | 'quang_cao' | 'ban_hang', { cx: number; cy: number }> = {
  noi_dung: { cx: 316, cy: 470 },
  quang_cao: { cx: 983, cy: 470 },
  ban_hang: { cx: 1666, cy: 482 },
};

/** Một màn hình đè lên ảnh: kính tối viền màu AI, phát sáng nhẹ. `khoet` = tâm đầu nhân viên (px ảnh) → khoét đầu + vai. */
function ManHinh({ x, y, w, h, mau, khoet, children }: { x: number; y: number; w: number; h: number; mau: string; khoet?: { cx: number; cy: number }; children: ReactNode }) {
  const mask = khoet
    ? `radial-gradient(ellipse ${p(31)} ${p(44)} at ${p(khoet.cx - x)} ${p(khoet.cy - y)}, transparent 78%, #000 100%), ` +
      `radial-gradient(ellipse ${p(50)} ${p(36)} at ${p(khoet.cx - x)} ${p(khoet.cy - y + 46)}, transparent 78%, #000 100%)`
    : undefined;
  return (
    <div
      className="absolute overflow-hidden pointer-events-none flex flex-col"
      style={{
        ...hop(x, y, w, h),
        background: 'linear-gradient(180deg, rgba(10,22,36,0.96) 0%, rgba(5,12,22,0.96) 100%)',
        border: `1px solid ${mau}bb`,
        borderRadius: p(10),
        boxShadow: `0 0 ${p(14)} ${mau}66, inset 0 0 ${p(18)} ${mau}26`,
        padding: `${p(8)} ${p(12)}`,
        color: '#E8EDF2',
        ...(mask ? { WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' } : {}),
      }}
    >
      {children}
    </div>
  );
}
const tieuDe = (chu: string, phu?: string, mau?: string) => (
  <div className="flex items-baseline justify-between gap-1 whitespace-nowrap" style={{ fontSize: p(21), fontWeight: 800, color: mau }}>
    <span className="truncate">{chu}</span>
    {phu && <span style={{ fontSize: p(16), fontWeight: 500, opacity: 0.6, color: '#E8EDF2' }}>{phu}</span>}
  </div>
);

/** Cột theo ngày (chỉ vẽ khi có số; toàn 0 → vạch đáy + "Chưa có"). */
function Cot({ giaTri, mau }: { giaTri: number[]; mau: string }) {
  const max = Math.max(0, ...giaTri);
  if (max <= 0) {
    return (
      <div className="flex-1 flex flex-col justify-end">
        <div style={{ fontSize: p(15), opacity: 0.55 }}>Chưa có số trong kỳ</div>
        <div style={{ height: '1px', background: `${mau}55`, marginTop: p(4) }} />
      </div>
    );
  }
  return (
    <div className="flex-1 flex items-end" style={{ gap: p(3) }}>
      {giaTri.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-[1px]" style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: `linear-gradient(180deg, ${mau}, ${mau}55)` }} />
      ))}
    </div>
  );
}

/** Một con số: nhãn nhỏ trên, số to dưới. `co` = cỡ số (px ảnh). */
function HangSo({ ten, giaTri, mau, co = 34, coNhan = 17 }: { ten: string; giaTri: string; mau?: string; co?: number; coNhan?: number }) {
  return (
    <div className="min-w-0">
      <div className="truncate" style={{ fontSize: p(coNhan), opacity: 0.7, lineHeight: 1.2 }}>{ten}</div>
      <div className="truncate" style={{ fontSize: p(co), fontWeight: 800, color: mau ?? '#FFFFFF', lineHeight: 1.1 }}>{giaTri}</div>
    </div>
  );
}

/** Tóm số của từng AI — dùng chung cho bản ảnh lớn và thẻ màn hẹp. */
function tomSo(s: SoLieuKhoiNao) {
  const c = s.bao?.chuoi;
  const vndQc = c?.quangCao.theoTienTe.find((t) => t.tienTe === 'VND');
  const ngay = (s.bao?.theoNgay ?? []).slice(-12);
  const viecCan = s.suc ? s.suc.suCo.length + s.suc.uuTien.length : null;
  return {
    co: !!c,
    doanhThu: c ? c.banHang.doanhThu : null,
    don: c ? c.banHang.soDon : null,
    hoiThoaiMoi: c ? c.banHang.hoiThoaiMoi : null,
    tiLeChot: c ? c.banHang.tiLeChot : null,
    tinAi: c ? c.banHang.tinAiTraLoi : null,
    baiDang: c ? c.noiDung.baiDang : null,
    baiAi: c ? c.noiDung.baiAi : null,
    hienThiBai: c ? c.noiDung.hienThi : null,
    tuongTac: c ? c.noiDung.tuongTac : null,
    chiQc: vndQc ? vndQc.chiTieu : c ? 0 : null,
    hienThiQc: vndQc ? vndQc.hienThi : c ? 0 : null,
    nhapQc: vndQc ? vndQc.nhap : c ? 0 : null,
    ctr: vndQc && vndQc.hienThi > 0 ? vndQc.nhap / vndQc.hienThi : null,
    soQc: c ? c.quangCao.soQuangCao : null,
    doanhThuNgay: ngay.map((n) => n.doanhThu),
    viecCan,
  };
}

/**
 * Cảnh đầy đủ: ảnh nền + màn hình số thật đè đúng chỗ + 4 vùng bấm sang 4 AI. `khung` (px ảnh) = chỉ nhìn một phần cảnh
 * (thẻ màn hẹp) — cả cảnh vẫn vẽ đủ, đã đè số thật, nên số mẫu trong ảnh KHÔNG lộ ở bất kỳ khổ nào.
 */
export function KhoiNaoAnh({ s, tenCuaHang, khung }: { s: SoLieuKhoiNao; tenCuaHang: string; khung?: [number, number, number, number] }) {
  const [kx, ky, kw, kh] = khung ?? [0, 0, W, H];
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${kw} / ${kh}`, borderRadius: khung ? undefined : '18px' }}>
      <div className="absolute" style={{ width: `${(W / kw) * 100}%`, left: `${(-kx / kw) * 100}%`, top: `${(-ky / kh) * 100}%` }}>
        <Canh s={s} tenCuaHang={tenCuaHang} />
      </div>
    </div>
  );
}

function Canh({ s, tenCuaHang }: { s: SoLieuKhoiNao; tenCuaHang: string }) {
  const t = tomSo(s);
  const dang = !t.co;
  const v = (x: string) => (dang ? '…' : x);
  const chiSo = (khau: ChiSoSucKhoe['khau']) => s.suc?.chiSo.find((c) => c.khau === khau);

  const vung = (a: (typeof BON_AI)[number], x: number, y: number, w: number, h: number) => (
    <Link key={a.ma} to={a.duong} aria-label={`Vào ${a.ten}`} title={`Vào ${a.ten}`} className="absolute rounded-[3%] transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2" style={{ ...hop(x, y, w, h), outlineColor: a.hex }} />
  );

  return (
    <div className="relative w-full" style={{ containerType: 'inline-size', aspectRatio: `${W} / ${H}` }}>
      <img src={ANH} alt="" aria-hidden className="absolute inset-0 w-full h-full select-none" draggable={false} />

      {/* Vùng bấm: ④ phía trên, ①②③ ba văn phòng dưới. */}
      {vung(DIEU_HANH, 470, 0, 1030, 300)}
      {vung(NOI_DUNG, 60, 300, 610, 360)}
      {vung(QUANG_CAO, 680, 300, 610, 360)}
      {vung(BAN_HANG, 1300, 300, 640, 360)}

      {/* Đầu khối: tên cửa hàng THẬT (che chữ mẫu trong ảnh) + nút Đổi cửa hàng thật. */}
      <div className="absolute pointer-events-none flex items-center" style={{ ...hop(52, 34, 430, 84), gap: p(14), background: 'radial-gradient(ellipse at 35% 50%, rgba(4,8,12,0.96) 55%, rgba(4,8,12,0.0) 100%)' }}>
        <span className="flex items-center justify-center shrink-0" style={{ width: p(70), height: p(64), borderRadius: p(14), border: '1.5px solid #F5C451', boxShadow: `0 0 ${p(12)} rgba(245,196,81,0.7), inset 0 0 ${p(10)} rgba(245,196,81,0.3)` }}>
          <span className="material-symbols-outlined" style={{ fontSize: p(40), color: '#FFD978' }}>psychology</span>
        </span>
        <span className="min-w-0">
          <span className="block font-extrabold text-white" style={{ fontSize: p(30), lineHeight: 1.1 }}>Bộ não AI</span>
          <span className="block truncate" style={{ fontSize: p(16), color: '#E8EDF2' }}>
            cửa hàng <b>{tenCuaHang}</b> · 4 AI làm việc liền mạch
          </span>
        </span>
      </div>
      <Link
        to="/ket-noi"
        className="absolute flex items-center justify-center font-bold text-white hover:brightness-125"
        style={{ ...hop(1742, 48, 176, 54), gap: p(8), fontSize: p(16), borderRadius: p(14), border: '1.5px solid #F5C451', background: 'rgba(8,10,14,0.92)', boxShadow: `0 0 ${p(10)} rgba(245,196,81,0.45)` }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: p(24) }}>storefront</span>
        Đổi cửa hàng
      </Link>

      {/* ④ ĐIỀU HÀNH — trái: doanh thu tháng + cột theo ngày (chữ to, đọc được ở 1440) */}
      <ManHinh x={522} y={98} w={208} h={170} mau="#38bdf8">
        {tieuDe('Doanh thu')}
        <div style={{ fontSize: p(42), fontWeight: 800, lineHeight: 1.1, marginTop: p(4) }}>{v(vnd(t.doanhThu))}</div>
        <div style={{ fontSize: p(16), color: '#4ade80', marginBottom: p(4) }}>{v(`${so(t.don)} đơn · tháng này`)}</div>
        <Cot giaTri={t.doanhThuNgay} mau="#38bdf8" />
      </ManHinh>
      {/* ④ — giữa trái: đơn / hội thoại mới / tỉ lệ chốt */}
      <ManHinh x={732} y={98} w={124} h={170} mau="#38bdf8">
        <div className="flex flex-col justify-between h-full">
          <HangSo ten="Đơn hàng" giaTri={v(so(t.don))} co={28} coNhan={15} />
          <HangSo ten="Hội thoại mới" giaTri={v(so(t.hoiThoaiMoi))} co={28} coNhan={15} />
          <HangSo ten="Tỉ lệ chốt" giaTri={v(phanTram(t.tiLeChot))} co={28} coNhan={15} />
        </div>
      </ManHinh>
      {/* ④ — phải: sức khoẻ 3 AI (mức do code chấm, không phải % bịa) */}
      <ManHinh x={1168} y={98} w={288} h={170} mau="#38bdf8">
        {tieuDe('Sức khoẻ 3 AI', '7 ngày')}
        <div className="flex flex-col justify-around flex-1" style={{ marginTop: p(2) }}>
          {[NOI_DUNG, QUANG_CAO, BAN_HANG].map((a) => {
            const c = chiSo(a.khau as ChiSoSucKhoe['khau']);
            const muc = c?.muc ?? 'chua_du';
            return (
              <div key={a.ma} className="flex items-center" style={{ gap: p(8) }}>
                <span className="flex items-center justify-center shrink-0 rounded-full font-bold" style={{ width: p(28), height: p(28), fontSize: p(16), color: '#0b0f14', background: a.hex }}>{a.so}</span>
                <span className="shrink-0 truncate" style={{ fontSize: p(16), width: p(118) }}>{a.ten}</span>
                <span className="flex-1 rounded-full overflow-hidden" style={{ height: p(10), background: 'rgba(255,255,255,0.08)' }}>
                  <span className="block h-full rounded-full" style={{ width: `${DAI_THANH[muc]}%`, background: a.hex, boxShadow: `0 0 ${p(6)} ${a.hex}` }} />
                </span>
                <span className="shrink-0 text-right truncate" style={{ fontSize: p(16), fontWeight: 800, width: p(44) }} title={c ? `${c.ten}: ${CHU_MUC[muc]}` : undefined}>
                  {s.suc ? (muc === 'chua_du' ? '—' : giaTriChiSo(c)) : '…'}
                </span>
              </div>
            );
          })}
        </div>
      </ManHinh>
      {/* ④ — đỉnh quả địa cầu (không che người điều hành): việc cần xử lý */}
      <div className="absolute pointer-events-none flex items-center justify-center" style={hop(870, 92, 260, 34)}>
        <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: p(17), padding: `${p(3)} ${p(14)}`, color: '#facc15', background: 'rgba(10,8,2,0.88)', border: '1px solid rgba(250,204,21,0.7)', boxShadow: `0 0 ${p(12)} rgba(250,204,21,0.45)` }}>
          {t.viecCan === null ? 'Đang chấm…' : t.viecCan > 0 ? `${t.viecCan} việc cần xử lý trước` : 'Không có việc gấp'}
        </span>
      </div>

      {/* ① NỘI DUNG — trải hết dãy màn hình, khoét chỗ nhân viên ngồi: số bên trái / bên phải người. */}
      <ManHinh x={140} y={378} w={462} h={134} mau={NOI_DUNG.hex} khoet={NHAN_VIEN.noi_dung}>
        {tieuDe('Bài đăng tháng này', undefined, NOI_DUNG.hex)}
        <div className="grid flex-1 items-end" style={{ gridTemplateColumns: '28% 16% 1fr 1fr 1fr', columnGap: p(6) }}>
          <HangSo ten="Đã đăng" giaTri={v(so(t.baiDang))} mau={NOI_DUNG.hex} />
          <span />
          <HangSo ten="AI viết" giaTri={v(so(t.baiAi))} co={30} coNhan={15} />
          <HangSo ten="Hiển thị" giaTri={v(so(t.hienThiBai))} co={30} coNhan={15} />
          <HangSo ten="Tương tác" giaTri={v(so(t.tuongTac))} co={30} coNhan={15} />
        </div>
      </ManHinh>

      {/* ② QUẢNG CÁO — chi tiêu (trái người) + tỉ lệ nhấp (phải người); app chưa đo ROAS → không hiện ROAS. */}
      <ManHinh x={776} y={378} w={428} h={132} mau={QUANG_CAO.hex} khoet={NHAN_VIEN.quang_cao}>
        {tieuDe('Quảng cáo tháng này', undefined, QUANG_CAO.hex)}
        <div className="grid flex-1 items-end" style={{ gridTemplateColumns: '38% 1fr 40%', columnGap: p(8) }}>
          <div className="min-w-0">
            <HangSo ten="Chi quảng cáo" giaTri={v(vnd(t.chiQc))} co={36} />
            <div className="truncate" style={{ fontSize: p(15), opacity: 0.7 }}>{v(`${so(t.hienThiQc)} hiển thị`)}</div>
          </div>
          <span />
          <div className="min-w-0">
            <HangSo ten="Tỉ lệ nhấp" giaTri={v(phanTram(t.ctr))} co={36} />
            <div className="truncate" style={{ fontSize: p(15), opacity: 0.7 }}>{v(`${so(t.nhapQc)} nhấp · ${so(t.soQc)} QC`)}</div>
          </div>
        </div>
      </ManHinh>

      {/* ③ BÁN HÀNG — hội thoại thật (màn trái, phủ hết danh sách mẫu) + số bán (khoét chỗ nhân viên). */}
      <ManHinh x={1334} y={378} w={164} h={200} mau={BAN_HANG.hex}>
        {tieuDe('Hội thoại', undefined, BAN_HANG.hex)}
        <div className="flex flex-col flex-1" style={{ gap: p(7), marginTop: p(6) }}>
          {s.hoiThoai.length === 0 ? (
            <div style={{ fontSize: p(16), opacity: 0.6 }}>{dang ? '…' : 'Chưa có hội thoại'}</div>
          ) : (
            s.hoiThoai.slice(0, 3).map((h) => (
              <div key={h.id} className="flex items-center min-w-0" style={{ gap: p(7) }}>
                <span className="flex items-center justify-center shrink-0 rounded-full font-bold" style={{ width: p(28), height: p(28), fontSize: p(15), background: `${BAN_HANG.hex}33`, color: BAN_HANG.hex }}>
                  {(h.customer_name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold" style={{ fontSize: p(16) }}>{h.customer_name || 'Khách chưa có tên'}</span>
                  <span className="block truncate" style={{ fontSize: p(13), opacity: 0.6 }}>{h.last_message ?? ''}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </ManHinh>
      <ManHinh x={1502} y={378} w={358} h={146} mau={BAN_HANG.hex} khoet={NHAN_VIEN.ban_hang}>
        {tieuDe('Bán hàng tháng này', undefined, BAN_HANG.hex)}
        <div className="grid flex-1 items-end" style={{ gridTemplateColumns: '36% 1fr 40%', columnGap: p(8) }}>
          <div className="flex flex-col justify-end h-full" style={{ gap: p(4) }}>
            <HangSo ten="AI trả lời" giaTri={v(so(t.tinAi))} co={32} />
            <div className="truncate" style={{ fontSize: p(15), opacity: 0.7 }}>{v(`${so(t.hoiThoaiMoi)} hội thoại mới`)}</div>
          </div>
          <span />
          <div className="flex flex-col justify-end h-full" style={{ gap: p(4) }}>
            <HangSo ten="Đơn hàng" giaTri={v(so(t.don))} mau={BAN_HANG.hex} co={30} />
            <HangSo ten="Doanh thu" giaTri={v(vnd(t.doanhThu))} co={26} />
          </div>
        </div>
      </ManHinh>
    </div>
  );
}

/**
 * Màn rộng (≥ xl) — HAI TẦNG (chủ dự án 30/10/2026: "to hơn, kéo dài xuống dưới"): ảnh toàn cảnh rộng gấp 3 lần cao nên
 * một tấm thì chiều cao bị khoá theo bề ngang. Tầng trên: văn phòng ④ phủ hết bề ngang (to ~gấp đôi); tầng dưới: ①②③ cạnh
 * nhau, mỗi văn phòng cắt sát cảnh của nó. Mỗi tầng là CÙNG cảnh đã đè số thật (KhoiNaoAnh thu khung) — số mẫu không lộ,
 * lỗ khoét đầu nhân viên + vùng bấm giữ nguyên. Đầu khối (tên cửa hàng, Đổi cửa hàng) thành hàng riêng; cả khối viền vàng.
 */
export const KHUNG_HAI_TANG = {
  dieu_hanh: [500, 0, 980, 300] as [number, number, number, number],
  noi_dung: [92, 318, 560, 322] as [number, number, number, number],
  quang_cao: [708, 318, 560, 322] as [number, number, number, number],
  ban_hang: [1320, 318, 560, 322] as [number, number, number, number],
};

export function KhoiNaoHaiTang({ s, tenCuaHang }: { s: SoLieuKhoiNao; tenCuaHang: string }) {
  const tang = (k: [number, number, number, number], mau: string) => (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${mau}88`, boxShadow: `0 0 22px ${mau}33` }}>
      <KhoiNaoAnh s={s} tenCuaHang={tenCuaHang} khung={k} />
    </div>
  );
  return (
    <div
      className="rounded-[22px] p-[3px]"
      style={{ background: 'linear-gradient(155deg, #7A4F10 0%, #F5C451 12%, #FFF1C1 20%, #C98A22 38%, #6E4710 52%, #E9B44A 68%, #FFE8A8 80%, #9C6516 100%)', boxShadow: '0 0 18px rgba(245,196,81,0.45), 0 0 46px rgba(245,170,50,0.18)' }}
    >
      <div className="rounded-[19px] p-4 space-y-4" style={{ background: 'linear-gradient(180deg, #0B0D12 0%, #07080B 100%)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl" style={{ border: '1.5px solid #F5C451', boxShadow: '0 0 12px rgba(245,196,81,0.6), inset 0 0 10px rgba(245,196,81,0.25)' }}>
              <span className="material-symbols-outlined text-[26px] text-[#FFD978]">psychology</span>
            </span>
            <span>
              <span className="block text-xl font-extrabold text-white leading-tight">Bộ não AI</span>
              <span className="block text-sm text-on-surface-variant">cửa hàng <b className="text-on-surface">{tenCuaHang}</b> · 4 AI làm việc liền mạch</span>
            </span>
          </h3>
          <Link to="/ket-noi" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white hover:brightness-125" style={{ border: '1.5px solid #F5C451', background: 'rgba(8,10,14,0.92)', boxShadow: '0 0 10px rgba(245,196,81,0.4)' }}>
            <span className="material-symbols-outlined text-[20px]">storefront</span>
            Đổi cửa hàng
          </Link>
        </div>
        {tang(KHUNG_HAI_TANG.dieu_hanh, DIEU_HANH.hex)}
        <div className="grid grid-cols-3 gap-4">
          {tang(KHUNG_HAI_TANG.noi_dung, NOI_DUNG.hex)}
          {tang(KHUNG_HAI_TANG.quang_cao, QUANG_CAO.hex)}
          {tang(KHUNG_HAI_TANG.ban_hang, BAN_HANG.hex)}
        </div>
      </div>
    </div>
  );
}

/** Màn hẹp (< xl): 4 thẻ — mỗi thẻ là CẢNH ĐÃ ĐÈ SỐ THẬT thu khung vào văn phòng của AI đó + số chính bên dưới. */
export function KhoiNaoThe({ s, tenCuaHang }: { s: SoLieuKhoiNao; tenCuaHang: string }) {
  const t = tomSo(s);
  const v = (x: string) => (t.co ? x : '…');
  const the = (a: (typeof BON_AI)[number], cat: [number, number, number, number], so4: [string, string][]) => (
    <div key={a.ma} className="rounded-2xl overflow-hidden border" style={{ borderColor: `${a.hex}66`, boxShadow: `0 0 18px ${a.hex}26` }}>
      <KhoiNaoAnh s={s} tenCuaHang={tenCuaHang} khung={cat} />
      <Link to={a.duong} className="block p-3 bg-[#030509] transition hover:brightness-125">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold" style={{ color: a.hex }}>{a.so} · {a.ten}</span>
          <span className="text-[12px] font-bold" style={{ color: a.hex }}>Vào xem →</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {so4.map(([ten, gt]) => (
            <div key={ten} className="min-w-0">
              <div className="text-[11px] text-on-surface-variant truncate">{ten}</div>
              <div className="text-base font-extrabold text-on-surface truncate">{gt}</div>
            </div>
          ))}
        </div>
      </Link>
    </div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {the(DIEU_HANH, [490, 0, 990, 300], [
        ['Doanh thu tháng này', v(vnd(t.doanhThu))],
        ['Việc cần xử lý', t.viecCan === null ? '…' : so(t.viecCan)],
      ])}
      {the(NOI_DUNG, [60, 300, 600, 360], [
        ['Bài đã đăng', v(so(t.baiDang))],
        ['Tương tác', v(so(t.tuongTac))],
      ])}
      {the(QUANG_CAO, [690, 300, 600, 360], [
        ['Chi quảng cáo', v(vnd(t.chiQc))],
        ['Tỉ lệ nhấp', v(phanTram(t.ctr))],
      ])}
      {the(BAN_HANG, [1310, 300, 620, 360], [
        ['Đơn hàng', v(so(t.don))],
        ['AI trả lời', v(so(t.tinAi))],
      ])}
    </div>
  );
}

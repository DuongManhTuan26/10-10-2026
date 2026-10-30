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

/** Một màn hình đè lên ảnh: kính tối viền màu AI, phát sáng nhẹ (giống màn hình trong ảnh). */
function ManHinh({ x, y, w, h, mau, children }: { x: number; y: number; w: number; h: number; mau: string; children: ReactNode }) {
  return (
    <div
      className="absolute overflow-hidden pointer-events-none flex flex-col"
      style={{
        ...hop(x, y, w, h),
        background: 'linear-gradient(180deg, rgba(10,22,36,0.97) 0%, rgba(5,12,22,0.97) 100%)',
        border: `1px solid ${mau}aa`,
        borderRadius: p(9),
        boxShadow: `0 0 ${p(12)} ${mau}55, inset 0 0 ${p(16)} ${mau}22`,
        padding: `${p(9)} ${p(11)}`,
        color: '#E8EDF2',
      }}
    >
      {children}
    </div>
  );
}
const tieuDe = (chu: string, phu?: string) => (
  <div className="flex items-baseline justify-between gap-1 whitespace-nowrap" style={{ fontSize: p(15), fontWeight: 700 }}>
    <span className="truncate">{chu}</span>
    {phu && <span style={{ fontSize: p(11), fontWeight: 500, opacity: 0.6 }}>{phu}</span>}
  </div>
);

/** Cột theo ngày (chỉ vẽ khi có số; toàn 0 → vạch đáy + "Chưa có"). */
function Cot({ giaTri, mau }: { giaTri: number[]; mau: string }) {
  const max = Math.max(0, ...giaTri);
  if (max <= 0) {
    return (
      <div className="flex-1 flex flex-col justify-end">
        <div style={{ fontSize: p(11), opacity: 0.55 }}>Chưa có số trong kỳ</div>
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

function HangSo({ ten, giaTri, mau }: { ten: string; giaTri: string; mau?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate" style={{ fontSize: p(11), opacity: 0.65 }}>{ten}</div>
      <div className="truncate" style={{ fontSize: p(20), fontWeight: 800, color: mau ?? '#FFFFFF', lineHeight: 1.15 }}>{giaTri}</div>
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

      {/* ④ ĐIỀU HÀNH — trái: doanh thu tháng + cột theo ngày */}
      <ManHinh x={524} y={100} w={204} h={166} mau="#38bdf8">
        {tieuDe('Doanh thu tháng này')}
        <div style={{ fontSize: p(30), fontWeight: 800, lineHeight: 1.15, marginTop: p(4) }}>{v(vnd(t.doanhThu))}</div>
        <div style={{ fontSize: p(12), color: '#4ade80', marginBottom: p(6) }}>{v(`${so(t.don)} đơn`)}</div>
        <Cot giaTri={t.doanhThuNgay} mau="#38bdf8" />
      </ManHinh>
      {/* ④ — giữa trái: đơn / hội thoại mới / tỉ lệ chốt */}
      <ManHinh x={730} y={100} w={122} h={166} mau="#38bdf8">
        <div className="flex flex-col justify-between h-full">
          <HangSo ten="Đơn hàng" giaTri={v(so(t.don))} />
          <HangSo ten="Hội thoại mới" giaTri={v(so(t.hoiThoaiMoi))} />
          <HangSo ten="Tỉ lệ chốt" giaTri={v(phanTram(t.tiLeChot))} />
        </div>
      </ManHinh>
      {/* ④ — phải: sức khoẻ 3 AI (mức do code chấm, không phải % bịa) */}
      <ManHinh x={1172} y={100} w={280} h={166} mau="#38bdf8">
        {tieuDe('Sức khoẻ 3 AI', '7 ngày')}
        <div className="flex flex-col justify-around flex-1" style={{ marginTop: p(4) }}>
          {[NOI_DUNG, QUANG_CAO, BAN_HANG].map((a) => {
            const c = chiSo(a.khau as ChiSoSucKhoe['khau']);
            const muc = c?.muc ?? 'chua_du';
            return (
              <div key={a.ma} className="flex items-center" style={{ gap: p(8) }}>
                <span className="flex items-center justify-center shrink-0 rounded-full font-bold" style={{ width: p(24), height: p(24), fontSize: p(13), color: '#0b0f14', background: a.hex }}>{a.so}</span>
                <span className="shrink-0 truncate" style={{ fontSize: p(12.5), width: p(86) }}>{a.ten}</span>
                <span className="flex-1 rounded-full overflow-hidden" style={{ height: p(8), background: 'rgba(255,255,255,0.08)' }}>
                  <span className="block h-full rounded-full" style={{ width: `${DAI_THANH[muc]}%`, background: a.hex, boxShadow: `0 0 ${p(6)} ${a.hex}` }} />
                </span>
                <span className="shrink-0 text-right truncate" style={{ fontSize: p(12.5), fontWeight: 700, width: p(62) }} title={c?.ten}>
                  {s.suc ? (muc === 'chua_du' ? '—' : giaTriChiSo(c)) : '…'}
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: p(10.5), opacity: 0.55 }}>
            {s.suc ? [NOI_DUNG, QUANG_CAO, BAN_HANG].map((a) => CHU_MUC[chiSo(a.khau as ChiSoSucKhoe['khau'])?.muc ?? 'chua_du']).join(' · ') : 'Đang chấm…'}
          </div>
        </div>
      </ManHinh>
      {/* ④ — dưới quả địa cầu: việc cần xử lý */}
      <div className="absolute pointer-events-none flex items-center justify-center" style={hop(880, 236, 240, 30)}>
        <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: p(13), padding: `${p(3)} ${p(12)}`, color: '#facc15', background: 'rgba(10,8,2,0.85)', border: '1px solid rgba(250,204,21,0.6)', boxShadow: `0 0 ${p(10)} rgba(250,204,21,0.4)` }}>
          {t.viecCan === null ? 'Đang chấm…' : t.viecCan > 0 ? `${t.viecCan} việc cần xử lý trước` : 'Không có việc gấp'}
        </span>
      </div>

      {/* ① NỘI DUNG — màn giữa: số bài tháng này */}
      <ManHinh x={228} y={380} w={248} h={126} mau={NOI_DUNG.hex}>
        {tieuDe('Bài đăng tháng này')}
        <div className="grid grid-cols-2 flex-1 content-center" style={{ gap: `${p(4)} ${p(10)}` }}>
          <HangSo ten="Đã đăng" giaTri={v(so(t.baiDang))} mau={NOI_DUNG.hex} />
          <HangSo ten="AI viết" giaTri={v(so(t.baiAi))} />
          <HangSo ten="Hiển thị" giaTri={v(so(t.hienThiBai))} />
          <HangSo ten="Tương tác" giaTri={v(so(t.tuongTac))} />
        </div>
      </ManHinh>

      {/* ② QUẢNG CÁO — chi tiêu + tỉ lệ nhấp (app chưa đo ROAS → không hiện ROAS) */}
      <ManHinh x={864} y={380} w={190} h={126} mau={QUANG_CAO.hex}>
        {tieuDe('Chi quảng cáo')}
        <div style={{ fontSize: p(30), fontWeight: 800, lineHeight: 1.2, marginTop: p(4) }}>{v(vnd(t.chiQc))}</div>
        <div className="mt-auto" style={{ fontSize: p(11.5), opacity: 0.75 }}>{v(`${so(t.hienThiQc)} hiển thị · ${so(t.nhapQc)} nhấp`)}</div>
      </ManHinh>
      <ManHinh x={1058} y={380} w={144} h={126} mau={QUANG_CAO.hex}>
        {tieuDe('Tỉ lệ nhấp')}
        <div style={{ fontSize: p(30), fontWeight: 800, lineHeight: 1.2, marginTop: p(4) }}>{v(phanTram(t.ctr))}</div>
        <div className="mt-auto" style={{ fontSize: p(11.5), opacity: 0.75 }}>{v(`${so(t.soQc)} quảng cáo`)}</div>
      </ManHinh>

      {/* ③ BÁN HÀNG — hội thoại gần nhất thật / tin AI trả lời / kết quả bán */}
      <ManHinh x={1334} y={380} w={162} h={190} mau={BAN_HANG.hex}>
        {tieuDe('Hội thoại')}
        <div className="flex flex-col flex-1" style={{ gap: p(6), marginTop: p(6) }}>
          {s.hoiThoai.length === 0 ? (
            <div style={{ fontSize: p(11.5), opacity: 0.6 }}>{dang ? '…' : 'Chưa có hội thoại'}</div>
          ) : (
            s.hoiThoai.map((h) => (
              <div key={h.id} className="flex items-center min-w-0" style={{ gap: p(6) }}>
                <span className="flex items-center justify-center shrink-0 rounded-full font-bold" style={{ width: p(22), height: p(22), fontSize: p(11), background: `${BAN_HANG.hex}33`, color: BAN_HANG.hex }}>
                  {(h.customer_name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold" style={{ fontSize: p(11.5) }}>{h.customer_name || 'Khách chưa có tên'}</span>
                  <span className="block truncate" style={{ fontSize: p(10), opacity: 0.6 }}>{h.last_message ?? ''}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </ManHinh>
      <ManHinh x={1500} y={380} w={174} h={130} mau={BAN_HANG.hex}>
        {tieuDe('AI trả lời', 'tháng này')}
        <div style={{ fontSize: p(30), fontWeight: 800, lineHeight: 1.2, marginTop: p(4) }}>{v(so(t.tinAi))}</div>
        <div className="mt-auto" style={{ fontSize: p(11.5), opacity: 0.75 }}>{v(`${so(t.hoiThoaiMoi)} hội thoại mới`)}</div>
      </ManHinh>
      <ManHinh x={1678} y={380} w={178} h={142} mau={BAN_HANG.hex}>
        {tieuDe('Kết quả bán hàng')}
        <div className="flex flex-col justify-around flex-1">
          <HangSo ten="Đơn hàng" giaTri={v(so(t.don))} mau={BAN_HANG.hex} />
          <HangSo ten="Doanh thu" giaTri={v(vnd(t.doanhThu))} />
        </div>
      </ManHinh>
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

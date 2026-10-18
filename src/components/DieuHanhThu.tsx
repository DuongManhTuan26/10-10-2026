/**
 * AI ĐIỀU HÀNH — chạy thử, nằm trong trang AI Điều Hành của BỘ NÃO (trang đang chọn). trangId chỉ để nạp lại khi đổi trang.
 *
 * Chế độ ĐỀ XUẤT: không thực thi gì. Ba phần, dòng chính ngắn — bấm mới hiện chi tiết:
 *   1. Sổ bằng chứng (code gom, hạng do code chấm) + những gì hệ thống CHƯA BIẾT — chỉ đọc, không tốn tiền.
 *   2. Chạy thử: vấn đề do hệ thống chọn từ bảng sức khoẻ, hoặc chủ shop tự gõ câu hỏi. Tốn tiền AI → hỏi lại trước.
 *   3. Đề xuất gần đây: nội dung do CODE viết (không phải AI), duyệt / bác. Bác = sổ lỗi mức "nghi vấn".
 * Màu theo nghĩa: hạng A/B xanh lá, C cam, D xám; bị chặn / bác đỏ.
 */
import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { api, ApiError, type DeXuatDieuHanh, type SoDieuHanh } from '../lib/api';
import { hoiNhap, hoiXacNhan, baoTin } from './HopHoi';
import { O_NHAP } from './HopThoai';

const MAU_HANG: Record<string, string> = {
  A: 'bg-green-500/15 text-green-400',
  B: 'bg-green-500/10 text-green-300',
  C: 'bg-orange-400/15 text-orange-400',
  D: 'bg-surface-container-highest text-on-surface-variant',
};
const TEN_KET_QUA: Record<string, { chu: string; mau: string }> = {
  thuc_hien: { chu: 'Sẵn sàng để duyệt', mau: 'text-green-400' },
  dieu_hanh_quyet_ghi_so: { chu: 'Còn bất đồng (rủi ro vừa)', mau: 'text-orange-400' },
  dung_hoi_chu_shop: { chu: 'Cần chủ shop quyết', mau: 'text-red-400' },
  xem_lai: { chu: 'Xem lại', mau: 'text-orange-400' },
  tra_lai_dieu_hanh: { chu: 'Bị trả lại', mau: 'text-red-400' },
};
const TEN_TRANG_THAI: Record<DeXuatDieuHanh['trang_thai'], { chu: string; mau: string }> = {
  cho_duyet: { chu: 'Chờ duyệt', mau: 'bg-orange-400/15 text-orange-400' },
  da_duyet: { chu: 'Đã duyệt', mau: 'bg-green-500/15 text-green-400' },
  bac: { chu: 'Đã bác', mau: 'bg-red-500/15 text-red-400' },
};
const usd = (x: number) => `${x.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} USD`;
const loiChu = (e: unknown, macDinh: string) => (e instanceof ApiError ? e.message : macDinh);

export default function DieuHanhThu({ trangId }: { trangId: number | null }) {
  const [so, setSo] = useState<SoDieuHanh | null>(null);
  const [deXuat, setDeXuat] = useState<DeXuatDieuHanh[] | null>(null);
  const [loi, setLoi] = useState('');
  const [moSo, setMoSo] = useState(false);
  const [moTung, setMoTung] = useState<Set<string>>(new Set());
  const [moDeXuat, setMoDeXuat] = useState<number | null>(null);
  const [vanDe, setVanDe] = useState('');
  const [dangChay, setDangChay] = useState(false);

  const tai = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.dieuHanh.so(), api.dieuHanh.deXuat()]);
      setSo(a.data);
      setDeXuat(b.data);
      setLoi('');
    } catch (e) {
      setLoi(loiChu(e, 'Chưa tải được AI điều hành'));
    }
  }, [trangId]);
  useEffect(() => {
    setSo(null);
    setDeXuat(null);
    void tai();
  }, [tai]);

  const chay = async () => {
    const coVanDe = vanDe.trim() || so?.vanDeTuDong;
    if (!coVanDe) {
      await baoTin({ tieuDe: 'Chưa có vấn đề để xem', noiDung: 'Bảng sức khoẻ không có sự cố hay chỉ số tụt. Gõ câu hỏi muốn AI điều hành xem rồi bấm lại.' });
      return;
    }
    const dongY = await hoiXacNhan({
      tieuDe: 'Chạy thử AI điều hành?',
      noiDung: `Vấn đề: ${vanDe.trim() || so?.vanDeTuDong}\n\nTốn tiền AI: khoảng 0,07–0,17 USD (2–4 lượt gọi), mất khoảng 1–3 phút.\nChế độ đề xuất — không thực thi gì, chỉ ra đề xuất để duyệt.`,
      nutDongY: 'Chạy thử',
      bieuTuong: 'smart_toy',
    });
    if (!dongY) return;
    setDangChay(true);
    try {
      const { data } = await api.dieuHanh.chay(vanDe.trim());
      setVanDe('');
      await tai();
      setMoDeXuat(data.id);
    } catch (e) {
      await baoTin({ tieuDe: 'Chạy thử không thành công', noiDung: loiChu(e, 'Có lỗi khi chạy thử') });
    } finally {
      setDangChay(false);
    }
  };

  const quyet = async (d: DeXuatDieuHanh, duyet: boolean) => {
    let lyDo: string | undefined;
    if (!duyet) {
      const nhap = await hoiNhap({ tieuDe: 'Bác đề xuất này?', nhan: 'Lý do (để sổ lỗi ghi lại — chưa coi là AI sai)', goiY: 'vd. không muốn đổi lúc này / nguyên nhân sai…', nutDongY: 'Bác', nguyHiem: true });
      if (nhap === null) return;
      lyDo = nhap;
    }
    try {
      await api.dieuHanh.quyet(d.id, duyet, lyDo);
      await tai();
    } catch (e) {
      await baoTin({ tieuDe: 'Chưa ghi được', noiDung: loiChu(e, 'Có lỗi') });
    }
  };

  if (loi) return <p className="text-sm text-red-400">{loi}</p>;
  if (!so || !deXuat) return <p className="text-sm text-on-surface-variant">Đang tải sổ bằng chứng…</p>;
  const doiMo = (ma: string) => setMoTung((s) => { const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n; });

  return (
    <div className="space-y-3 text-sm">
      {/* 1. Sổ bằng chứng — dòng chính: số lượng; bấm mới hiện từng dòng */}
      <div className="rounded-xl border border-outline-variant/40">
        <button type="button" onClick={() => setMoSo((v) => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left">
          <span className="text-on-surface">
            Sổ bằng chứng: <b>{so.bangChung.length}</b> mục
            {so.khoangTrong.length > 0 && <span className="text-orange-400"> · {so.khoangTrong.length} điều hệ thống chưa biết</span>}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-base">{moSo ? 'expand_less' : 'expand_more'}</span>
        </button>
        {moSo && (
          <div className="border-t border-outline-variant/40 px-4 py-3 space-y-3">
            {so.khoangTrong.length > 0 && (
              <div className="rounded-lg border border-orange-400/40 bg-orange-400/10 px-3 py-2">
                <div className="font-bold text-orange-400 mb-1 text-xs">Hệ thống CHƯA BIẾT (không phải "không có")</div>
                {so.khoangTrong.map((k, i) => <div key={i} className="text-xs text-on-surface">· {k}</div>)}
              </div>
            )}
            <div className="divide-y divide-outline-variant/30">
              {so.bangChung.map((b) => {
                const mo = moTung.has(b.ma);
                return (
                  <button key={b.ma} type="button" onClick={() => doiMo(b.ma)} className="w-full text-left py-1.5 block">
                    <div className="flex items-start gap-2">
                      <span className={clsx('shrink-0 rounded px-1.5 text-[11px] font-bold tabular-nums', MAU_HANG[b.hang])} title={b.lyDoHang.join(', ') || undefined}>{b.hang}</span>
                      <span className="shrink-0 font-mono text-[11px] text-on-surface-variant pt-0.5">{b.ma}</span>
                      <span className={clsx('text-xs text-on-surface whitespace-pre-wrap', !mo && 'line-clamp-1')}>{b.noiDung}</span>
                    </div>
                    {mo && b.gioiHan.length > 0 && <div className="mt-1 ml-14 text-[11px] text-orange-400">{b.gioiHan.map((g) => `⚠ ${g}`).join(' · ')}</div>}
                    {mo && b.lyDoHang.length > 0 && <div className="mt-0.5 ml-14 text-[11px] text-on-surface-variant">Hạng {b.hang}: {b.lyDoHang.join(', ')}</div>}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-on-surface-variant">Hạng do code chấm theo nguồn: A nhật ký / tài liệu / luật / thử nghiệm đủ mẫu · B số hệ thống đo có ý nghĩa, lời chủ shop · C thiếu mẫu, chưa có ý nghĩa, số nền tảng chưa chốt, lời khách · D do AI viết.</p>
          </div>
        )}
      </div>

      {/* 2. Chạy thử */}
      <div className="rounded-xl border border-outline-variant/40 px-4 py-3 space-y-2">
        <div className="text-on-surface">
          Vấn đề hệ thống chọn: {so.vanDeTuDong ? <b>{so.vanDeTuDong}</b> : <span className="text-on-surface-variant">không có (bảng sức khoẻ không có sự cố hay chỉ số tụt)</span>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={vanDe}
            onChange={(e) => setVanDe(e.target.value)}
            maxLength={500}
            placeholder={so.vanDeTuDong ? 'Hoặc gõ câu hỏi riêng cho AI điều hành (bỏ trống = dùng vấn đề trên)' : 'Gõ câu hỏi cho AI điều hành, vd. "Vì sao tuần này chưa có đơn?"'}
            className={clsx(O_NHAP, 'flex-1')}
            disabled={dangChay}
          />
          <button type="button" onClick={chay} disabled={dangChay}
            className="h-12 rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            <span className={clsx('material-symbols-outlined text-base', dangChay && 'animate-spin')}>{dangChay ? 'progress_activity' : 'smart_toy'}</span>
            {dangChay ? 'Đang chạy (1–3 phút)…' : 'Chạy thử AI điều hành'}
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant">Chế độ đề xuất — không thực thi gì. Mỗi lần chạy tốn khoảng 0,07–0,17 USD (tiền AI tính vào cửa hàng này).</p>
      </div>

      {/* 3. Đề xuất gần đây */}
      <div className="rounded-xl border border-outline-variant/40">
        <div className="px-4 py-2.5 flex items-baseline justify-between gap-3">
          <span className="text-on-surface">Đề xuất gần đây: <b>{deXuat.length}</b></span>
          {so.soDo && so.soDo.so > 0 && (
            <span className="text-xs text-on-surface-variant tabular-nums">
              30 ngày: {so.soDo.duyet} duyệt · {so.soDo.bac} bác · {so.soDo.cho} chờ · tb {usd(so.soDo.tien_tb ?? 0)} · {Math.round(so.soDo.giay_tb ?? 0)} giây
            </span>
          )}
        </div>
        {deXuat.length === 0 && <p className="px-4 pb-3 text-xs text-on-surface-variant">Chưa chạy lần nào.</p>}
        <div className="divide-y divide-outline-variant/30 border-t border-outline-variant/40">
          {deXuat.map((d) => {
            const mo = moDeXuat === d.id;
            const kq = TEN_KET_QUA[d.ket_qua] ?? { chu: d.ket_qua, mau: 'text-on-surface' };
            return (
              <div key={d.id} className="px-4 py-2">
                <button type="button" onClick={() => setMoDeXuat(mo ? null : d.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-on-surface-variant tabular-nums">{new Date(d.luc).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={clsx('text-xs font-bold', kq.mau)}>{kq.chu}</span>
                  <span className={clsx('rounded px-1.5 text-[11px] font-bold', TEN_TRANG_THAI[d.trang_thai].mau)}>{TEN_TRANG_THAI[d.trang_thai].chu}</span>
                  <span className="text-xs text-on-surface truncate flex-1 min-w-0">{d.van_de}</span>
                  <span className="text-xs text-on-surface-variant tabular-nums">{usd(d.tien_usd)} · {d.so_luot_ai} lượt · {Math.round(d.thoi_gian_ms / 1000)} giây</span>
                </button>
                {mo && (
                  <div className="mt-2 space-y-2">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-on-surface bg-surface-container-high rounded-lg px-3 py-2">{d.noi_dung ?? '(chưa có nội dung)'}</pre>
                    {d.ly_do_chu_shop && <p className="text-xs text-on-surface-variant">Lý do bác: {d.ly_do_chu_shop}</p>}
                    {d.trang_thai === 'cho_duyet' && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => quyet(d, true)} className="rounded-lg bg-green-500/15 text-green-400 px-3 py-1.5 text-xs font-bold">Duyệt</button>
                        <button type="button" onClick={() => quyet(d, false)} className="rounded-lg bg-red-500/15 text-red-400 px-3 py-1.5 text-xs font-bold">Bác</button>
                        <span className="text-[11px] text-on-surface-variant self-center">Duyệt chỉ ghi nhận — chưa thực thi gì.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

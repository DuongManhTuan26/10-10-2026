/**
 * BÁO CÁO CHUỖI 4 KHÂU của một trang (phần 2, chủ dự án duyệt 05/10/2026): Nội dung → Quảng cáo → Bán hàng → Tổng.
 *
 * Mọi khâu cùng một khung (đã làm · tốn · kết quả · sang khâu sau · sự cố) để đặt cạnh nhau so được ngay khâu nào là
 * nút thắt. Các khâu nối bằng mã thật (quảng cáo / bình luận → hội thoại → đơn); hội thoại có từ trước khi ghi nguồn
 * hiện riêng "chưa ghi nguồn", không gán bừa. Chỉ số cuối (chủ dự án chốt): tiền bỏ ra mỗi đơn + doanh thu/chi phí.
 */
import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { type BaoCaoChuoi as DuLieu, type TrangTongQuan } from '../lib/api';
import { chi, mauChi, TY_GIA } from '../lib/tien-chi';
import { tienTrang, tong, tienGoc } from './QuanLyTongQuan';

const so = (n: number) => n.toLocaleString('vi-VN');
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;
const phanTram = (x: number | null) => (x === null ? '—' : `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`);
const giay = (g: number | null) => (g === null ? '—' : g < 60 ? `${Math.round(g)} giây` : g < 3600 ? `${Math.round(g / 60)} phút` : `${(g / 3600).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`);

/** Một dòng trong thẻ khâu: nhãn trái, số phải. */
function Dong({ nhan, gia, mau, phu }: { nhan: string; gia: ReactNode; mau?: string; phu?: ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-on-surface-variant">{nhan}</span>
        <span className={clsx('tabular-nums text-right font-medium', mau ?? 'text-on-surface')}>{gia}</span>
      </div>
      {phu && <div className="text-[11px] text-on-surface-variant mt-0.5">{phu}</div>}
    </div>
  );
}

/** Một khâu: tiêu đề + nhóm dòng theo đúng khung chung. */
function Khau({ so: thuTu, icon, ten, children }: { so: number; icon: string; ten: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface px-4 py-3 min-w-0">
      <h5 className="flex items-center gap-2 font-bold text-on-surface mb-1">
        <span className="font-mono text-xs text-on-surface-variant">{thuTu}</span>
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        {ten}
      </h5>
      <div className="divide-y divide-outline-variant/60 text-sm">{children}</div>
    </section>
  );
}

export default function BaoCaoChuoi({ t, du }: { t: TrangTongQuan | null; du: DuLieu }) {
  const { noiDung: nd, quangCao: qc, banHang: bh } = du;

  // --- Tổng: tiền AI + kênh (USD) và quảng cáo (đơn vị gốc) của trang, từ Tổng quan ---
  // Tiền của trang (AI + kênh + quảng cáo) lấy từ cùng hàm Tổng quan; chưa có thì coi như 0 và ghi rõ ở dòng tiền.
  const usd = t ? tong(tienTrang(t)) : 0;
  const qcVnd = (t?.quangCao ?? []).filter((q) => q.tienTe === 'VND').reduce((s, q) => s + (q.soTien ?? 0), 0);
  const qcKhac = (t?.quangCao ?? []).filter((q) => q.tienTe && q.tienTe !== 'VND' && (q.soTien ?? 0) > 0);
  const donThat = bh.soDon - bh.donHuy;
  const tongChiVnd = qcVnd + usd * TY_GIA;

  return (
    <div className="space-y-3">
      {/* Phễu: mỗi bước là số của khâu đó, cùng kỳ */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {[
          ['Hiển thị', so(nd.hienThi)],
          ['Tương tác', so(nd.tuongTac)],
          ['Hội thoại mới', so(bh.hoiThoaiMoi)],
          ['Đơn', so(donThat)],
          ['Doanh thu', vnd(bh.doanhThu)],
        ].map(([nhan, gia], i) => (
          <span key={nhan} className="flex items-center gap-2">
            {i > 0 && <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>}
            <span className="rounded-lg bg-surface-container-high px-2.5 py-1">
              <span className="text-on-surface-variant">{nhan}</span> <b className="tabular-nums text-on-surface">{gia}</b>
            </span>
          </span>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <Khau so={1} icon="edit_note" ten="Nội dung">
          <Dong nhan="Đã đăng" gia={`${so(nd.baiDang)} bài`} phu={`${so(nd.baiAi)} bài AI viết`} />
          <Dong nhan="Tốn (AI viết, ảnh, video)" gia={chi(nd.tienAiUsd)} mau={mauChi(nd.tienAiUsd)} />
          <Dong nhan="Kết quả" gia={`${so(nd.hienThi)} hiển thị`} phu={`${so(nd.tiepCan)} người tiếp cận · ${so(nd.tuongTac)} tương tác · ${so(nd.binhLuan)} bình luận`} />
          <Dong nhan="Sang bán hàng" gia={`${so(nd.hoiThoaiTuBai)} hội thoại`} phu={`${so(nd.donTuBai)} đơn · ${vnd(nd.doanhThuTuBai)} từ bình luận`} />
          <Dong nhan="Sự cố" gia={nd.baiLoi ? `${so(nd.baiLoi)} bài đăng lỗi` : 'Không'} mau={nd.baiLoi ? 'text-orange-400' : 'text-green-400'} />
        </Khau>

        <Khau so={2} icon="campaign" ten="Quảng cáo">
          {!qc.coFanpage ? (
            <Dong nhan="Trạng thái" gia="Chưa nối Fanpage" />
          ) : qc.loi ? (
            <Dong nhan="Trạng thái" gia={qc.loi} mau="text-orange-400" />
          ) : (
            <>
              <Dong
                nhan="Đã chạy"
                gia={`${so(qc.soQuangCao)} quảng cáo`}
                phu={qc.theoTienTe.map((g) => `${so(g.hienThi)} hiển thị · ${so(g.nhap)} nhấp`).join(' · ') || undefined}
              />
              <Dong
                nhan="Tốn"
                gia={qc.theoTienTe.length ? qc.theoTienTe.map((g) => tienGoc(g.chiTieu, g.tienTe)).join(' · ') : '0 ₫'}
                mau={qc.theoTienTe.some((g) => g.chiTieu > 0) ? 'text-red-400' : undefined}
              />
              <Dong
                nhan="Kết quả"
                gia={`${so(qc.theoTienTe.reduce((s, g) => s + (g.troChuyen ?? 0), 0))} cuộc trò chuyện`}
                phu="Số Meta báo khách bắt đầu nhắn tin từ quảng cáo"
              />
              <Dong nhan="Sang bán hàng" gia={`${so(qc.hoiThoaiTuQuangCao)} hội thoại`} phu={`${so(qc.donTuQuangCao)} đơn · ${vnd(qc.doanhThuTuQuangCao)} từ quảng cáo`} />
              <Dong
                nhan="Sự cố"
                gia={qc.quangCaoLoi.length ? `${so(qc.quangCaoLoi.length)} quảng cáo lỗi / bị từ chối` : 'Không'}
                mau={qc.quangCaoLoi.length ? 'text-orange-400' : 'text-green-400'}
                phu={qc.quangCaoLoi.map((q) => q.ten).join(', ') || undefined}
              />
            </>
          )}
        </Khau>

        <Khau so={3} icon="support_agent" ten="Bán hàng">
          <Dong
            nhan="Hội thoại mới"
            gia={so(bh.hoiThoaiMoi)}
            phu={[
              bh.theoNguon.quangCao && `${bh.theoNguon.quangCao} từ quảng cáo`,
              bh.theoNguon.binhLuan && `${bh.theoNguon.binhLuan} từ bình luận`,
              bh.theoNguon.lienKet && `${bh.theoNguon.lienKet} từ link`,
              bh.theoNguon.tuNhan && `${bh.theoNguon.tuNhan} tự nhắn`,
              bh.theoNguon.chuaGhiNguon && `${bh.theoNguon.chuaGhiNguon} chưa ghi nguồn`,
            ].filter(Boolean).join(' · ') || undefined}
          />
          <Dong nhan="Tốn (AI bán hàng)" gia={chi(bh.tienAiUsd)} mau={mauChi(bh.tienAiUsd)} phu={`AI đã trả lời ${so(bh.tinAiTraLoi)} tin · trả lời sau ${giay(bh.traLoiTrungViGiay)} (trung vị)`} />
          <Dong nhan="Kết quả" gia={`${so(donThat)} đơn · ${vnd(bh.doanhThu)}`} phu={`Tỉ lệ chốt ${phanTram(bh.tiLeChot)} · đơn trung bình ${bh.giaTriDonTB === null ? '—' : vnd(bh.giaTriDonTB)}`} />
          <Dong
            nhan="Sự cố"
            gia={bh.nhuongNguoi.length || bh.donHuy ? `${so(bh.nhuongNguoi.reduce((s, x) => s + x.so, 0))} lần nhường người · ${so(bh.donHuy)} đơn huỷ` : 'Không'}
            mau={bh.nhuongNguoi.length || bh.donHuy ? 'text-orange-400' : 'text-green-400'}
            phu={bh.nhuongNguoi.map((x) => `${x.ly_do} (${x.so})`).join(' · ') || undefined}
          />
        </Khau>

        <Khau so={4} icon="query_stats" ten="Tổng">
          {!t ? (
            <Dong nhan="Tổng chi" gia="Chưa đọc được tiền của cửa hàng" phu="Không tính tiền mỗi đơn / doanh thu trên chi phí khi thiếu số tiền" />
          ) : (<>
          <Dong
            nhan="Tổng chi"
            gia={<>{chi(usd)}{qcVnd > 0 && <> · {tienGoc(qcVnd, 'VND')}</>}</>}
            mau={usd > 1e-9 || qcVnd > 0 ? 'text-red-400' : undefined}
            phu="AI + kết nối kênh (USD) · quảng cáo (₫)"
          />
          <Dong
            nhan="Tiền bỏ ra mỗi đơn"
            gia={donThat > 0 ? <>{chi(usd / donThat)}{qcVnd > 0 && <> · {tienGoc(qcVnd / donThat, 'VND')}</>}</> : '— (chưa có đơn)'}
          />
          <Dong
            nhan="Doanh thu / chi phí"
            gia={tongChiVnd > 0 ? `${(bh.doanhThu / tongChiVnd).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} lần` : '—'}
            mau={tongChiVnd > 0 ? (bh.doanhThu >= tongChiVnd ? 'text-green-400' : 'text-red-400') : undefined}
            phu={`Quy đổi USD theo ${TY_GIA.toLocaleString('vi-VN')} ₫/USD${qcKhac.length ? ' · có quảng cáo khác đơn vị ₫ chưa cộng' : ''}`}
          />
          </>)}
        </Khau>
      </div>
    </div>
  );
}

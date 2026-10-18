import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  api, ApiError, type AmThanhVideo, type CanhVideo, type CheDoVideoDai, type ChuTrongVideo, type DuAnVideo, type KieuKichBan, type MediaItem, type ModelVideo,
} from '../lib/api';
import { ThuVienAnh } from './ThuVienAnh';
import { useDangKyHanhDong, useXuong } from '../lib/xuong';
import { LuatNoiDungChon } from './LuatNoiDungChon';
import { HuongKichBanChon } from './HuongKichBanChon';
import { ChonMoHinhAnh } from './ChonMoHinhAnh';
import { hoiXacNhan } from './HopHoi';
import { laDungDoKhoa } from '../lib/tai-khoan-khoa';

/**
 * Video dài nhiều cảnh: kịch bản → video, ảnh tham chiếu → video, trend → video.
 *
 * Hai bước có chủ đích: AI chia cảnh và báo giá TRƯỚC (rẻ, chỉ tốn AI chữ), chủ
 * shop đọc, sửa từng cảnh rồi mới bấm tạo — từ đó mới tốn tiền video.
 */

const TY_GIA = 25_500;
// Tới 5 phút (chủ dự án: video dài 1–5 phút).
const TONG_GIAY = [15, 30, 45, 60, 90, 120, 180, 240, 300];
const TOI_DA_GIAY = 300;

const CACH_LAM: { id: CheDoVideoDai; ten: string; giaiThich: string }[] = [
  {
    id: 'noi_dai',
    ten: 'Nối dài liền mạch',
    giaiThich: 'Tính năng của hãng: mỗi đoạn sau do mô hình làm TIẾP đoạn trước (Seedance 2.5, đoạn tới 30 giây).',
  },
  { id: 'ghep_canh', ten: 'Ghép nhiều cảnh', giaiThich: 'Mọi mô hình: tạo từng cảnh rồi ghép, cảnh sau nối từ khung cuối cảnh trước.' },
];

type LoiDoc = 'goc' | 'ai_lite' | 'ai_flash' | 'khong';
const LOI_DOC: { id: LoiDoc; ten: string; giaiThich: string }[] = [
  { id: 'goc', ten: 'Giọng gốc của mô hình', giaiThich: 'Mô hình tự nói tiếng Việt ngay trong video (chỉ mô hình có ✓ nói tiếng Việt)' },
  { id: 'ai_lite', ten: 'Giọng AI Flash-Lite', giaiThich: 'Hạng 7 giọng đọc — nhịp nhanh, vừa cảnh, rẻ' },
  { id: 'ai_flash', ten: 'Giọng AI Flash', giaiThich: 'Hạng 4 giọng đọc — chậm, nhiều ngắt nghỉ' },
  { id: 'khong', ten: 'Không lời đọc', giaiThich: 'Chỉ hình, nhạc, tiếng cảnh' },
];
const MODEL_GIONG: Record<'ai_lite' | 'ai_flash', string> = {
  ai_lite: 'google/gemini-3.8-flash-lite-tts',
  ai_flash: 'google/gemini-3.8-flash-tts',
};

/**
 * Kiểu kịch bản = "kỹ năng" kiểu Pippit / Dreamina (docs/nghien-cuu-doi-thu.md). Lựa chọn của người dùng;
 * "Tự do" không thêm gì vào lời nhắc — AI theo đúng ý tưởng.
 */
const KIEU_KICH_BAN: { id: KieuKichBan; ten: string; giaiThich: string }[] = [
  { id: 'tu_do', ten: 'Tự do', giaiThich: 'Theo đúng ý tưởng bạn viết' },
  { id: 'quang_cao', ten: 'Quảng cáo bán hàng', giaiThich: 'Móc câu 2 giây → vấn đề → giải pháp → lợi ích → kêu gọi' },
  { id: 'ugc', ten: 'Người thật review', giaiThich: 'Như khách quay bằng điện thoại: đập hộp, mặc thử, dùng thử' },
  { id: 'phim_ngan', ten: 'Phim ngắn có sản phẩm', giaiThich: 'Kịch tính, có cú lật, sản phẩm gỡ rối ở cuối' },
];

const CHU: { id: ChuTrongVideo; ten: string }[] = [
  { id: 'theo_noi_dung', ten: 'Có chữ theo lời mô tả' },
  { id: 'khong', ten: 'Không có chữ' },
];

function vnd(usd: number): string {
  return `~${(Math.round((usd * TY_GIA) / 500) * 500).toLocaleString('vi-VN')}đ`;
}

function tien(usd: number | null): string {
  if (usd === null) return 'chưa rõ giá';
  const vnd = Math.round((usd * TY_GIA) / 500) * 500;
  return `~${vnd.toLocaleString('vi-VN')}đ (${usd.toFixed(2)} USD)`;
}

/** Lời đọc tối đa cho một cảnh: ~12 ký tự mỗi giây, chừa 1 giây (khớp máy chủ). */
function kyTuLoiToiDa(soGiay: number): number {
  return Math.max(20, Math.round(12 * (soGiay - 1)));
}

const LUA_CHON_AM: { khoa: 'nhac' | 'phuDe'; ten: string; giaiThich: string }[] = [
  { khoa: 'nhac', ten: 'Nhạc nền AI', giaiThich: 'Một bài nhạc liền từ đầu tới cuối' },
  { khoa: 'phuDe', ten: 'Phụ đề', giaiThich: 'Lời đọc hiện thành chữ, đúng dấu' },
];

const TEN_TRANG_THAI: Record<DuAnVideo['trang_thai'], string> = {
  nhap: 'Chờ bạn duyệt',
  dang_tao: 'Đang tạo từng cảnh',
  dang_ghep: 'Đang ghép thành một video',
  xong: 'Xong',
  loi: 'Lỗi',
};

export default function VideoDaiPanel({
  loai,
  noiDung,
  anhCoSan,
  doNet,
  khung,
  coTieng,
  congThucTrend,
  onGanVaoBai,
}: {
  loai: DuAnVideo['loai'];
  noiDung: string;
  anhCoSan: string[];
  doNet: string;
  khung: string;
  coTieng: boolean;
  /** Công thức rút ra từ video trend (chỉ dùng khi loai = 'trend'). */
  congThucTrend?: string;
  onGanVaoBai: (item: MediaItem) => void;
}) {
  // Trong Xưởng AI: ý tưởng = đề bài của ô soạn chung, ảnh tham chiếu = ảnh đã chọn ở ô soạn chung.
  const xuong = useXuong();
  const [yTuongRieng, setYTuong] = useState(noiDung);
  const yTuong = xuong ? xuong.deBai : yTuongRieng;
  const [tongGiay, setTongGiay] = useState(20);
  const [anhThamChieuRieng, setAnhThamChieu] = useState<string[]>([]);
  const anhThamChieu = xuong ? xuong.anhChon.slice(0, 4) : anhThamChieuRieng;
  const [dangTaiAnh, setDangTaiAnh] = useState(false);
  const [models, setModels] = useState<ModelVideo[]>([]);
  const [modelChon, setModelChon] = useState('');
  const [nhap, setNhap] = useState<DuAnVideo | null>(null);
  // Mặc định bật: phần lớn người xem Facebook tắt tiếng, video bán hàng cần lời và chữ.
  // Luật nội dung và hướng kịch bản ban đầu tắt — người dùng tự bật (không gài cứng).
  const [amThanh, setAmThanh] = useState<AmThanhVideo>({
    chuTrongVideo: 'theo_noi_dung', giongGoc: false, giongDoc: true, nhac: true, phuDe: true, chanNhanHieuGia: false, chanNguoiThat: false,
    kieuKichBan: 'tu_do',
  });
  // Nhiều phương án kịch bản để chọn trước khi tốn tiền video (Pippit "Batch Generation").
  const [soPhuongAn, setSoPhuongAn] = useState(1);
  const [nhapDs, setNhapDs] = useState<DuAnVideo[]>([]);
  const [cachLam, setCachLam] = useState<CheDoVideoDai>('noi_dai');
  const [loiDoc, setLoiDoc] = useState<LoiDoc>('ai_lite');
  // Mặc định bật: vẽ lại 1 cảnh lỗi rẻ hơn nhiều so với làm lại cả video.
  const [tuKiem, setTuKiem] = useState(true);
  const [dangChia, setDangChia] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangBatDau, setDangBatDau] = useState(false);
  const [duAn, setDuAn] = useState<DuAnVideo[]>([]);
  const [loi, setLoi] = useState('');
  const inputAnhRef = useRef<HTMLInputElement>(null);
  const daGan = useRef(new Set<number>());

  // Chỉ model nhận khung mở đầu mới nối cảnh liền mạch được.
  useEffect(() => {
    let huy = false;
    api.ai
      .videoModels(
        { soGiay: 8, doNet, khung, coTieng, coAnhMoDau: true },
        {
          tongGiay, cheDo: cachLam, tuKiem, soThamChieu: anhThamChieu.length, nhac: amThanh.nhac,
          giongGoc: loiDoc === 'goc', giongDoc: loiDoc === 'ai_lite' || loiDoc === 'ai_flash',
          modelGiong: loiDoc === 'ai_flash' ? MODEL_GIONG.ai_flash : MODEL_GIONG.ai_lite,
          khungModel: amThanh.veAnh?.model || undefined,
          khungDoNet: amThanh.veAnh?.doNet,
          khungChatLuong: amThanh.veAnh?.chatLuong,
        }
      )
      .then(({ data }) => {
        if (huy) return;
        // Nối dài: chỉ mô hình có tính năng nối dài của hãng. Ghép cảnh: mô hình nhận khung mở đầu.
        const noiDuoc = data.models.filter(
          (m) =>
            (cachLam === 'noi_dai' ? m.noiDai : m.anhMoDau) &&
            !m.lyDo?.includes('độ nét') && !m.lyDo?.includes('khung') && !m.lyDo?.includes('tiếng')
        );
        setModels(noiDuoc);
        setModelChon((cu) => (noiDuoc.some((m) => m.id === cu) ? cu : noiDuoc[0]?.id ?? ''));
      })
      .catch(() => undefined);
    return () => {
      huy = true;
    };
  }, [doNet, khung, coTieng, cachLam, tongGiay, tuKiem, anhThamChieu.length, amThanh.nhac, loiDoc, amThanh.veAnh?.model, amThanh.veAnh?.doNet, amThanh.veAnh?.chatLuong]);

  const conDangChay = duAn.some((d) => d.trang_thai === 'dang_tao' || d.trang_thai === 'dang_ghep');
  useEffect(() => {
    let huy = false;
    const tai = async () => {
      try {
        const { data } = await api.ai.duAnVideo();
        // "Từ ảnh tham chiếu" đã gộp vào "theo kịch bản" (ảnh sản phẩm dùng được ở mọi kiểu): hiện chung.
        const cungLoai = (l: DuAnVideo['loai']) => (loai === 'kich_ban' ? l === 'kich_ban' || l === 'tham_chieu' : l === loai);
        if (!huy) setDuAn(data.filter((d) => cungLoai(d.loai) && d.trang_thai !== 'nhap'));
      } catch {
        /* Lượt sau thử lại. */
      }
    };
    void tai();
    if (!conDangChay) return () => { huy = true; };
    const nhip = setInterval(tai, 15_000);
    return () => {
      huy = true;
      clearInterval(nhip);
    };
  }, [loai, conDangChay]);

  const taiAnhLen = async (f: File) => {
    setDangTaiAnh(true);
    setLoi('');
    try {
      const item = await api.posts.uploadMedia(f);
      setAnhThamChieu((truoc) => [...truoc, item.url].slice(0, 4));
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Không tải được ảnh lên');
    } finally {
      setDangTaiAnh(false);
    }
  };

  const chiaCanh = async () => {
    if (dangChia) return;
    if (!yTuong.trim()) return setLoi(xuong ? 'Viết ý tưởng ở ô soạn phía trên (hoặc bật "Theo nội dung bài đăng").' : 'Cần ý tưởng hoặc kịch bản.');
    if (!modelChon) return setLoi('Chưa có model nào nối cảnh được với lựa chọn này.');
    if (loai === 'tham_chieu' && anhThamChieu.length === 0) return setLoi('Chọn ít nhất một ảnh tham chiếu.');
    if (loai === 'trend' && !congThucTrend) return setLoi('Phân tích video trend trước.');
    setLoi('');
    setDangChia(true);
    try {
      // Mỗi phương án là một bản nháp riêng (chỉ tốn AI chữ); chọn một để tạo video.
      const ds = await Promise.all(
        Array.from({ length: soPhuongAn }, () =>
          api.ai.taoDuAnVideo({
            loai, yTuong, tongGiay, model: modelChon, doNet, khung, coTieng, anhThamChieu, congThucTrend, amThanh: amGui, tuKiem,
            cheDo: cachLam,
          })
        )
      );
      setNhapDs(ds.map((x) => x.data));
      setNhap(ds[0].data);
      setAmThanh({ ...amThanh, ...ds[0].data.am_thanh });
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'AI chưa chia được cảnh');
    } finally {
      setDangChia(false);
    }
  };

  /** Đổi phương án đang xem — giữ nguyên chỗ đã sửa ở phương án cũ. */
  const chonPhuongAn = (d: DuAnVideo) => {
    if (!nhap || d.id === nhap.id) return;
    setNhapDs((ds) => ds.map((x) => (x.id === nhap.id ? nhap : x)));
    setNhap(d);
  };

  const suaCanh = (i: number, sua: Partial<CanhVideo>) => {
    if (!nhap) return;
    setNhap({ ...nhap, phan_canh: nhap.phan_canh.map((c, j) => (j === i ? { ...c, ...sua } : c)) });
  };

  const luuThayDoi = async () => {
    if (!nhap || dangLuu) return;
    setDangLuu(true);
    setLoi('');
    try {
      const { data } = await api.ai.suaDuAnVideo(nhap.id, { nhatQuan: nhap.nhat_quan, phanCanh: nhap.phan_canh, amThanh: amGui });
      setNhap(data);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa lưu được phân cảnh');
    } finally {
      setDangLuu(false);
    }
  };

  const batDau = async () => {
    if (!nhap || dangBatDau) return;
    const gia = nhap.gia_uoc_tinh === null ? null : Number(nhap.gia_uoc_tinh);
    if (
      !(await hoiXacNhan({
        tieuDe: `Tạo video ${nhap.phan_canh.reduce((t, c) => t + c.soGiay, 0)} giây, ${nhap.phan_canh.length} cảnh?`,
        noiDung: `Chi phí ước tính: ${tien(gia)}.\nMất khoảng ${nhap.phan_canh.length * 2}–${nhap.phan_canh.length * 5} phút. Tiền bị trừ kể cả khi bạn không dùng video.`,
        nutDongY: 'Tạo video',
        bieuTuong: 'movie',
      }))
    ) return;
    setDangBatDau(true);
    setLoi('');
    try {
      await luuThayDoi();
      const { data } = await api.ai.batDauDuAnVideo(nhap.id);
      setDuAn((truoc) => [{ ...data, canh_xong: 0 }, ...truoc]);
      setNhap(null);
      setNhapDs([]);
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa bắt đầu được');
    } finally {
      setDangBatDau(false);
    }
  };

  const tiepTuc = async (id: number) => {
    setLoi('');
    try {
      const { data } = await api.ai.tiepTucDuAnVideo(id);
      setDuAn((truoc) => truoc.map((d) => (d.id === id ? { ...d, ...data, canh_xong: d.canh_xong } : d)));
    } catch (error) {
      setLoi(error instanceof ApiError ? error.message : 'Chưa làm tiếp được');
    }
  };

  const model = models.find((m) => m.id === modelChon);
  // Trong Xưởng AI: nút tạo ở ô soạn chung chạy bước kế tiếp — viết kịch bản, rồi duyệt và tạo video.
  const giaNhap = nhap && nhap.gia_uoc_tinh !== null ? Number(nhap.gia_uoc_tinh) : null;
  useDangKyHanhDong(
    `dai-${loai}`,
    nhap
      ? { nhan: dangBatDau ? 'Đang gửi…' : `Duyệt và tạo video — ${tien(giaNhap)}`, khoa: dangBatDau, dangChay: dangBatDau }
      : {
          nhan: dangChia
            ? 'AI đang viết kịch bản…'
            : `AI viết ${soPhuongAn > 1 ? `${soPhuongAn} phương án ` : ''}kịch bản${model?.giaCaVideo ? ` — video ${vnd(model.giaCaVideo.uocTinh)}` : ''}`,
          khoa: dangChia || !modelChon || !yTuong.trim(),
          dangChay: dangChia,
        },
    () => void (nhap ? batDau() : chiaCanh())
  );
  // Giọng gốc chỉ có ở mô hình nói tiếng Việt; đổi sang mô hình không nói được thì về giọng AI.
  const loiDocDung: LoiDoc = loiDoc === 'goc' && !model?.tiengVietGoc ? 'ai_lite' : loiDoc;
  const amGui: AmThanhVideo = {
    ...amThanh,
    giongGoc: loiDocDung === 'goc',
    giongDoc: loiDocDung === 'ai_lite' || loiDocDung === 'ai_flash',
    modelGiong: loiDocDung === 'ai_flash' ? MODEL_GIONG.ai_flash : MODEL_GIONG.ai_lite,
  };

  const nutChon = (chon: boolean) =>
    clsx(
      'text-left rounded-lg border px-3 py-2 transition-colors',
      chon ? 'border-primary bg-primary/15' : 'border-outline-variant bg-surface hover:border-primary/50'
    );

  const giaMoiGiay = model?.giaUocTinh != null ? model.giaUocTinh / 8 : null;
  const tomTatTuyChinh = [
    LOI_DOC.find((o) => o.id === loiDocDung)?.ten,
    amThanh.nhac ? 'nhạc' : '',
    amThanh.phuDe ? 'phụ đề' : '',
    CHU.find((c) => c.id === amThanh.chuTrongVideo)?.ten.toLowerCase(),
  ].filter(Boolean).join(' · ');
  const chonAmThanh = (
    <details className="bg-surface-container rounded-xl px-4 py-3 border border-outline-variant">
      <summary className="cursor-pointer text-xs font-bold text-on-surface">
        Tuỳ chỉnh thêm <span className="font-normal text-on-surface-variant">— {tomTatTuyChinh}</span>
      </summary>
      <div className="space-y-3 mt-3">
      <label className="block text-xs font-bold text-on-surface">Lời đọc</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LOI_DOC.map((o) => {
          const khongDuoc = o.id === 'goc' && !model?.tiengVietGoc;
          return (
            <button
              key={o.id}
              type="button"
              disabled={khongDuoc}
              aria-pressed={loiDocDung === o.id}
              onClick={() => setLoiDoc(o.id)}
              className={clsx(nutChon(loiDocDung === o.id), khongDuoc && 'opacity-40 cursor-not-allowed')}
            >
              <span className={clsx('block text-xs font-bold', loiDocDung === o.id ? 'text-primary' : 'text-on-surface-variant')}>
                {loiDocDung === o.id ? '✓ ' : ''}{o.ten}
              </span>
              <span className="block text-[11px] text-on-surface-variant">{khongDuoc ? 'Mô hình đang chọn không nói tiếng Việt' : o.giaiThich}</span>
            </button>
          );
        })}
      </div>
      <label className="block text-xs font-bold text-on-surface">Nhạc và phụ đề</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LUA_CHON_AM.map((o) => (
          <button
            key={o.khoa}
            type="button"
            aria-pressed={amThanh[o.khoa]}
            onClick={() => setAmThanh({ ...amThanh, [o.khoa]: !amThanh[o.khoa] })}
            className={clsx(
              'text-left rounded-lg border px-3 py-2 transition-colors',
              amThanh[o.khoa]
                ? 'border-primary bg-primary/15'
                : 'border-outline-variant bg-surface hover:border-primary/50'
            )}
          >
            <span className={clsx('block text-xs font-bold', amThanh[o.khoa] ? 'text-primary' : 'text-on-surface-variant')}>
              {amThanh[o.khoa] ? '✓ ' : ''}{o.ten}
            </span>
            <span className="block text-[11px] text-on-surface-variant">{o.giaiThich}</span>
          </button>
        ))}
      </div>
      <LuatNoiDungChon
        giaTri={{ chanNhanHieuGia: Boolean(amThanh.chanNhanHieuGia), chanNguoiThat: Boolean(amThanh.chanNguoiThat) }}
        onDoi={(v) => setAmThanh({ ...amThanh, ...v })}
      />
      <HuongKichBanChon
        an={['cauTrucQuangCao']}
        giaTri={{
          cauTrucQuangCao: Boolean(amThanh.cauTrucQuangCao),
          giuSuThat: Boolean(amThanh.giuSuThat),
          boiCanhVietNam: Boolean(amThanh.boiCanhVietNam),
        }}
        onDoi={(v) => setAmThanh({ ...amThanh, ...v })}
      />
      <label className="block text-xs font-bold text-on-surface">Chữ trong video</label>
      <div className="flex flex-wrap gap-2">
        {CHU.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setAmThanh({ ...amThanh, chuTrongVideo: c.id })}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
              amThanh.chuTrongVideo === c.id
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
            )}
          >
            {c.ten}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-on-surface-variant">
        Giọng AI riêng và nhạc làm một lần rồi trộn khi ghép — một giọng, một bài nhạc liền mạch (giọng ~vài trăm đồng,
        nhạc ~2.000đ). Phụ đề đặt ngoài vùng bị che của Facebook/Instagram Reels.
      </p>
      {/* Chỉ ghép cảnh mới vẽ khung mở đầu (cảnh cắt + ảnh mẫu nhân vật); nối dài thì không. */}
      {!nhap && cachLam === 'ghep_canh' && (
        <ChonMoHinhAnh
          tieuDe="Mô hình vẽ khung mở đầu cho cảnh cắt — xếp rẻ tới đắt"
          coAnhMau
          giaTri={amThanh.veAnh ?? { model: '' }}
          onDoi={(v) => setAmThanh((cu) => ({ ...cu, veAnh: v }))}
        />
      )}
      {/* Bộ kiểm "tự cắt cảnh / đổi ánh sáng" chỉ đúng với clip một cú máy — máy chủ bỏ qua nối dài và mô hình nhiều cảnh. */}
      {!nhap && (cachLam === 'noi_dai' || model?.nhieuCanh ? (
        <p className="text-[11px] text-on-surface-variant">
          Tự kiểm từng cảnh không áp dụng: {cachLam === 'noi_dai' ? 'nối dài' : 'mô hình này'} được phép cắt cảnh theo kịch bản.
        </p>
      ) : (
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5 shrink-0" checked={tuKiem} onChange={(e) => setTuKiem(e.target.checked)} />
          <span>
            <span className="block text-xs font-bold text-on-surface">Tự kiểm từng cảnh, cảnh lỗi thì vẽ lại</span>
            <span className="block text-[11px] text-on-surface-variant">
              Mỗi cảnh vẽ xong được kiểm ngay (tự cắt cảnh, đêm hoá ngày, mờ chồng). Cảnh lỗi được vẽ lại, tối đa 2
              cảnh mỗi video{giaMoiGiay !== null ? ` — thêm tối đa ${tien(giaMoiGiay * 8 * 2)}` : ''}. Rẻ hơn nhiều so
              với làm lại cả video.
            </span>
          </span>
        </label>
      ))}
      </div>
    </details>
  );

  return (
    <div className="space-y-3">
      {loi && <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{loi}</div>}

      {!nhap && (
        <>
          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
            {/* Trong Xưởng AI ý tưởng là ô soạn chung — không có ô riêng ở đây. */}
            {!xuong && (
              <>
                <label className="block text-xs font-bold text-on-surface">
                  {loai === 'trend' ? 'Sản phẩm / nội dung muốn làm theo trend' : 'Ý tưởng hoặc kịch bản'}
                </label>
                <textarea
                  rows={4}
                  value={yTuong}
                  onChange={(e) => setYTuong(e.target.value)}
                  placeholder="Ví dụ: mở đầu cận cảnh giọt mật, rồi rót mật vào hũ, kết bằng hũ mật trên bàn gỗ trong nắng sớm…"
                  className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-3 text-sm text-on-surface leading-relaxed focus:border-primary focus:outline-none resize-none"
                />
                <p className="text-[11px] text-on-surface-variant">
                  Viết tiếng Việt thoải mái. AI sẽ tự chia thành từng cảnh và giữ nhân vật, bối cảnh nhất quán xuyên suốt.
                </p>
              </>
            )}
            {xuong && (
              <p className="text-[11px] text-on-surface-variant">
                Ý tưởng lấy ở ô soạn phía trên; {anhThamChieu.length ? `dùng ${anhThamChieu.length} ảnh tham chiếu đã chọn để giữ đúng sản phẩm, nhân vật` : 'chưa chọn ảnh tham chiếu — chọn ảnh sản phẩm ở ô soạn để AI làm đúng hàng thật'}.
              </p>
            )}
            <label className="block text-xs font-bold text-on-surface pt-1">Kiểu kịch bản</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {KIEU_KICH_BAN.map((k) => {
                const chon = (amThanh.kieuKichBan ?? 'tu_do') === k.id;
                return (
                  <button key={k.id} type="button" aria-pressed={chon} onClick={() => setAmThanh({ ...amThanh, kieuKichBan: k.id })} className={nutChon(chon)}>
                    <span className={clsx('block text-xs font-bold', chon ? 'text-primary' : 'text-on-surface-variant')}>
                      {chon ? '✓ ' : ''}{k.ten}
                    </span>
                    <span className="block text-[11px] text-on-surface-variant">{k.giaiThich}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ảnh sản phẩm / nhân vật dùng được ở MỌI kiểu (trước chỉ có ở "Từ ảnh tham chiếu" — AI tự bịa hình sản phẩm).
              Trong Xưởng AI thì lấy ở dải ảnh tham chiếu của ô soạn chung. */}
          {!xuong && (
            <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-2">
              <label className="block text-xs font-bold text-on-surface">
                Ảnh sản phẩm / nhân vật — để AI làm đúng hàng thật (tối đa 4, không bắt buộc)
              </label>
              <input
                ref={inputAnhRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void taiAnhLen(f);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2">
                {[...new Set([...anhCoSan, ...anhThamChieu])].map((u) => {
                  const chon = anhThamChieu.includes(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        setAnhThamChieu((truoc) =>
                          chon ? truoc.filter((x) => x !== u) : [...truoc, u].slice(0, 4)
                        )
                      }
                      className="shrink-0"
                    >
                      <img
                        src={u}
                        alt=""
                        className={clsx(
                          'w-16 h-16 rounded-lg object-cover border-2',
                          chon ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                      />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => inputAnhRef.current?.click()}
                  disabled={dangTaiAnh || anhThamChieu.length >= 4}
                  className="w-16 h-16 rounded-lg border border-dashed border-outline-variant text-[11px] font-bold text-on-surface-variant hover:border-primary/50 disabled:opacity-50"
                >
                  {dangTaiAnh ? 'Đang tải…' : '+ Ảnh'}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Ảnh rõ mặt, rõ trang phục, rõ sản phẩm thì các cảnh giữ giống nhau tốt hơn. Chỉ dùng ảnh người đã
                đồng ý xuất hiện trong quảng cáo của bạn.
              </p>
              <ThuVienAnh onDung={(url) => setAnhThamChieu((truoc) => [...truoc.filter((x) => x !== url), url].slice(0, 4))} />
            </div>
          )}

          <div className="bg-surface-container rounded-xl p-4 border border-outline-variant space-y-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Tổng độ dài (giây)</label>
              <div className="flex flex-wrap items-center gap-2">
                {TONG_GIAY.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTongGiay(g)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                      tongGiay === g
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                    )}
                  >
                    {g}s
                  </button>
                ))}
                <input
                  type="number"
                  min={4}
                  max={TOI_DA_GIAY}
                  value={tongGiay}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (Number.isFinite(n)) setTongGiay(Math.min(TOI_DA_GIAY, Math.max(4, n)));
                  }}
                  className="bg-surface-container-high w-20 rounded-lg border border-outline-variant px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  aria-label="Tổng số giây tuỳ chọn"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Cách làm video dài</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CACH_LAM.map((c) => (
                  <button key={c.id} type="button" aria-pressed={cachLam === c.id} onClick={() => setCachLam(c.id)} className={nutChon(cachLam === c.id)}>
                    <span className={clsx('block text-xs font-bold', cachLam === c.id ? 'text-primary' : 'text-on-surface-variant')}>
                      {cachLam === c.id ? '✓ ' : ''}{c.ten}
                    </span>
                    <span className="block text-[11px] text-on-surface-variant">{c.giaiThich}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">
                Mô hình {cachLam === 'noi_dai' ? '(có tính năng nối dài của hãng)' : '(nối cảnh từ khung cuối được)'}, xếp rẻ tới đắt
              </label>
              <select
                value={modelChon}
                onChange={(e) => setModelChon(e.target.value)}
                className="bg-surface-container-high w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ten}{m.phanKhuc ? ` (${m.phanKhuc})` : ''} · tối đa {m.giayToiDa}s/lần{m.nhieuCanh ? ' · nhiều cảnh' : ''}{m.tiengVietGoc ? ' · nói tiếng Việt' : ''} — {m.giaCaVideo ? `${vnd(m.giaCaVideo.uocTinh)} cho ${tongGiay}s` : 'chưa rõ giá'}
                  </option>
                ))}
              </select>
              {model?.giaCaVideo && (
                <p
                  className="text-xs text-on-surface mt-1.5"
                  title="Gồm video từng đoạn, giọng đọc, nhạc nền, AI chia cảnh và tự kiểm theo đúng lựa chọn đang chọn."
                >
                  Giá video {tongGiay} giây hoàn thành: <b className="text-primary">{tien(model.giaCaVideo.uocTinh)}</b>
                  {model.giaCaVideo.toiDa > model.giaCaVideo.uocTinh * 1.02 && (
                    <span className="text-on-surface-variant"> · tối đa {vnd(model.giaCaVideo.toiDa)}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {chonAmThanh}

          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-xs font-bold text-on-surface">Số phương án kịch bản:</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSoPhuongAn(n)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                  soPhuongAn === n ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                )}
              >
                {n}
              </button>
            ))}
            <span className="text-[11px] text-on-surface-variant">AI viết sẵn để bạn chọn — mỗi phương án chỉ tốn AI chữ, chưa tốn tiền video.</span>
          </div>

          <button
            type="button"
            onClick={chiaCanh}
            disabled={dangChia || !modelChon}
            className="w-full py-3 rounded-lg border border-primary/50 bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <span className={clsx('material-symbols-outlined text-[18px]', dangChia && 'animate-spin')}>
              {dangChia ? 'progress_activity' : 'view_timeline'}
            </span>
            {dangChia
              ? 'AI đang viết kịch bản…'
              : soPhuongAn > 1
                ? `AI viết ${soPhuongAn} phương án kịch bản và báo giá (chưa tạo video)`
                : 'AI chia cảnh và báo giá (chưa tạo video)'}
          </button>
        </>
      )}

      {nhap && (
        <div className="bg-surface-container rounded-xl p-4 border border-primary/40 space-y-3">
          {nhapDs.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {nhapDs.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => chonPhuongAn(d)}
                  title={d.phan_canh[0]?.tomTat}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                    d.id === nhap.id ? 'border-primary bg-primary/15 text-primary' : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50'
                  )}
                >
                  Phương án {i + 1} · {tien(d.gia_uoc_tinh === null ? null : Number(d.gia_uoc_tinh))}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-on-surface">
              {nhap.phan_canh.length} {nhap.che_do === 'noi_dai' ? 'đoạn' : 'cảnh'} · {nhap.phan_canh.reduce((t, c) => t + c.soGiay, 0)} giây ·{' '}
              {tien(nhap.gia_uoc_tinh === null ? null : Number(nhap.gia_uoc_tinh))}
            </label>
            <button type="button" onClick={() => { setNhap(null); setNhapDs([]); }} className="text-xs text-on-surface-variant hover:text-on-surface">
              Làm lại
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
              Mô tả nhất quán — dùng chung cho mọi cảnh để giữ nhân vật, bối cảnh giống nhau
            </label>
            <textarea
              rows={3}
              value={nhap.nhat_quan}
              onChange={(e) => setNhap({ ...nhap, nhat_quan: e.target.value })}
              className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-2 text-xs text-on-surface leading-relaxed focus:border-primary focus:outline-none resize-none"
            />
          </div>
          {chonAmThanh}
          {nhap.phan_canh.map((c, i) => (
            <div key={i} className="rounded-lg border border-outline-variant p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary">
                  {nhap.che_do === 'noi_dai' ? 'Đoạn' : 'Cảnh'} {i + 1}
                  <span className="ml-2 font-normal text-on-surface-variant">
                    {i === 0
                      ? 'mở đầu'
                      : nhap.che_do === 'noi_dai'
                        ? 'mô hình nối dài tiếp đoạn trước'
                        : c.noiTiep
                          ? 'quay tiếp cảnh trước'
                          : 'cắt sang cảnh mới'}
                  </span>
                </span>
                <select
                  value={c.soGiay}
                  onChange={(e) => suaCanh(i, { soGiay: Number(e.target.value) })}
                  className="bg-surface-container-high rounded border border-outline-variant px-2 py-0.5 text-xs text-on-surface"
                >
                  {(model?.soGiay ?? [c.soGiay]).map((g) => (
                    <option key={g} value={g}>{g} giây</option>
                  ))}
                </select>
              </div>
              {c.tomTat && <p className="text-xs text-on-surface">{c.tomTat}</p>}
              {i > 0 && nhap.che_do !== 'noi_dai' && (
                <label className="flex items-center gap-2 text-[11px] text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={c.noiTiep}
                    onChange={(e) => suaCanh(i, { noiTiep: e.target.checked })}
                  />
                  Nối liền cảnh trước như một cú máy (bỏ chọn = cắt sang cảnh mới, AI vẽ khung mở đầu giữ đúng nhân vật)
                </label>
              )}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-on-surface-variant">Lời đọc / phụ đề</span>
                  <span
                    className={clsx(
                      'text-[11px]',
                      (c.loiDoc ?? '').length > kyTuLoiToiDa(c.soGiay) ? 'text-error font-bold' : 'text-on-surface-variant'
                    )}
                  >
                    {(c.loiDoc ?? '').length}/{kyTuLoiToiDa(c.soGiay)} ký tự
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={c.loiDoc ?? ''}
                  onChange={(e) => suaCanh(i, { loiDoc: e.target.value })}
                  placeholder="Để trống nếu cảnh này không có lời"
                  className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-2 text-xs text-on-surface leading-relaxed focus:border-primary focus:outline-none resize-none"
                />
                {(c.loiDoc ?? '').length > kyTuLoiToiDa(c.soGiay) && (
                  <p className="text-[11px] text-error">Lời dài hơn cảnh: AI sẽ đọc nhanh lên, có thể tràn sang cảnh sau.</p>
                )}
              </div>
              <textarea
                rows={3}
                value={c.moTa}
                onChange={(e) => suaCanh(i, { moTa: e.target.value })}
                className="bg-surface-container-high w-full rounded-lg border border-outline-variant p-2 text-[11px] text-on-surface-variant leading-relaxed focus:border-primary focus:outline-none resize-none"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={luuThayDoi}
              disabled={dangLuu}
              className="px-3 py-2 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary disabled:opacity-50"
            >
              {dangLuu ? 'Đang tính lại giá…' : 'Lưu và tính lại giá'}
            </button>
            <button
              type="button"
              onClick={batDau}
              disabled={dangBatDau}
              className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-sm font-bold hover:brightness-110 disabled:opacity-50"
            >
              {dangBatDau ? 'Đang gửi…' : 'Duyệt và tạo video'}
            </button>
          </div>
        </div>
      )}

      {duAn.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-on-surface">Video dài của cửa hàng này</label>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Video ghép nhiều cảnh đã được mã hoá lại nên Facebook có thể không tự nhận ra là video AI. Nếu video trông
            như thật, hãy tự bật nhãn "Nội dung AI" khi đăng để đúng quy định của nền tảng.
          </p>
          {duAn.map((d) => (
            <div key={d.id} className="bg-surface-container rounded-xl p-3 border border-outline-variant space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-on-surface-variant truncate">
                  {d.phan_canh.length} cảnh · {d.phan_canh.reduce((t, c) => t + c.soGiay, 0)}s · {d.model.split('/').pop()}
                </span>
                <span
                  className={clsx(
                    'shrink-0 font-bold',
                    d.trang_thai === 'xong'
                      ? 'text-primary'
                      : laDungDoKhoa(d)
                        ? 'text-amber-400'
                        : d.trang_thai === 'loi'
                          ? 'text-error'
                          : 'text-on-surface'
                  )}
                >
                  {laDungDoKhoa(d) ? 'Tạm dừng' : TEN_TRANG_THAI[d.trang_thai]}
                  {d.trang_thai === 'dang_tao' && ` (${d.canh_xong ?? 0}/${d.phan_canh.length})`}
                </span>
              </div>
              {d.trang_thai === 'xong' && d.url && (
                <>
                  <video src={d.url} controls playsInline className="w-full max-h-80 rounded-lg bg-black" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (daGan.current.has(d.id)) return;
                        daGan.current.add(d.id);
                        onGanVaoBai({ url: d.url!, type: 'video' });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
                    >
                      Gắn vào bài
                    </button>
                    <a
                      href={d.url}
                      download={`video-dai-${d.id}.mp4`}
                      className="px-3 py-1.5 rounded-lg border border-outline text-on-surface text-xs font-bold hover:border-primary"
                    >
                      Tải về máy
                    </a>
                    {d.gia_thuc !== null && (
                      <span className="text-[11px] text-on-surface-variant">Đã tốn {tien(Number(d.gia_thuc))}</span>
                    )}
                  </div>
                </>
              )}
              {d.trang_thai === 'loi' && (
                <p className={clsx('text-xs', laDungDoKhoa(d) ? 'text-amber-400' : 'text-error')}>{d.loi}</p>
              )}
              {(d.so_lan_ve_lai ?? 0) > 0 && (
                <p className="text-[11px] text-on-surface-variant">Đã tự vẽ lại {d.so_lan_ve_lai} cảnh bị lỗi.</p>
              )}
              {(d.canh_bao_kiem_dinh ?? []).map((w) => (
                <p key={w.canh} className="text-[11px] text-amber-400">
                  Cảnh {w.canh}: {w.ghiChu.replace(/^loi: /, 'còn lỗi — ').replace(/^khong_kiem_duoc: /, 'chưa kiểm được — ')}
                </p>
              ))}
              {d.trang_thai !== 'xong' && (d.da_ton ?? 0) > 0 && (
                <p className="text-[11px] text-on-surface-variant">Đã tốn tới lúc này: {tien(d.da_ton ?? 0)}</p>
              )}
              {d.trang_thai === 'loi' && (
                <button
                  type="button"
                  onClick={() => void tiepTuc(d.id)}
                  className="px-3 py-1.5 rounded-lg border border-primary/50 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
                >
                  {(d.canh_xong ?? 0) >= d.phan_canh.length
                    ? `Ghép lại — dùng ${d.phan_canh.length} cảnh đã tạo, không tốn tiền video`
                    : `Tạo tiếp — giữ ${d.canh_xong ?? 0}/${d.phan_canh.length} cảnh đã tạo, chỉ trả tiền ${d.phan_canh.length - (d.canh_xong ?? 0)} cảnh còn lại`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

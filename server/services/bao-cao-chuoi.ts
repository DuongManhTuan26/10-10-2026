/**
 * BÁO CÁO CHUỖI 4 KHÂU của MỘT TRANG (phần 2, chủ dự án duyệt 05/10/2026): Nội dung → Quảng cáo → Bán hàng → Tổng.
 *
 * Mọi khâu cùng một khung: đã làm gì · tốn bao nhiêu · ra kết quả gì · chuyển sang khâu sau được bao nhiêu · hỏng ở
 * đâu. Các khâu nối với nhau bằng MÃ THẬT (hoi_thoai_cham / conversations.origin / orders.origin — xem migration 042),
 * không đoán. Hội thoại có từ trước khi ghi nguồn ('message') tính riêng là "chưa ghi nguồn".
 *
 * Kỳ tính dùng chung với Tổng quan (kyTinh: tháng lịch giờ VN, kẹp từ mốc 05/10/2026). Tiền kênh và tiền quảng cáo của
 * trang đã có ở Tổng quan (TrangTongQuan) — giao diện ghép vào khâu Tổng, không tính lại hai lần ở đây.
 */
import { query, queryOne } from "../db.js";
import { soQuangCaoTrongKy, type QuangCaoTrongKy } from "./so-lieu-kenh.js";
import { VIEC, type Viec } from "./so-ai.js";
import { kyTinh, type KyTongQuan } from "./tong-quan.js";

const TIEN = "coalesce(a.cost_ncc, a.cost_usd)";
const viecCuaNhom = (...nhom: string[]) =>
  (Object.entries(VIEC) as [Viec, { nhom: string }][]).filter(([, v]) => nhom.includes(v.nhom)).map(([k]) => k);

/**
 * `khoang`: khoảng tuỳ chọn thay cho kỳ tháng — cho AI điều hành so TRƯỚC / SAU một thay đổi. Đường cho màn hình không
 * nhận khoảng từ ngoài (luôn theo kỳ đã kẹp từ mốc).
 */
export async function baoCaoChuoi(trangId: number, ky: KyTongQuan, khoang?: { tu: Date; den: Date }) {
  const kt = kyTinh(ky);
  const { tu, den } = khoang ?? kt;
  const truocMoc = khoang ? false : kt.truocMoc;
  const kenh = await query<{ id: string; platform: string; page_id: string | null; connected: boolean }>(
    "SELECT id, platform, page_id, connected FROM social_accounts WHERE trang_id = $1",
    [trangId]
  );
  const ky2 = [tu, den] as const;

  const [bai, soBai, tienNoiDung, hoiThoai, cham, don, donNguon, tinAi, phanHoi, nhuong, tienBanHang] = await Promise.all([
    // --- NỘI DUNG ---
    queryOne<{ dang: number; ai: number; loi: number }>(
      `SELECT count(*) FILTER (WHERE status = 'published' AND published_at >= $2 AND published_at < $3)::int AS dang,
              count(*) FILTER (WHERE status = 'published' AND ai_generated AND published_at >= $2 AND published_at < $3)::int AS ai,
              count(*) FILTER (WHERE status = 'failed' AND updated_at >= $2 AND updated_at < $3)::int AS loi
         FROM posts WHERE trang_id = $1`,
      // A1: bài thuộc cửa hàng theo trang_id (bản cũ suy qua kênh đích — bài có kênh đã chuyển cửa hàng bị đếm nhầm).
      [trangId, ...ky2]
    ),
    // Số MỚI NHẤT đã chụp của từng bài đăng trong kỳ (số cộng dồn trọn đời bài).
    queryOne<{ bai: number; hien_thi: number; tiep_can: number; tuong_tac: number; binh_luan: number }>(
      `SELECT count(*)::int AS bai, coalesce(sum(hien_thi), 0)::int AS hien_thi, coalesce(sum(tiep_can), 0)::int AS tiep_can,
              coalesce(sum(thich + binh_luan + chia_se), 0)::int AS tuong_tac, coalesce(sum(binh_luan), 0)::int AS binh_luan
         FROM (SELECT DISTINCT ON (account_id, post_ref) *
                 FROM so_bai_ngay
                WHERE trang_id = $1 AND post_ref <> '-' AND dang_luc >= $2 AND dang_luc < $3
                ORDER BY account_id, post_ref, ngay DESC) b`,
      // so_bai_ngay.trang_id = cửa hàng CỦA BÀI (đợt 1) — bài cũ trên kênh đã rời vẫn tính cho cửa hàng cũ (kênh là nhân viên).
      [trangId, ...ky2]
    ),
    queryOne<{ usd: string }>(
      `SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a
        WHERE a.trang_id = $1 AND a.created_at >= $2 AND a.created_at < $3 AND a.viec = ANY($4::text[])`,
      [trangId, ...ky2, viecCuaNhom("marketing", "anh", "video")]
    ),
    // --- BÁN HÀNG: hội thoại MỚI trong kỳ theo nguồn --- (cửa hàng CỦA HỘI THOẠI — nhiệm kỳ kênh, đợt 2b)
    query<{ origin: string; so: number; co_don: number }>(
      `SELECT c.origin, count(*)::int AS so,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o WHERE o.conversation_id = c.id))::int AS co_don
         FROM conversations c
        WHERE c.trang_id = $1 AND c.created_at >= $2 AND c.created_at < $3
        GROUP BY 1`,
      [trangId, ...ky2]
    ),
    // Lần chạm có mã trong kỳ (khách cũ bấm quảng cáo quay lại cũng tính).
    query<{ loai: string; hoi_thoai: number }>(
      `SELECT h.loai, count(DISTINCT h.conversation_id)::int AS hoi_thoai
         FROM hoi_thoai_cham h JOIN conversations c ON c.id = h.conversation_id
        WHERE c.trang_id = $1 AND h.luc >= $2 AND h.luc < $3
        GROUP BY 1`,
      [trangId, ...ky2]
    ),
    queryOne<{ so: number; huy: number; doanh_thu: string }>(
      `SELECT count(*)::int AS so, count(*) FILTER (WHERE status = 'cancelled')::int AS huy,
              coalesce(sum(total) FILTER (WHERE status <> 'cancelled'), 0)::text AS doanh_thu
         FROM orders WHERE trang_id = $1 AND created_at >= $2 AND created_at < $3`,
      [trangId, ...ky2]
    ),
    query<{ origin: string | null; so: number; doanh_thu: string }>(
      `SELECT origin, count(*) FILTER (WHERE status <> 'cancelled')::int AS so,
              coalesce(sum(total) FILTER (WHERE status <> 'cancelled'), 0)::text AS doanh_thu
         FROM orders WHERE trang_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY 1`,
      [trangId, ...ky2]
    ),
    queryOne<{ so: number }>(
      `SELECT count(*)::int AS so FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.trang_id = $1 AND m.sender_type = 'ai' AND m.created_at >= $2 AND m.created_at < $3`,
      [trangId, ...ky2]
    ),
    // Thời gian trả lời: từ tin khách tới tin trả lời KẾ TIẾP (AI hoặc người), trung vị — không để vài ca cực lâu kéo lệch.
    queryOne<{ trung_vi: number | null; so: number }>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY giay)::float AS trung_vi, count(*)::int AS so FROM (
         SELECT extract(epoch FROM (tl.created_at - m.created_at)) AS giay
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           JOIN LATERAL (SELECT created_at FROM messages n
                          WHERE n.conversation_id = m.conversation_id AND n.sender_type IN ('ai', 'human')
                            AND n.created_at > m.created_at ORDER BY n.created_at LIMIT 1) tl ON TRUE
          WHERE c.trang_id = $1 AND m.sender_type = 'customer'
            AND m.created_at >= $2 AND m.created_at < $3) x`,
      [trangId, ...ky2]
    ),
    query<{ ly_do: string; so: number }>(
      `SELECT coalesce(handoff_reason, 'Không rõ lý do') AS ly_do, count(*)::int AS so FROM conversations
        WHERE trang_id = $1 AND handoff_at >= $2 AND handoff_at < $3
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      [trangId, ...ky2]
    ),
    queryOne<{ usd: string }>(
      `SELECT coalesce(sum(${TIEN}), 0)::text AS usd FROM ai_usage a
        WHERE a.trang_id = $1 AND a.created_at >= $2 AND a.created_at < $3 AND a.viec = ANY($4::text[])`,
      [trangId, ...ky2, viecCuaNhom("ban_hang")]
    ),
  ]);

  // --- QUẢNG CÁO: số Meta, đúng Fanpage của trang ---
  let quangCao: QuangCaoTrongKy[] = [];
  let loiQuangCao: string | null = null;
  const fb = kenh.rows.find((k) => k.platform === "facebook" && k.connected && k.page_id);
  if (fb && !truocMoc) {
    try {
      quangCao = await soQuangCaoTrongKy(fb.id, fb.page_id!, tu, den);
    } catch (e) {
      console.error("[báo cáo chuỗi] Không đọc được quảng cáo:", e instanceof Error ? e.message : e);
      loiQuangCao = "Chưa đọc được số quảng cáo";
    }
  }
  const qcTheoTienTe = new Map<string, { chiTieu: number; hienThi: number; nhap: number; troChuyen: number | null }>();
  for (const q of quangCao) {
    const g = qcTheoTienTe.get(q.tienTe) ?? { chiTieu: 0, hienThi: 0, nhap: 0, troChuyen: null };
    g.chiTieu += q.chiTieu;
    g.hienThi += q.hienThi;
    g.nhap += q.nhap;
    if (q.troChuyen !== null) g.troChuyen = (g.troChuyen ?? 0) + q.troChuyen;
    qcTheoTienTe.set(q.tienTe, g);
  }
  const quangCaoLoi = quangCao.filter((q) => /reject|error|disapprov|with_issues/i.test(q.trangThai));

  const theoNguon = (o: string) => hoiThoai.rows.find((r) => r.origin === o) ?? { so: 0, co_don: 0 };
  const donTheo = (o: string) => donNguon.rows.find((r) => r.origin === o);
  const tongHoiThoai = hoiThoai.rows.reduce((s, r) => s + r.so, 0);
  const hoiThoaiCoDon = hoiThoai.rows.reduce((s, r) => s + r.co_don, 0);
  const chamCua = (l: string) => cham.rows.find((r) => r.loai === l)?.hoi_thoai ?? 0;
  const soDon = don?.so ?? 0;
  const doanhThu = Number(don?.doanh_thu) || 0;
  const donKhongHuy = soDon - (don?.huy ?? 0);

  return {
    kyTinh: { tu: tu.toISOString(), den: den.toISOString(), truocMoc },
    noiDung: {
      baiDang: bai?.dang ?? 0,
      baiAi: bai?.ai ?? 0,
      baiLoi: bai?.loi ?? 0,
      tienAiUsd: Number(tienNoiDung?.usd) || 0,
      hienThi: soBai?.hien_thi ?? 0,
      tiepCan: soBai?.tiep_can ?? 0,
      tuongTac: soBai?.tuong_tac ?? 0,
      binhLuan: soBai?.binh_luan ?? 0,
      // Chuyển sang khâu sau: hội thoại sinh ra từ bình luận → đơn.
      hoiThoaiTuBai: chamCua("binh_luan"),
      donTuBai: donTheo("binh_luan")?.so ?? 0,
      doanhThuTuBai: Number(donTheo("binh_luan")?.doanh_thu) || 0,
    },
    quangCao: {
      coFanpage: Boolean(fb),
      loi: loiQuangCao,
      theoTienTe: [...qcTheoTienTe].map(([tienTe, g]) => ({ tienTe, ...g })),
      soQuangCao: quangCao.length,
      quangCaoLoi: quangCaoLoi.map((q) => ({ ten: q.ten, trangThai: q.trangThai })),
      hoiThoaiTuQuangCao: chamCua("quang_cao"),
      donTuQuangCao: donTheo("quang_cao")?.so ?? 0,
      doanhThuTuQuangCao: Number(donTheo("quang_cao")?.doanh_thu) || 0,
    },
    banHang: {
      hoiThoaiMoi: tongHoiThoai,
      theoNguon: {
        quangCao: theoNguon("quang_cao").so,
        binhLuan: theoNguon("binh_luan").so,
        lienKet: theoNguon("lien_ket").so,
        tuNhan: theoNguon("tu_nhan").so,
        chuaGhiNguon: theoNguon("message").so,
      },
      tinAiTraLoi: tinAi?.so ?? 0,
      traLoiTrungViGiay: phanHoi?.trung_vi ?? null,
      soLanTraLoi: phanHoi?.so ?? 0,
      nhuongNguoi: nhuong.rows,
      soDon,
      donHuy: don?.huy ?? 0,
      doanhThu,
      giaTriDonTB: donKhongHuy > 0 ? doanhThu / donKhongHuy : null,
      // Tỉ lệ chốt: trong các hội thoại MỚI của kỳ, bao nhiêu hội thoại đã có đơn.
      tiLeChot: tongHoiThoai > 0 ? hoiThoaiCoDon / tongHoiThoai : null,
      tienAiUsd: Number(tienBanHang?.usd) || 0,
    },
  };
}

/**
 * Số liệu KÊNH cho báo cáo chuỗi 4 AI (phần 2, chủ dự án duyệt 05/10/2026).
 *
 *   - Bài đăng: chụp MỖI NGÀY số cộng dồn của từng bài (so_bai_ngay) — biết tăng bao nhiêu trong một khoảng, và so các
 *     bài ở cùng tuổi. Nguồn: GET /v1/analytics của nhà cung cấp kênh.
 *   - Quảng cáo: KHÔNG chụp — Meta trả đúng số của bất kỳ khoảng ngày nào và còn sửa số trong 28 ngày ("do not change
 *     after 28 days"), chụp lại là giữ số cũ. Đọc thẳng theo kỳ (soQuangCaoTrongKy).
 */
import { query } from "../db.js";
import * as ads from "./ads.js";
import * as zernio from "./zernio.js";

const NGAY_MS = 86_400_000;
const ngayVN = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
/** Bài đăng trong 30 ngày gần nhất vẫn còn được theo dõi số mỗi ngày. */
const SO_NGAY_THEO_DOI = 30;

/**
 * Chụp số bài của mọi kênh đang nối, MỖI KÊNH MỘT LẦN MỖI NGÀY (giờ VN). Gọi nhiều lần trong ngày chỉ chụp kênh chưa
 * chụp. Một kênh hỏng không làm dừng kênh khác.
 */
export async function chupSoBaiNgay(): Promise<number> {
  const homNay = ngayVN(new Date());
  const kenh = await query<{ id: string; user_id: number; trang_id: number | null }>(
    `SELECT s.id, s.user_id, s.trang_id FROM social_accounts s
      WHERE s.connected AND s.platform IN ('facebook', 'instagram', 'tiktok', 'youtube', 'threads', 'linkedin')
        AND NOT EXISTS (SELECT 1 FROM so_bai_ngay b WHERE b.ngay = $1::date AND b.account_id = s.id)
      LIMIT 20`,
    [homNay]
  );
  let dem = 0;
  for (const k of kenh.rows) {
    try {
      const tu = ngayVN(new Date(Date.now() - SO_NGAY_THEO_DOI * NGAY_MS));
      const bai = await zernio.layThongKeBai(k.id, tu, homNay);
      const cuaMinh = await query<{ id: number; ref: string; ai_generated: boolean }>(
        // A1: chỉ bài của cửa hàng sở hữu kênh (kênh chưa gắn cửa hàng thì như cũ: cả tài khoản).
        `SELECT id, platform_post_ref AS ref, ai_generated FROM posts
          WHERE user_id = $1 AND platform_post_ref IS NOT NULL AND ($2::bigint IS NULL OR trang_id = $2)`,
        [k.user_id, k.trang_id]
      );
      const theoRef = new Map(cuaMinh.rows.map((p) => [p.ref, p]));
      for (const b of bai) {
        const a = b.analytics ?? {};
        const p = theoRef.get(b._id) ?? (b.latePostId ? theoRef.get(b.latePostId) : undefined);
        await query(
          `INSERT INTO so_bai_ngay (ngay, account_id, post_ref, user_id, trang_id, post_id, ai_tao, dang_luc,
             hien_thi, tiep_can, thich, binh_luan, chia_se, nhap, luot_xem, la_quang_cao)
           VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (ngay, account_id, post_ref) DO NOTHING`,
          [homNay, k.id, b._id, k.user_id, k.trang_id, p?.id ?? null, p ? p.ai_generated : null,
            b.publishedAt ? new Date(b.publishedAt) : null,
            a.impressions ?? 0, a.reach ?? 0, a.likes ?? 0, a.comments ?? 0, a.shares ?? 0, a.clicks ?? 0, a.views ?? 0,
            b.isAd === true]
        );
      }
      // Kênh chưa có bài nào vẫn đánh dấu đã chụp hôm nay (một dòng rỗng) — không gọi lại liên tục.
      if (bai.length === 0) {
        await query(
          `INSERT INTO so_bai_ngay (ngay, account_id, post_ref, user_id, trang_id) VALUES ($1::date, $2, '-', $3, $4)
           ON CONFLICT DO NOTHING`,
          [homNay, k.id, k.user_id, k.trang_id]
        );
      }
      dem++;
    } catch (e) {
      // Câu lỗi gốc có tên nhà cung cấp — chỉ log máy chủ.
      console.error(`[số bài] Kênh ${k.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return dem;
}

/** Một quảng cáo trong kỳ: số Meta báo, theo đơn vị tiền của tài khoản quảng cáo. */
export interface QuangCaoTrongKy {
  id: string;
  ten: string;
  trangThai: string;
  taiKhoan: string;
  tienTe: string;
  chiTieu: number;
  hienThi: number;
  nhap: number;
  /** Cuộc trò chuyện bắt đầu (Meta: messaging conversations started). null = Meta không báo. */
  troChuyen: number | null;
}

/** Số trong `actions` của Meta theo loại (dạng mảng {action_type, value} hoặc đối tượng {loại: số}). */
function laySoHanhDong(actions: unknown, loai: RegExp): number | null {
  if (Array.isArray(actions)) {
    const x = actions.find((a) => loai.test(String((a as { action_type?: unknown }).action_type ?? "")));
    return x ? Number((x as { value?: unknown }).value) || 0 : null;
  }
  if (actions && typeof actions === "object") {
    const k = Object.keys(actions).find((t) => loai.test(t));
    return k ? Number((actions as Record<string, unknown>)[k]) || 0 : null;
  }
  return null;
}

/**
 * Các quảng cáo chạy cho ĐÚNG Fanpage (pageId) trong kỳ, qua kết nối Facebook của trang. Ngày đầu/cuối kỳ tính theo
 * múi giờ của tài khoản quảng cáo (Meta báo số theo múi giờ đó).
 */
// Mở lại báo cáo không gọi Meta liên tục: giữ 10 phút (Meta tự cập nhật 15 phút một lần).
const boNhoQc = new Map<string, { luc: number; kq: QuangCaoTrongKy[] }>();

export async function soQuangCaoTrongKy(kenhFb: string, pageId: string, tu: Date, den: Date): Promise<QuangCaoTrongKy[]> {
  const khoa = `${kenhFb}:${pageId}:${tu.toISOString().slice(0, 13)}:${den.toISOString().slice(0, 13)}`;
  const c = boNhoQc.get(khoa);
  if (c && Date.now() - c.luc < 600_000) return c.kq;
  const kq = await docQuangCaoTrongKy(kenhFb, pageId, tu, den);
  boNhoQc.set(khoa, { luc: Date.now(), kq });
  return kq;
}

async function docQuangCaoTrongKy(kenhFb: string, pageId: string, tu: Date, den: Date): Promise<QuangCaoTrongKy[]> {
  const dsTk = await ads.listAdAccounts(kenhFb);
  const ketQua: QuangCaoTrongKy[] = [];
  for (const tk of dsTk) {
    const lech = Number((tk as { timezoneOffsetHoursUtc?: unknown }).timezoneOffsetHoursUtc);
    const gio = Number.isFinite(lech) ? lech : 7;
    const ngay = (d: Date) => new Date(d.getTime() + gio * 3_600_000).toISOString().slice(0, 10);
    for (let trang = 1; trang <= 50; trang++) {
      const d = await ads.listAds({
        accountId: kenhFb, adAccountId: tk.id, pageId, fromDate: ngay(tu), toDate: ngay(new Date(den.getTime() - 1)),
        page: String(trang), limit: "500",
      });
      for (const a of d.ads as Array<Record<string, unknown>>) {
        const m = (a.metrics ?? {}) as Record<string, unknown>;
        ketQua.push({
          id: String(a.platformAdId ?? a._id ?? ""),
          ten: String(a.name ?? ""),
          trangThai: String(a.status ?? ""),
          taiKhoan: tk.name,
          tienTe: tk.currency,
          chiTieu: Number(m.spend) || 0,
          hienThi: Number(m.impressions) || 0,
          nhap: Number(m.clicks) || 0,
          troChuyen: laySoHanhDong(m.actions, /messaging_conversation_started/),
        });
      }
      if (trang >= (d.pagination?.pages ?? 1)) break;
    }
  }
  return ketQua;
}

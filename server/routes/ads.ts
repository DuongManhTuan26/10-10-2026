import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../auth.js";
import { kenhQuangCaoCuaCuaHang } from "../services/trang.js";
import { AppError, requireString, route } from "../http.js";
import * as ads from "../services/ads.js";
import * as zernio from "../services/zernio.js";
import { chatJson, asRecord, optionalString } from "../services/ai.js";
import { loadKnowledge } from "../services/knowledge.js";
import { boMarkdown, DAN_KHONG_MARKDOWN } from "../services/text.js";
import { chanLamDungAI } from "../services/chong-lam-dung.js";
import { ghiThayDoiNgoai } from "../services/so-thay-doi.js";
import { khoangTheoKy } from "../../src/lib/ky-ngay.js";
import { trangHienTai } from "../services/ngu-canh-trang.js";
import { chanCuaRa } from "../services/cua-ra.js";

export const adsRouter = Router();

adsRouter.use(requireAuth);

/**
 * Tìm tài khoản quảng cáo của người dùng.
 *
 * Trả về cả hai định danh vì Zernio cần accountId cho một số endpoint và
 * adAccountId cho phần lớn còn lại.
 */
async function resolveAdAccount(userId: number): Promise<{
  accountId: string;
  /** Cửa hàng của kênh quảng cáo (= cửa hàng đang chọn) — bộ não AI quảng cáo đọc theo cửa hàng này. */
  trangId: number;
  adAccountId: string;
  account: ads.AdAccount;
  /** Mọi tài khoản quảng cáo kênh này vào được, để chủ shop chọn. */
  tatCa: ads.AdAccount[];
  /** Đang dùng tài khoản chủ shop chọn, hay hệ thống tự đoán. */
  doChuShopChon: boolean;
} | null> {
  // A4b: kênh quảng cáo của CỬA HÀNG đang chọn (không còn "kênh quảng cáo đầu tiên của cả tài khoản").
  const row = await kenhQuangCaoCuaCuaHang(userId, await trangHienTai());
  if (!row) return null;

  const accounts = await ads.listAdAccounts(row.id);

  /*
   * Tôn trọng lựa chọn của chủ shop trước, tự đoán chỉ là phương án cuối.
   *
   * Đo thật: một kênh Meta Ads trả về HAI tài khoản quảng cáo. Mã cũ lặng lẽ
   * lấy cái đầu đang hoạt động, nên chiến dịch nằm ở tài khoản kia là trang
   * quảng cáo trống trơn — mà không một dòng nào nói đang xem tài khoản nào,
   * chủ shop không có cách nào đoán ra.
   *
   * Tài khoản đã chọn biến mất (bị gỡ quyền) thì rơi về tự đoán chứ không
   * chết, nhưng giao diện vẫn liệt kê đủ để chọn lại.
   */
  const daChon = row.ad_account_ref
    ? accounts.find((a) => a.id === row.ad_account_ref)
    : undefined;
  const active = daChon ?? accounts.find((a) => a.accountStatus === 1) ?? accounts[0];
  if (!active) return null;

  return {
    accountId: row.id,
    trangId: row.trang_id,
    adAccountId: active.id,
    account: active,
    tatCa: accounts,
    doChuShopChon: !!daChon,
  };
}

/** Tổng quan: tài khoản quảng cáo, chiến dịch và số liệu. */
adsRouter.get(
  "/overview",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);

    if (!resolved) {
      res.json({
        success: true,
        data: {
          connected: false,
          account: null,
          campaigns: [],
          insights: null,
          audiences: [],
        },
        message:
          // H11: quảng cáo Meta nối riêng cho từng cửa hàng (bản cũ bảo nó đi kèm kết nối Facebook — sai tài liệu).
          "Cửa hàng này chưa nối quảng cáo Meta. Vào Kết nối kênh, chọn cửa hàng rồi bấm Meta Ads " +
          "(cửa hàng cần nối Fanpage trước).",
      });
      return;
    }

    const datePreset =
      typeof req.query.range === "string" && req.query.range ? req.query.range : "last_7d";

    // Từng phần lấy độc lập: một phần lỗi không được làm trắng cả trang.
    const [campaigns, insights, audiences] = await Promise.all([
      ads
        // Số "đã chi" của từng chiến dịch theo ĐÚNG kỳ đang xem (bỏ trống thì nhà cung cấp tính 90 ngày).
        .listCampaigns({ accountId: resolved.accountId, adAccountId: resolved.adAccountId, ...khoangTheoKy(datePreset) })
        .catch((error) => {
          console.error("[quảng cáo] Không lấy được chiến dịch:", error.message);
          return { campaigns: [], total: 0 };
        }),
      ads
        .getInsights({
          accountId: resolved.accountId,
          objectId: resolved.adAccountId,
          datePreset,
        })
        .catch((error) => {
          console.error("[quảng cáo] Không lấy được số liệu:", error.message);
          return null;
        }),
      ads
        .listAudiences({
          accountId: resolved.accountId,
          adAccountId: resolved.adAccountId,
        })
        .catch((error) => {
          console.error("[quảng cáo] Không lấy được tệp đối tượng:", error.message);
          return [];
        }),
    ]);

    res.json({
      success: true,
      data: {
        connected: true,
        account: {
          accountId: resolved.accountId,
          adAccountId: resolved.adAccountId,
          name: resolved.account.name,
          currency: resolved.account.currency,
          status: resolved.account.accountStatus,
          timezone: resolved.account.timezoneName,
          minDailyBudget: resolved.account.minDailyBudget,
          amountSpent: resolved.account.amountSpent,
        },
        /*
         * Danh sách mọi tài khoản quảng cáo, kèm việc đang dùng cái nào và có
         * phải do chủ shop chọn hay không. Không gửi ra thì giao diện không có
         * cách nào cho chọn lại.
         */
        tatCaTaiKhoan: resolved.tatCa.map((a) => ({
          id: a.id,
          name: a.name,
          currency: a.currency,
          accountStatus: a.accountStatus,
        })),
        doChuShopChon: resolved.doChuShopChon,
        campaigns: campaigns.campaigns,
        insights,
        audiences,
        /** H9: ô "Dùng tệp đã lưu" khi đẩy bài — chỉ hiện khi cờ bật (ads.ts CO_TEP_DA_LUU, tắt tới lần thử thật đầu tiên). */
        nhamTepDaLuu: ads.CO_TEP_DA_LUU,
      },
    });
  })
);

/**
 * H9 (TD-25): tìm tỉnh / thành hoặc sở thích để nhắm khi đẩy bài. Gọi bằng kênh metaads của CỬA HÀNG đang chọn; chỉ trả
 * đúng loại (lọc ở máy chủ — ads.docKetQuaTimNham).
 */
adsRouter.get(
  "/tim-nham",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);
    const lenh = ads.lenhTimNham({ accountId: resolved.accountId, adAccountId: resolved.adAccountId, loai: req.query.loai, q: req.query.q });
    const ketQua = ads.docKetQuaTimNham(await ads.timNham(lenh), req.query.loai as ads.LoaiTimNham);
    res.json({ success: true, data: { ketQua } });
  })
);

/**
 * Chọn tài khoản quảng cáo để chạy.
 *
 * Một kênh Meta Ads vào được nhiều tài khoản quảng cáo. Không cho chọn thì hệ
 * thống tự đoán, và đoán sai là trang quảng cáo trống trơn không rõ lý do.
 */
adsRouter.put(
  "/tai-khoan-quang-cao",
  route(async (req, res) => {
    const ma = typeof req.body?.adAccountId === "string" ? req.body.adAccountId.trim() : "";
    if (!ma) throw new AppError("Chưa chọn tài khoản quảng cáo");

    // A4b: lưu lựa chọn trên kênh quảng cáo của CỬA HÀNG đang chọn.
    const kenh = await kenhQuangCaoCuaCuaHang(req.user!.id, await trangHienTai());
    if (!kenh) throw new AppError("Cửa hàng này chưa kết nối tài khoản quảng cáo", 404);

    /*
     * Chỉ nhận tài khoản mà kênh này THẬT SỰ vào được. Không kiểm thì người ta
     * gửi lên mã bất kỳ, và mọi lời gọi sau đó đều lỗi mà không rõ vì sao.
     */
    const vaoDuoc = await ads.listAdAccounts(kenh.id);
    if (!vaoDuoc.some((a) => a.id === ma)) {
      throw new AppError("Tài khoản quảng cáo này không thuộc kênh đang kết nối", 400);
    }

    await query(
      "UPDATE social_accounts SET ad_account_ref = $1, updated_at = now() WHERE id = $2",
      [ma, kenh.id]
    );
    res.json({ success: true, data: { adAccountId: ma } });
  })
);

/**
 * Bài đã đăng có thể đem đi quảng cáo — CHỈ bài của cửa hàng đang chọn (A1: bản cũ lấy cả tài khoản → cửa hàng B đẩy
 * được bài của A bằng tài khoản quảng cáo của B = tiêu tiền sai cửa hàng).
 */
adsRouter.get(
  "/boostable-posts",
  route(async (req, res) => {
    const trang = await trangHienTai();
    if (trang == null) {
      res.json({ success: true, data: [] });
      return;
    }
    const rows = await query(
      `SELECT id, content, platform_post_ref, published_at, stats, platform_urls
         FROM posts
        WHERE user_id = $1 AND trang_id = $2 AND status = 'published' AND platform_post_ref IS NOT NULL
        ORDER BY published_at DESC LIMIT 50`,
      [req.user!.id, trang]
    );
    res.json({ success: true, data: rows.rows });
  })
);

/**
 * Tạm dừng / chạy lại MỘT chiến dịch (B1-b2, đúng tài liệu PUT /v1/ads/campaigns/{id}/status — 30086).
 * - updated = 0 → KHÔNG báo "đã đổi": trả lời rõ không có quảng cáo nào đổi được (kèm câu của nhà cung cấp).
 * - 400 "spans multiple social accounts" → nói rõ lý do bằng tiếng Việt.
 */
adsRouter.post(
  "/campaigns/:id/status",
  route(async (req, res) => {
    const status = req.body?.status === "active" || req.body?.status === "paused" ? req.body.status : null;
    if (!status) throw new AppError("Trạng thái không hợp lệ (chỉ tạm dừng hoặc chạy lại)");
    const platform = typeof req.body?.platform === "string" ? req.body.platform : "";
    if (!ads.NEN_TANG_CHIEN_DICH.includes(platform)) throw new AppError("Thiếu hoặc sai nền tảng của chiến dịch");

    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    if (!(await ads.chienDichThuocTaiKhoan({ campaignId: req.params.id, accountId: resolved.accountId, adAccountId: resolved.adAccountId }))) {
      throw new AppError("Không tìm thấy chiến dịch này trong tài khoản quảng cáo của bạn", 404);
    }
    let result: Awaited<ReturnType<typeof ads.doiTrangThaiChienDich>>;
    try {
      result = await ads.doiTrangThaiChienDich(req.params.id, platform, status);
    } catch (error) {
      if (error instanceof ads.AdsError && error.status === 400 && /multiple social accounts/i.test(error.message)) {
        throw new AppError(
          "Chiến dịch này gồm quảng cáo của nhiều tài khoản mạng xã hội nên chưa đổi trạng thái cùng lúc được.",
          409
        );
      }
      throw error;
    }
    if (!result?.updated) {
      throw new AppError(
        `Không có quảng cáo nào trong chiến dịch đổi được trạng thái${result?.message ? ` (${result.message})` : ""}.`,
        409
      );
    }
    // Sổ thay đổi: quảng cáo đổi qua API nhà cung cấp, trigger không thấy — ghi tay SAU khi thành công.
    await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_chien_dich", banGhi: req.params.id, hanhDong: "sua", sau: { trang_thai: status }, nguon: "nguoi_dung" });

    res.json({ success: true, data: result });
  })
);

/**
 * Sửa ngân sách chiến dịch ngay trong app.
 *
 * Trước đây nút này mở Trình quản lý quảng cáo của Facebook. Mình trả tiền cho
 * Zernio đúng để khỏi phải đẩy chủ shop sang đó.
 */
adsRouter.patch(
  "/campaigns/:id/budget",
  route(async (req, res) => {
    const body = req.body ?? {};

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Ngân sách phải là một số lớn hơn 0");
    }

    const budgetType = body.budgetType === "lifetime" ? "lifetime" : "daily";
    // Tài liệu 28108: sửa ngân sách chiến dịch chỉ cho facebook / instagram / google (nền tảng khác 501).
    const platform = typeof body.platform === "string" ? body.platform : "";
    if (!ads.NEN_TANG_NGAN_SACH.includes(platform)) {
      throw new AppError("Nền tảng của chiến dịch này chưa hỗ trợ sửa ngân sách trong app.", 409);
    }

    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);
    // Lệnh tiêu tiền: PUT /v1/ads/campaigns/{id} không ràng buộc tài khoản quảng cáo (accountId "ignored otherwise") →
    // phải tự đối chiếu chiến dịch thuộc shop TRƯỚC khi đổi (phiên kiểm duyệt bắt được 18/10/2026).
    if (!(await ads.chienDichThuocTaiKhoan({ campaignId: req.params.id, accountId: resolved.accountId, adAccountId: resolved.adAccountId }))) {
      throw new AppError("Không tìm thấy chiến dịch này trong tài khoản quảng cáo của bạn", 404);
    }

    try {
      const result = await ads.updateCampaignBudget({
        campaignId: req.params.id,
        platform,
        amount,
        budgetType,
        accountId: resolved.accountId,
      });
      await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_chien_dich", banGhi: req.params.id, hanhDong: "sua", sau: { ngan_sach: amount, loai_ngan_sach: budgetType }, nguon: "nguoi_dung" });
      res.json({ success: true, data: result });
    } catch (error) {
      /*
       * 409 nghĩa là chiến dịch đặt ngân sách ở tầng nhóm quảng cáo (ABO), nên
       * lệnh sửa ở tầng chiến dịch bị từ chối. Đây là cấu hình hợp lệ của Meta,
       * không phải hỏng — nói rõ ra thay vì ném lỗi kỹ thuật vào mặt chủ shop.
       */
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        // ABO: ngân sách nằm ở tầng nhóm quảng cáo. Danh sách nhóm của nhà cung cấp chưa có trong tài liệu (chỉ có
        // /v1/ads/tree với adSets "No description") → chưa sửa được trong app; xem sổ tồn đọng TD-13.
        throw new AppError(
          "Chiến dịch này đặt ngân sách ở từng nhóm quảng cáo — ngân sách nằm ở tầng nhóm quảng cáo, chưa sửa được trong app.",
          409
        );
      }
      throw error;
    }
  })
);

// Đường danh sách nhóm quảng cáo (GET /api/ads/campaigns/:id/ad-sets) đã BỎ 18/10/2026: nó gọi GET /v1/ads/ad-sets —
// tài liệu nhà cung cấp KHÔNG có đường danh sách này (chỉ có /v1/ads/ad-sets/{id} và /v1/ads/tree). Sổ tồn đọng TD-13.

// Đường sửa ngân sách NHÓM quảng cáo (PATCH /api/ads/ad-sets/:id/budget) đã TẮT 19/10/2026 (phiên kiểm duyệt đề nghị):
// không màn nào gọi, mà kiểm chủ sở hữu qua GET /v1/ads/ad-sets/{id}?accountId không đủ — accountId chỉ "used to resolve
// the Meta token" (tài liệu 28755), hai cửa hàng dùng chung một tài khoản Facebook thì lọt. Làm lại cùng TD-13, khi đó so
// account_id của nhóm với tài khoản quảng cáo của cửa hàng.

adsRouter.post(
  "/campaigns/:id/duplicate",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    const platform = typeof req.body?.platform === "string" ? req.body.platform : "";
    if (!ads.NEN_TANG_NHAN_BAN.includes(platform)) {
      throw new AppError("Nền tảng của chiến dịch này chưa hỗ trợ nhân bản.", 409);
    }
    // Mỗi LẦN BẤM một khoá ngẫu nhiên do giao diện sinh (dùng lại khoá cũ thì nhà cung cấp trả lại kết quả cũ).
    const khoa = typeof req.body?.khoa === "string" && /^[\w-]{8,100}$/.test(req.body.khoa) ? req.body.khoa : null;
    if (!khoa) throw new AppError("Thiếu mã chống bấm trùng", 400);
    if (!(await ads.chienDichThuocTaiKhoan({ campaignId: req.params.id, accountId: resolved.accountId, adAccountId: resolved.adAccountId }))) {
      throw new AppError("Không tìm thấy chiến dịch này trong tài khoản quảng cáo của bạn", 404);
    }
    const result = await ads.nhanBanChienDich(req.params.id, platform, khoa);
    await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_chien_dich", banGhi: req.params.id, hanhDong: "them", sau: { nhan_ban_tu: req.params.id }, nguon: "nguoi_dung" });
    res.json({ success: true, data: result });
  })
);

adsRouter.get(
  "/campaigns/:id/analytics",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    // Đọc số liệu cũng phải là chiến dịch của shop (khoá API dùng chung cả nền tảng).
    if (!(await ads.chienDichThuocTaiKhoan({ campaignId: req.params.id, accountId: resolved.accountId, adAccountId: resolved.adAccountId }))) {
      throw new AppError("Không tìm thấy chiến dịch này trong tài khoản quảng cáo của bạn", 404);
    }
    const data = await ads.getCampaignAnalytics({
      campaignId: req.params.id,
      ...khoangTheoKy(typeof req.query.range === "string" ? req.query.range : "last_7d"),
    });
    res.json({ success: true, data });
  })
);

/** Đẩy ngân sách cho một bài đã đăng. */
adsRouter.post(
  "/boost",
  route(async (req, res) => {
    const body = req.body ?? {};
    const postId = Number(body.postId);
    const dailyBudget = Number(body.dailyBudget);
    const durationDays = Number(body.durationDays);

    if (!Number.isInteger(dailyBudget) || dailyBudget <= 0) {
      throw new AppError("Ngân sách mỗi ngày phải là số đồng lớn hơn 0");
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) {
      throw new AppError("Số ngày chạy phải từ 1 đến 90");
    }
    const mucTieu: ads.MucTieuDayBai = body.mucTieu === "tuong_tac" ? "tuong_tac" : "nhan_tin";
    // Nhắm chọn do MÁY CHỦ dựng từ lựa chọn đã kiểm (không chuyển thẳng thân yêu cầu của trình duyệt đi).
    const nhamChon = ads.dungNhamChon(body.nhamChon ?? {});
    // Mỗi lần BẤM một mã ngẫu nhiên (giao diện sinh): bấm lại = mã mới; cùng mã (mạng gửi lại) = không tạo lần hai.
    const khoa = typeof body.khoa === "string" && /^[\w-]{8,100}$/.test(body.khoa) ? body.khoa : null;
    if (!khoa) throw new AppError("Thiếu mã chống bấm trùng", 400);
    // Mốc của Ý ĐỊNH đẩy (giao diện giữ cùng mã): tên + ngày kết thúc dựng từ đây, không từ "bây giờ" — bấm lại sau "Chưa rõ
    // kết quả" phải ra thân lệnh GIỐNG HỆT thì nhà cung cấp mới trả lại quảng cáo cũ (khác thân cùng mã → 422).
    const batDau = ads.docMocDayBai(body.batDau, new Date());

    // A1: chỉ đẩy bài của CỬA HÀNG ĐANG CHỌN (kiểm TRƯỚC mọi lệnh gửi nhà cung cấp — tiêu tiền thật).
    const trangDangChon = await trangHienTai();
    const post = await queryOne<{ platform_post_ref: string | null; target_account_ids: string[]; trang_id: number | null }>(
      "SELECT platform_post_ref, target_account_ids, trang_id FROM posts WHERE id = $1 AND user_id = $2 AND trang_id = $3",
      [postId, req.user!.id, trangDangChon]
    );
    if (!post) throw new AppError("Không tìm thấy bài viết của cửa hàng đang chọn", 404);
    if (!post.platform_post_ref) {
      throw new AppError("Bài này chưa được đăng nên chưa thể quảng cáo", 409);
    }
    // CHỐT CỬA RA (services/cua-ra.ts): kênh của bài phải còn thuộc cửa hàng của bài (kênh đã rời → không đẩy bài cũ
    // trên Fanpage giờ làm cho cửa hàng khác). Lệnh đẩy chỉ nhận mã bài, nên chốt chỉ chặn.
    await chanCuaRa(req.user!.id, post.target_account_ids, post.trang_id);

    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    ads.kiemNganSachDayBai(resolved.account, dailyBudget);

    // H9: tệp đã lưu (sau cờ, tắt mặc định) — chỉ ở Tự chọn, tệp phải thuộc ĐÚNG tài khoản quảng cáo của cửa hàng.
    const tepChon = body.nhamChon?.tepDaLuu;
    if (tepChon !== undefined && tepChon !== null && tepChon !== "" && body.nhamChon?.cheDo !== "tu_chon") {
      throw new AppError("Tệp đã lưu chỉ dùng được ở Tự chọn người xem", 400);
    }
    const rawTargeting = ads.dungTepDaLuu(
      tepChon,
      tepChon === undefined || tepChon === null || tepChon === "" || !ads.CO_TEP_DA_LUU
        ? []
        : await ads.listAudiences({ accountId: resolved.accountId, adAccountId: resolved.adAccountId })
    );

    // Kênh metaads (đăng nhập doanh nghiệp) nhận bài bằng MÃ BÀI FACEBOOK, không nhận mã bài của nhà cung cấp (tài liệu).
    // Lấy từ chính bài đã kiểm ở trên — không bao giờ từ trình duyệt.
    const maBaiFb = ads.maBaiFacebook(await zernio.getPost(post.platform_post_ref));
    if (!maBaiFb) throw new AppError("Chưa lấy được mã bài trên Facebook (bài chưa lên Facebook?) nên chưa đẩy được", 409);

    const lenh = ads.lenhDayBai({
      accountId: resolved.accountId, adAccountId: resolved.adAccountId, platformPostId: maBaiFb, maBai: postId,
      nganSachNgay: dailyBudget, soNgay: durationDays, mucTieu, nhamChon, rawTargeting, khoa, bayGio: batDau,
    });
    let result: unknown;
    try {
      result = await ads.dayBai(lenh);
    } catch (error) {
      throw ads.loiLenhGhi(error, "đẩy bài") ?? error;
    }
    await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_day_bai", banGhi: String(postId), hanhDong: "them", sau: { bai: postId, ngan_sach_ngay: dailyBudget, so_ngay: durationDays, muc_tieu: mucTieu, doi_tuong: nhamChon, ...(rawTargeting ? { tep_da_luu: tepChon } : {}) }, nguon: "nguoi_dung" });

    res.status(201).json({ success: true, data: result });
  })
);

adsRouter.post(
  "/audiences",
  route(async (req, res) => {
    const body = req.body ?? {};
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);
    // Tệp "người đã tương tác với Fanpage" lấy Fanpage của CỬA HÀNG đang chọn (A4b) — không nhận mã trang từ trình duyệt.
    const fanpage = body.loai === "tuong_tac_fanpage"
      ? await queryOne<{ page_id: string | null }>(
          `SELECT page_id FROM social_accounts
            WHERE user_id = $1 AND trang_id = $2 AND platform = 'facebook' AND connected = TRUE AND page_id IS NOT NULL
            ORDER BY created_at LIMIT 1`,
          [req.user!.id, resolved.trangId]
        )
      : null;
    const than = ads.thanTaoTep({
      accountId: resolved.accountId,
      adAccountId: resolved.adAccountId,
      ten: body.ten,
      loai: body.loai,
      pageId: fanpage?.page_id ?? null,
      soNgay: body.soNgay,
      tepNguon: body.tepNguon,
      phanTram: body.phanTram,
    });
    let result: unknown;
    try {
      result = await ads.taoTep(than);
    } catch (error) {
      throw ads.loiLenhGhi(error, "tạo tệp đối tượng") ?? error;
    }
    await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_doi_tuong", banGhi: null, hanhDong: "them", sau: { ten: than.name, loai: than.type }, nguon: "nguoi_dung" });

    res.status(201).json({ success: true, data: result });
  })
);

adsRouter.put(
  "/audiences/:id",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : undefined;

    if (name === undefined && description === undefined) {
      throw new AppError("Không có thông tin nào để sửa.", 400);
    }
    if (name !== undefined && name === "") {
      throw new AppError("Tên tệp đối tượng không được để trống.", 400);
    }

    const result = await ads.updateAudience({
      accountId: resolved.accountId,
      audienceId: req.params.id,
      name,
      description,
    });
    await ghiThayDoiNgoai({ userId: req.user!.id, bang: "quang_cao_doi_tuong", banGhi: req.params.id, hanhDong: "sua", sau: { ten: name ?? null, mo_ta: description ?? null }, nguon: "nguoi_dung" });

    res.json({ success: true, data: result });
  })
);

adsRouter.post(
  "/reach-estimate",
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    const nhamChon = ads.dungNhamChon(req.body?.nhamChon ?? {});
    const raw = await ads.duBaoTiepCan(ads.lenhDuBao({ accountId: resolved.accountId, adAccountId: resolved.adAccountId, nhamChon }));
    res.json({ success: true, data: ads.docDuBao(raw) });
  })
);

/**
 * AI phân tích hiệu quả quảng cáo.
 *
 * Chỉ phân tích số liệu thật đang có. Không có chiến dịch nào thì nói rõ
 * là chưa có gì để phân tích, thay vì để AI bịa ra nhận định.
 */
adsRouter.post(
  "/analyze",
  chanLamDungAI,
  route(async (req, res) => {
    const resolved = await resolveAdAccount(req.user!.id);
    if (!resolved) throw new AppError("Chưa kết nối tài khoản quảng cáo", 409);

    const [campaigns, insights] = await Promise.all([
      ads
        .listCampaigns({ accountId: resolved.accountId, adAccountId: resolved.adAccountId })
        .catch(() => ({ campaigns: [], total: 0 })),
      ads
        .getInsights({
          accountId: resolved.accountId,
          objectId: resolved.adAccountId,
          datePreset: "last_30d",
        })
        .catch(() => null),
    ]);

    if (campaigns.campaigns.length === 0) {
      res.json({
        success: true,
        data: {
          hasData: false,
          findings:
            "Tài khoản quảng cáo đã kết nối nhưng chưa có chiến dịch nào đang chạy.",
          recommendation:
            "Vui lòng chọn một bài đã đăng có tương tác tốt và bấm quảng cáo cho bài đó. " +
            "AI sẽ phân tích hiệu quả ngay khi có số liệu chi tiêu đầu tiên.",
          actions: [],
        },
      });
      return;
    }

    const config = await queryOne<{ system_prompt: string }>(
      "SELECT system_prompt FROM ai_configs WHERE trang_id = $1 AND kind = 'ads'",
      [resolved.trangId]
    );

    // Tài liệu chủ shop đã dạy riêng cho AI quảng cáo.
    const knowledge = await loadKnowledge(resolved.trangId, "ads");

    const result = await chatJson({
      task: "ads",
      viec: "phan_tich_qc",
      userId: req.user!.id,
      messages: [
        {
          role: "system",
          content:
            (config?.system_prompt?.trim() ||
              "Bạn là chuyên gia quảng cáo Facebook, phân tích bằng tiếng Việt.") +
            knowledge +
            "\n\nChỉ dựa vào số liệu được cung cấp, tuyệt đối không bịa số. " +
            DAN_KHONG_MARKDOWN +
            ' Trả JSON: {"findings": string, "recommendation": string, "actions": string[]}',
        },
        {
          role: "user",
          content:
            `Tiền tệ: ${resolved.account.currency}\n` +
            `Chiến dịch: ${JSON.stringify(campaigns.campaigns).slice(0, 4_000)}\n` +
            `Số liệu 30 ngày: ${JSON.stringify(insights).slice(0, 4_000)}`,
        },
      ],
      validate: (value) => {
        const object = asRecord(value);
        return {
          hasData: true,
          findings: boMarkdown(optionalString(object.findings) ?? "Chưa đủ dữ liệu để kết luận."),
          recommendation: boMarkdown(optionalString(object.recommendation) ?? ""),
          actions: Array.isArray(object.actions)
            ? object.actions
                .filter((a): a is string => typeof a === "string")
                .map(boMarkdown)
            : [],
        };
      },
    });

    res.json({ success: true, data: result.output, usage: result.usage });
  })
);

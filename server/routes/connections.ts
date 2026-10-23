import crypto from "node:crypto";
import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../auth.js";
import { AppError, requireString, route } from "../http.js";
import * as zernio from "../services/zernio.js";
import { env } from "../env.js";
import { syncAccountsForUser, ensureProfile } from "../services/accounts.js";
import { donHoSo } from "../services/xoa-tai-khoan.js";
import { ghiNhatKyQuanTri } from "../services/nhat-ky-quan-tri.js";
import { lietKeKenhHoSo, phuThuocXoaThat } from "../services/xoa-tai-khoan-that.js";
import { chanNeuThemFanpage } from "../services/gioi-han.js";
import {
  chuCuaHoSo, ghiKenhTheoNgay, goKenh, hauQuaChuyenKenh, hoSoCuaCuaHang, taoTrangMoi, trangChuyenDuoc, trangCuaTaiKhoan,
} from "../services/trang.js";
import {
  socialChannels,
  adChannels,
  communicationChannels,
  allChannels,
  type PlatformChannel,
} from "../platforms.js";

export const connectionsRouter = Router();

/**
 * Router không đòi đăng nhập.
 *
 * Chỉ dùng cho đường quay về của luồng cấp quyền: đó là điều hướng khác site
 * nên không được phép phụ thuộc vào cookie phiên.
 */
export const connectionsPublicRouter = Router();

connectionsRouter.use(requireAuth);

/**
 * Danh mục kênh, kèm trạng thái kết nối thật của người dùng đang đăng nhập.
 *
 * Giao diện vẽ lưới kênh từ đây, nên trạng thái "Đã kết nối" luôn phản ánh
 * dữ liệu thật thay vì cờ ghi cứng trong mã.
 */
connectionsRouter.get(
  "/platforms",
  route(async (req, res) => {
    const accounts = await query<{
      id: string;
      platform: string;
      display_name: string;
      connected: boolean;
      needs_reconnection: boolean;
    }>(
      `SELECT id, platform, display_name, connected, needs_reconnection
         FROM social_accounts WHERE user_id = $1 AND go_luc IS NULL`,
      [req.user!.id]
    );

    const byPlatform = new Map<string, typeof accounts.rows>();
    for (const account of accounts.rows) {
      const list = byPlatform.get(account.platform) ?? [];
      list.push(account);
      byPlatform.set(account.platform, list);
    }

    const decorate = (channel: PlatformChannel) => {
      const linked = channel.platformKey
        ? (byPlatform.get(channel.platformKey) ?? [])
        : [];
      // Meta Ads không kết nối riêng — nó là tài khoản con của Facebook,
      // nên trạng thái của nó đọc từ platform 'metaads' đã đồng bộ về.
      const adLinked = channel.id === "fb_ads" ? (byPlatform.get("metaads") ?? []) : [];
      const all = linked.length ? linked : adLinked;

      return {
        ...channel,
        connectable: channel.platformKey !== null,
        connected: all.some((account) => account.connected),
        needsReconnection: all.some((account) => account.needs_reconnection),
        accountCount: all.length,
        accounts: all.map((account) => ({
          id: account.id,
          name: account.display_name,
          connected: account.connected,
          needsReconnection: account.needs_reconnection,
        })),
      };
    };

    res.json({
      success: true,
      data: {
        social: socialChannels.map(decorate),
        ads: adChannels.map(decorate),
        communication: communicationChannels.map(decorate),
      },
    });
  })
);

/** Danh sách tài khoản đã kết nối của chính người dùng đang đăng nhập. */
connectionsRouter.get(
  "/accounts",
  route(async (req, res) => {
    const result = await query(
      /*
       * trang_id đi kèm để giao diện biết kênh nào chung một bộ não.
       *
       * Một hồ sơ Zernio gom Fanpage, Instagram, TikTok của cùng một shop —
       * ba kênh nhưng chỉ một Trang, một bộ não. Đếm kênh thay vì đếm Trang
       * thì màn hình huấn luyện sẽ hỏi "bạn muốn dạy trang nào" trong khi
       * chỉ có đúng một trang để dạy.
       */
      `SELECT id, platform, username, display_name, profile_picture, profile_url,
              followers_count, connected, needs_reconnection, token_expires_at,
              last_synced_at, created_at, trang_id,
              (SELECT t.ten FROM trang t WHERE t.id = social_accounts.trang_id) AS trang_ten
         FROM social_accounts
        -- Kênh chủ shop đã gỡ (064) không hiện nữa; hội thoại / bài cũ của nó vẫn đọc được ở chỗ xem lịch sử.
        WHERE user_id = $1 AND go_luc IS NULL
        ORDER BY platform, display_name`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  })
);

/**
 * Đồng bộ danh sách tài khoản từ Zernio về database.
 *
 * Đây là nguồn sự thật: Zernio biết tài khoản nào còn sống, token nào sắp hết
 * hạn. Database chỉ là bản sao để giao diện đọc nhanh và để nối khoá ngoại.
 */

// ---------------------------------------------------------------------------
// Luồng kết nối headless — chặng quay về và chặng chọn Trang
// ---------------------------------------------------------------------------

/**
 * Đưa trình duyệt quay lại màn hình Kết nối của app.
 *
 * KHÔNG dùng cửa sổ bật lên nữa. Bản trước mở cửa sổ con rồi chờ nó đóng lại;
 * chủ shop báo "không thấy cửa sổ nào hiện ra" — trình duyệt chặn im lặng và
 * còn trả về một đối tượng giả, nên mã tưởng đã mở và ngồi chờ vô tận.
 *
 * Chuyển thẳng trang trong cùng một thẻ thì không bao giờ bị chặn, và đó cũng
 * là cách mọi luồng cấp quyền trên web vẫn làm.
 */
function backToApp(params: { ok: boolean; message?: string }): string {
  // Màn Kết nối kênh ở /ket-noi (đường /connections cũ vẫn chuyển hướng, giữ tham số).
  const url = new URL(`${env.appUrl}/ket-noi`);
  url.searchParams.set("connect", params.ok ? "select" : "error");
  if (params.message) url.searchParams.set("message", params.message);
  return url.toString();
}

/**
 * Nơi Zernio đẩy trình duyệt về sau khi khách cấp quyền trên Facebook.
 *
 * Đây là điều hướng cấp cao nhất trong chính trình duyệt của khách, nên cookie
 * phiên vẫn được gửi kèm (SameSite=Lax cho phép) và requireAuth phía trên vẫn
 * nhận ra người dùng.
 *
 * Việc duy nhất ở đây: cất dữ liệu của chặng 1 rồi đóng cửa sổ. KHÔNG gọi
 * Facebook hay Zernio tại đây — mọi lời gọi thêm đều kéo dài thời gian cửa sổ
 * đứng im trước mặt khách.
 */
connectionsPublicRouter.get(
  "/oauth/callback",
  route(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;

    // Nền tảng không cần chọn gì thêm thì Zernio tạo kênh luôn và trả accountId.
    if (q.accountId && !q.step) {
      res.redirect(backToApp({ ok: true }));
      return;
    }

    if (q.error) {
      res.redirect(
        backToApp({ ok: false, message: "Bạn đã huỷ cấp quyền hoặc Facebook từ chối. Vui lòng thử lại." })
      );
      return;
    }

    if (!q.tempToken || !q.profileId || !q.step) {
      res.redirect(
        backToApp({ ok: false, message: "Thiếu dữ liệu cấp quyền. Vui lòng bấm kết nối lại." })
      );
      return;
    }

    // userProfile về dưới dạng JSON đã mã hoá URL. Zernio đòi lại đúng OBJECT
    // đã giải mã ở bước chọn Trang, gửi nguyên chuỗi sẽ bị từ chối.
    let userProfile: Record<string, unknown> = {};
    if (q.userProfile) {
      try {
        userProfile = JSON.parse(decodeURIComponent(q.userProfile));
      } catch {
        res.redirect(
          backToApp({ ok: false, message: "Dữ liệu tài khoản trả về không đọc được. Vui lòng thử lại." })
        );
        return;
      }
    }

    /*
     * KHÔNG dựa vào cookie phiên ở đây.
     *
     * Đây là điều hướng quay về từ facebook.com qua zernio.com, tức là điều
     * hướng khác site. SameSite=Lax về lý thuyết vẫn gửi cookie cho điều hướng
     * GET cấp cao nhất, nhưng nếu vì bất kỳ lý do gì cookie không tới thì khách
     * sẽ nhìn thấy một cục JSON báo lỗi đăng nhập giữa cửa sổ bật lên — ngõ cụt
     * hoàn toàn. Đã dựng lại và thấy đúng như vậy.
     *
     * Nhận diện bằng MÃ BÍ MẬT sinh lúc bấm kết nối, không bằng profileId.
     *
     * (Trước đây chỗ này nhận diện bằng profileId vì nó luôn có sẵn trong
     * đường dẫn quay về. Sai: profileId nằm công khai, ai đọc được là dựng
     * được một đường quay về giả và ghi đè phiên cấp quyền đang dở của shop
     * khác.) Mã bí mật thì ngẫu nhiên 24 byte, chỉ sống 15 phút, mỗi lượt
     * một mã, và chỉ chủ shop bấm kết nối mới có.
     */
    const maBiMat = typeof req.query.state === "string" ? req.query.state : "";
    const owner = maBiMat
      ? await queryOne<{ user_id: number }>(
          `SELECT user_id FROM pending_connections
            WHERE connect_state = $1 AND expires_at > now()`,
          [maBiMat]
        )
      : null;

    if (!owner) {
      console.warn("[cấp quyền] Đường quay về thiếu mã hợp lệ hoặc mã đã hết hạn.");
      res.redirect(
        backToApp({
          ok: false,
          message: "Phiên cấp quyền không hợp lệ hoặc đã hết hạn. Vui lòng bấm kết nối lại.",
        })
      );
      return;
    }

    await query(
      `INSERT INTO pending_connections
         (user_id, platform, profile_id, temp_token, user_profile, connect_token, step,
          created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now() + interval '15 minutes')
       ON CONFLICT (user_id) DO UPDATE SET
         platform      = EXCLUDED.platform,
         profile_id    = EXCLUDED.profile_id,
         temp_token    = EXCLUDED.temp_token,
         user_profile  = EXCLUDED.user_profile,
         connect_token = EXCLUDED.connect_token,
         step          = EXCLUDED.step,
         created_at    = now(),
         expires_at    = now() + interval '15 minutes'`,
      [
        owner.user_id,
        q.platform ?? "facebook",
        q.profileId,
        q.tempToken,
        JSON.stringify(userProfile),
        q.connect_token ?? null,
        q.step,
      ]
    );

    res.redirect(backToApp({ ok: true }));
  })
);

/**
 * Danh sách Trang cho màn hình chọn.
 *
 * Giao diện dò đường dẫn này trong lúc chờ. Nó chỉ đọc bảng tạm của mình, và
 * chỉ gọi Zernio khi thật sự đã có dữ liệu cấp quyền — nên việc dò không đốt
 * hạn mức gọi Zernio dùng chung với bot trả lời khách.
 */
connectionsRouter.get(
  "/pending-selection",
  route(async (req, res) => {
    const pending = await queryOne<{
      platform: string;
      profile_id: string;
      temp_token: string;
      connect_token: string | null;
      step: string;
    }>(
      /*
       * CHỈ phiên đã có dữ liệu cấp quyền (temp_token). Dòng do /connect-url ghi lúc bấm nối chỉ có mã bí mật — bản cũ
       * coi nó là phiên chọn Fanpage → nối YouTube / Instagram / TikTok xong quay về lại báo "Phiên cấp quyền không
       * thuộc về tài khoản này", che mất câu báo thành công (rà 17/10/2026).
       */
      `SELECT platform, profile_id, temp_token, connect_token, step
         FROM pending_connections
        WHERE user_id = $1 AND expires_at > now() AND temp_token IS NOT NULL`,
      [req.user!.id]
    );

    if (!pending) {
      res.json({ success: true, data: { waiting: true, pages: [] } });
      return;
    }

    // Chốt chặn: chỉ chủ của hồ sơ đó mới được xem danh sách Trang (hồ sơ mặc định HOẶC hồ sơ của một trang của mình —
    // kênh nay nối thẳng vào hồ sơ của trang đã chọn).
    if ((await chuCuaHoSo(pending.profile_id)) !== req.user!.id) {
      throw new AppError("Phiên cấp quyền không thuộc về tài khoản này", 403);
    }

    const pages = await zernio.listFacebookPages({
      profileId: pending.profile_id,
      tempToken: pending.temp_token,
      connectToken: pending.connect_token,
    });

    res.json({
      success: true,
      data: {
        waiting: false,
        platform: pending.platform,
        step: pending.step,
        // Không trả tempToken ra giao diện: đó là khoá truy cập Facebook của
        // khách, giao diện không cần biết và cũng không nên biết.
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          username: p.username ?? null,
          category: p.category ?? null,
        })),
      },
    });
  })
);

/**
 * Chốt các Trang khách đã chọn. Đây là bước thật sự tạo kênh.
 */
connectionsRouter.post(
  "/select-pages",
  route(async (req, res) => {
    const pageIds = Array.isArray(req.body?.pageIds)
      ? req.body.pageIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (pageIds.length === 0) throw new AppError("Chưa chọn Fanpage nào");

    const pending = await queryOne<{
      profile_id: string;
      temp_token: string;
      user_profile: Record<string, unknown>;
      connect_token: string | null;
    }>(
      `SELECT profile_id, temp_token, user_profile, connect_token
         FROM pending_connections
        WHERE user_id = $1 AND expires_at > now() AND temp_token IS NOT NULL`,
      [req.user!.id]
    );

    if (!pending) {
      throw new AppError(
        "Phiên cấp quyền đã hết hạn. Vui lòng bấm kết nối lại để cấp quyền một lần nữa.",
        409
      );
    }

    if ((await chuCuaHoSo(pending.profile_id)) !== req.user!.id) {
      throw new AppError("Phiên cấp quyền không thuộc về tài khoản này", 403);
    }

    /*
     * Một tài khoản một Fanpage. Chặn TRƯỚC khi gọi Zernio: gọi rồi mới chặn
     * thì kênh đã được tạo bên họ, mình từ chối ở đây nhưng vẫn bị tính tiền
     * và vẫn phải đi dọn.
     */
    await chanNeuThemFanpage(req.user!.id, pending.profile_id, pageIds);

    const connected: string[] = [];
    const failed: Array<{ pageId: string; error: string }> = [];

    // Lần lượt từng Trang: mỗi Trang là một kênh riêng trên Zernio, và gửi dồn
    // cùng lúc chỉ làm khó việc chỉ ra Trang nào hỏng khi có lỗi.
    for (const pageId of pageIds) {
      try {
        const result = await zernio.selectFacebookPage({
          profileId: pending.profile_id,
          pageId,
          tempToken: pending.temp_token,
          userProfile: pending.user_profile,
          connectToken: pending.connect_token,
        });
        if (result.account?.accountId) connected.push(result.account.accountId);
      } catch (error) {
        failed.push({
          pageId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Dùng xong là xoá, không giữ khoá tạm của Facebook lâu hơn mức cần thiết.
    await query("DELETE FROM pending_connections WHERE user_id = $1", [req.user!.id]);

    if (connected.length === 0) {
      throw new AppError(
        `Không kết nối được Fanpage nào. ${failed[0]?.error ?? ""}`.trim(),
        502
      );
    }

    res.json({ success: true, data: { connected, failed } });
  })
);

connectionsRouter.post(
  "/sync",
  route(async (req, res) => {
    const user = req.user!;

    // Người dùng chưa có hồ sơ Zernio thì tạo mới, để dữ liệu shop này
    // tách khỏi các shop khác trên cùng một API key.
    const profileId = await ensureProfile(user);

    // Dùng chung đúng một hàm với bộ xử lý webhook account.connected. Trước đây
    // hai nơi có hai bản riêng, và bản bên webhook thiếu hẳn phần tạo mới.
    const soKenh = await syncAccountsForUser(user.id, profileId);

    const stored = await query(
      // Kèm trang_id y như lệnh liệt kê ở trên — hai nơi cùng nuôi một bộ chọn.
      `SELECT id, platform, username, display_name, profile_picture, profile_url,
              followers_count, connected, needs_reconnection, token_expires_at,
              trang_id, (SELECT t.ten FROM trang t WHERE t.id = social_accounts.trang_id) AS trang_ten
         FROM social_accounts WHERE user_id = $1 AND go_luc IS NULL ORDER BY platform, display_name`,
      [user.id]
    );

    res.json({ success: true, synced: soKenh, data: stored.rows });
  })
);

/**
 * Lấy URL cấp quyền cho một nền tảng.
 * Người dùng bấm vào, đăng nhập ở phía nền tảng, Zernio xử lý phần còn lại.
 */
connectionsRouter.post(
  "/connect-url",
  route(async (req, res) => {
    const platform = requireString(req.body, "platform", "nền tảng");

    const channel = allChannels.find(
      (item) => item.platformKey === platform || item.id === platform
    );
    if (!channel) {
      throw new AppError(`Hệ thống chưa hỗ trợ nền tảng "${platform}"`);
    }
    if (!channel.platformKey) {
      throw new AppError(
        channel.capabilityNote ??
          `Kênh ${channel.name} chưa kết nối được qua hệ thống.`,
        409
      );
    }

    const hoSoMacDinh = await ensureProfile(req.user!);

    /*
     * GẮN VÀO TRANG BÁN HÀNG NÀO — chủ shop BẮT BUỘC chọn, không có mặc định (chủ dự án 17/10/2026; như Sprout Social
     * bắt chọn "In Group" lúc nối). Kênh được nối THẲNG vào hồ sơ của trang đó bên nhà cung cấp — không nối vào hồ sơ
     * mặc định rồi rơi vào trang nào không ai thấy (đã xảy ra: trang cũ rỗng, bị ẩn khỏi bảng).
     * Mỗi cửa hàng một hộp: mọi kênh (kể cả Facebook) vào đúng hộp đó; trừ tài khoản quảng cáo (dùng chung).
     */
    // Mọi kênh — KỂ CẢ Facebook — vào đúng hộp của cửa hàng đã chọn (mỗi cửa hàng một Fanpage). Trừ tài khoản quảng cáo.
    const canChonTrang = !adChannels.some((c) => c.id === channel.id);
    const noiLai = await hoSoNoiLai(req.user!.id, (req.body as { noiLai?: unknown })?.noiLai, channel.platformKey);
    let profileId = noiLai ?? hoSoMacDinh;
    if (canChonTrang && !noiLai) {
      const trangId = Number((req.body as { trangId?: unknown })?.trangId);
      if (!Number.isInteger(trangId) || trangId <= 0) {
        throw new AppError("Chọn cửa hàng cho kênh này trước khi kết nối", 400);
      }
      profileId = (await hoSoCuaCuaHang(req.user!.id, trangId, channel.platformKey, channel.name)).profile_ref;
    }

    /*
     * Luồng headless: Zernio KHÔNG dựng màn hình chọn Trang, mà đẩy trình duyệt
     * về địa chỉ của mình kèm dữ liệu cấp quyền. Mình tự dựng màn hình chọn.
     *
     * Hai lý do, cả hai đều bắt buộc với một sản phẩm bán cho khách:
     *   1. Chế độ mặc định ném khách sang zernio.com. Khách nhìn thấy nhà cung
     *      cấp hạ tầng và có thể mua thẳng bên đó, bỏ qua mình.
     *   2. Cửa sổ cấp quyền không bao giờ quay lại app, nên màn hình kết nối
     *      treo vô tận — đúng lỗi chủ shop đã gặp.
     */
    /*
     * Mã bí mật cho đúng lượt cấp quyền này.
     *
     * Đường quay về trước đây nhận diện chủ shop chỉ bằng profileId — thứ không
     * phải bí mật. Ai biết profileId của shop khác là ghi đè được phiên cấp
     * quyền đang dở của họ.
     *
     * Ghi mã TRƯỚC khi đưa khách đi, để lúc quay về còn có cái mà đối chiếu.
     */
    const maBiMat = crypto.randomBytes(24).toString("base64url");
    await query(
      `INSERT INTO pending_connections (user_id, connect_state, created_at, expires_at)
       VALUES ($1, $2, now(), now() + interval '15 minutes')
       ON CONFLICT (user_id) DO UPDATE SET
         connect_state = EXCLUDED.connect_state,
         created_at    = now(),
         expires_at    = now() + interval '15 minutes'`,
      [req.user!.id, maBiMat]
    );

    const url = await zernio.getConnectUrl(channel.platformKey, profileId, {
      headless: true,
      redirectUrl: `${env.appUrl}/api/connections/oauth/callback?state=${maBiMat}`,
    });
    res.json({ success: true, url });
  })
);

/**
 * Các hồ sơ Zernio chưa có shop nào nhận.
 *
 * Dành cho người đã dùng Zernio trước khi đăng ký hệ thống này: thay vì bắt
 * họ kết nối lại từ đầu, cho phép nhận luôn hồ sơ đang có kèm tài khoản.
 */
/**
 * Hai đường nhận hồ sơ có sẵn là công cụ NỘI BỘ (api.ts cố ý không gọi). Trước 22/10/2026 mọi tài khoản đã đăng nhập
 * — kể cả khách tự đăng ký — gọi thẳng được: xem tên hồ sơ chưa ai nhận của cả team rồi nhận về mình (đọc được tin
 * nhắn của hồ sơ đó). Chỉ quản trị, và không phải lúc quản trị đang mở hộ tài khoản khác.
 */
function chiQuanTri(req: { user?: { role: string; moBoi?: number | null } }): void {
  if (req.user?.role !== "admin" || req.user.moBoi != null) throw new AppError("Phần này dành cho quản trị", 403);
}

connectionsRouter.get(
  "/available-profiles",
  route(async (req, res) => {
    chiQuanTri(req);
    const profiles = await zernio.listProfiles();

    // Hồ sơ riêng của Trang người khác cũng là đã có chủ.
    const claimed = await query<{ profile_ref: string }>(
      `SELECT profile_ref FROM users
        WHERE profile_ref IS NOT NULL AND id <> $1
       UNION
       SELECT profile_ref FROM trang WHERE user_id <> $1`,
      [req.user!.id]
    );
    const claimedIds = new Set(claimed.rows.map((row) => row.profile_ref));

    const accounts = await zernio.listAccountsCaTeam();
    const countByProfile = new Map<string, number>();
    for (const account of accounts) {
      const profileId = zernio.accountProfileId(account);
      if (profileId) {
        countByProfile.set(profileId, (countByProfile.get(profileId) ?? 0) + 1);
      }
    }

    res.json({
      success: true,
      data: profiles
        .filter((profile) => !claimedIds.has(profile._id))
        .map((profile) => ({
          id: profile._id,
          name: profile.name,
          accountCount: countByProfile.get(profile._id) ?? 0,
          isCurrent: profile._id === req.user!.profileRef,
        })),
    });
  })
);

connectionsRouter.post(
  "/adopt-profile",
  route(async (req, res) => {
    chiQuanTri(req);
    const profileId = requireString(req.body, "profileId", "hồ sơ");

    // Hồ sơ đã thuộc về shop khác thì tuyệt đối không cho nhận, nếu không
    // hai shop sẽ cùng đọc được tin nhắn của nhau.
    // Kể cả hồ sơ riêng của một Trang người khác.
    const taken = await queryOne(
      `SELECT id FROM users WHERE profile_ref = $1 AND id <> $2
       UNION
       SELECT user_id FROM trang WHERE profile_ref = $1 AND user_id <> $2`,
      [profileId, req.user!.id]
    );
    if (taken) {
      throw new AppError("Hồ sơ này đã được một tài khoản khác sử dụng", 409);
    }

    const profiles = await zernio.listProfiles();
    if (!profiles.some((profile) => profile._id === profileId)) {
      throw new AppError("Không tìm thấy hồ sơ này", 404);
    }

    await query("UPDATE users SET profile_ref = $1, updated_at = now() WHERE id = $2", [
      profileId,
      req.user!.id,
    ]);

    res.json({ success: true, profileId });
  })
);

/*
 * "ĐỔI FANPAGE" ĐÃ BỎ (chủ dự án chốt 17/10/2026): mỗi cửa hàng một Fanpage. Muốn dùng Fanpage khác thì ngắt Fanpage
 * cũ rồi nối Fanpage mới, hoặc nối Fanpage đó vào một cửa hàng khác. Đổi Fanpage tại chỗ từng làm một hộp bị chia làm
 * hai cửa hàng và bảng lệch với thực tế (bắt được 17/10).
 */

/*
 * TELEGRAM + BLUESKY — hai nền tảng KHÔNG nối bằng đăng nhập (tài liệu nhà cung cấp). Vẫn bắt chọn trang trước như
 * mọi kênh khác (kiemTrangNhanKenh), kênh nối thẳng vào hồ sơ của trang đó.
 *
 * Mã Telegram mình đã phát lưu ở bảng ma_telegram_da_phat (061 — trước nằm trong bộ nhớ: máy chủ khởi động lại giữa lúc
 * người dùng đang nối là gãy): chỉ chủ mã mới dò được trạng thái, mã hết hạn sau 15 phút.
 */

/*
 * NỐI LẠI một kênh đang có (token chết / cần cấp lại quyền): phải đi vào ĐÚNG hồ sơ đang chứa kênh đó để nhà cung cấp
 * làm mới chính tài khoản ấy, giữ nguyên trang. Nối vào hồ sơ khác là đẻ thêm một tài khoản thứ hai (Instagram) hoặc
 * nối Facebook vào hồ sơ mặc định trong khi Fanpage ở hồ sơ riêng — đã thấy 17/10/2026 khi rà nút "Nối lại".
 */
async function hoSoNoiLai(userId: number, accountId: unknown, platform: string): Promise<string | null> {
  if (typeof accountId !== "string" || !accountId) return null;
  const k = await queryOne<{ profile_ref: string }>(
    "SELECT profile_ref FROM social_accounts WHERE id = $1 AND user_id = $2 AND platform = $3",
    [accountId, userId, platform]
  );
  if (!k?.profile_ref) throw new AppError("Không tìm thấy kênh cần nối lại", 404);
  return k.profile_ref;
}

connectionsRouter.post(
  "/telegram/ma",
  route(async (req, res) => {
    await ensureProfile(req.user!);
    const noiLai = await hoSoNoiLai(req.user!.id, (req.body as { noiLai?: unknown })?.noiLai, "telegram");
    const trangId = Number((req.body as { trangId?: unknown })?.trangId);
    if (!noiLai && (!Number.isInteger(trangId) || trangId <= 0)) throw new AppError("Chọn cửa hàng cho kênh này trước khi kết nối", 400);
    const profile_ref = noiLai ?? (await hoSoCuaCuaHang(req.user!.id, trangId, "telegram", "Telegram")).profile_ref;
    const ma = await zernio.layMaTelegram(profile_ref);
    // Dọn mã đã hết hạn (mọi tài khoản) rồi ghi mã mới — cùng mã phát lại thì cập nhật chủ + hạn.
    await query("DELETE FROM ma_telegram_da_phat WHERE het < now()");
    await query(
      `INSERT INTO ma_telegram_da_phat (ma, user_id, het) VALUES ($1, $2, $3)
       ON CONFLICT (ma) DO UPDATE SET user_id = EXCLUDED.user_id, het = EXCLUDED.het`,
      [ma.code, req.user!.id, new Date(ma.expiresAt)]
    );
    res.json({ success: true, data: ma });
  })
);

connectionsRouter.get(
  "/telegram/trang-thai",
  route(async (req, res) => {
    const code = String(req.query.code ?? "");
    const ma = await queryOne<{ het: Date }>(
      "SELECT het FROM ma_telegram_da_phat WHERE ma = $1 AND user_id = $2",
      [code, req.user!.id]
    );
    if (!ma) throw new AppError("Không tìm thấy mã này — bấm lấy mã mới", 404);
    if (ma.het.getTime() < Date.now()) {
      await query("DELETE FROM ma_telegram_da_phat WHERE ma = $1", [code]);
      res.json({ success: true, data: { status: "expired" } });
      return;
    }
    const status = await zernio.kiemMaTelegram(code);
    if (status === "connected") {
      await query("DELETE FROM ma_telegram_da_phat WHERE ma = $1", [code]);
      await syncAccountsForUser(req.user!.id, req.user!.profileRef);
    }
    res.json({ success: true, data: { status } });
  })
);

connectionsRouter.post(
  "/bluesky",
  route(async (req, res) => {
    const identifier = requireString(req.body, "identifier", "Tên tài khoản Bluesky");
    const appPassword = requireString(req.body, "appPassword", "Mật khẩu ứng dụng");
    await ensureProfile(req.user!);
    const noiLai = await hoSoNoiLai(req.user!.id, (req.body as { noiLai?: unknown })?.noiLai, "bluesky");
    const trangId = Number((req.body as { trangId?: unknown })?.trangId);
    if (!noiLai && (!Number.isInteger(trangId) || trangId <= 0)) throw new AppError("Chọn cửa hàng cho kênh này trước khi kết nối", 400);
    const dich = noiLai ? { profile_ref: noiLai, ten: "" } : await hoSoCuaCuaHang(req.user!.id, trangId, "bluesky", "Bluesky");
    await zernio.noiBluesky(identifier, appPassword, dich.profile_ref);
    await syncAccountsForUser(req.user!.id, req.user!.profileRef);
    res.json({ success: true, message: noiLai ? `Đã nối lại Bluesky ${identifier}.` : `Đã nối Bluesky ${identifier} vào cửa hàng "${dich.ten}".` });
  })
);

/** Trang bán hàng của tài khoản kèm số kênh — kể cả trang chưa có kênh (bộ chọn bộ não không thấy được trang rỗng). */
connectionsRouter.get(
  "/trang",
  route(async (req, res) => {
    /*
     * Cửa hàng đầu tiên còn mã hồ sơ tạm (tài khoản chủ chuỗi cũ được cấp ở migration 055) → cấp hồ sơ nền tảng thật
     * ngay, đúng như lúc đăng ký mới. Không làm thì cửa hàng đó bị coi là "dùng chung hộp" và không nối được kênh.
     */
    if (!req.user!.profileRef) {
      const choCap = await queryOne("SELECT 1 FROM trang WHERE user_id = $1 AND profile_ref LIKE 'cho-cap-%'", [req.user!.id]);
      if (choCap) await ensureProfile(req.user!);
    }
    const ds = await trangCuaTaiKhoan(req.user!.id);
    res.json({
      success: true,
      data: ds.map((t) => ({ id: t.id, ten: t.ten, soKenh: t.so_kenh, nenTang: t.nen_tang, hopRieng: t.hop_rieng })),
    });
  })
);

/** Tạo trang bán hàng mới theo tên chủ shop gõ — để nối kênh vào hoặc chuyển kênh sang. */
connectionsRouter.post(
  "/trang",
  route(async (req, res) => {
    const ten = requireString(req.body, "ten", "Tên cửa hàng").trim();
    if (ten.length > 80) throw new AppError("Tên cửa hàng dài tối đa 80 ký tự", 400);
    await ensureProfile(req.user!);
    const id = await taoTrangMoi(req.user!.id, ten, req.user!.name || req.user!.email, zernio.createProfile);
    res.json({ success: true, data: { id, ten }, message: `Đã tạo cửa hàng "${ten}".` });
  })
);

/*
 * ĐẶT TÊN TRANG BÁN HÀNG (chủ dự án duyệt 12/10/2026).
 *
 * Trang được tự đặt tên theo kênh đầu tiên (thường là Fanpage) — đổi Fanpage xong thì trang cũ vẫn mang tên Fanpage
 * cũ, trang mới trùng chữ với kênh của nó; chủ shop đọc không hiểu (đã xảy ra thật). Tên tự đặt được đồng bộ giữ
 * nguyên (baoDamTrangChoHoSo chỉ đè tên tạm). Chỉ trang của chính tài khoản đang đăng nhập.
 */
connectionsRouter.put(
  "/trang/:id/ten",
  route(async (req, res) => {
    const ten = requireString(req.body, "ten", "Tên cửa hàng").trim();
    if (ten.length > 80) throw new AppError("Tên cửa hàng dài tối đa 80 ký tự", 400);
    const r = await queryOne<{ id: number }>(
      "UPDATE trang SET ten = $1, updated_at = now() WHERE id = $2 AND user_id = $3 RETURNING id",
      [ten, Number(req.params.id), req.user!.id]
    );
    if (!r) throw new AppError("Không tìm thấy cửa hàng này", 404);
    res.json({ success: true, message: `Đã đổi tên cửa hàng thành "${ten}".` });
  })
);

/*
 * XOÁ TRANG BÁN HÀNG (chủ dự án 17/10/2026: "ko có phần xoá đi à?").
 *
 * Xoá trang là xoá LUÔN bộ não của nó (ai_configs, ai_documents — ON DELETE CASCADE), video AI, dự án video, thư viện
 * ảnh; đơn hàng và sổ chi phí giữ lại nhưng mất liên kết trang (SET NULL). Nên chỉ cho xoá trang KHÔNG CÒN KÊNH NÀO,
 * và luôn chừa lại ít nhất một trang. Hồ sơ bên nhà cung cấp chỉ xoá khi không còn ai dùng và không còn kênh nào.
 */
connectionsRouter.delete(
  "/trang/:id",
  route(async (req, res) => {
    const userId = req.user!.id;
    const t = await queryOne<{ id: number; ten: string; profile_ref: string; so_kenh: number; so_trang: number }>(
      `SELECT t.id, t.ten, t.profile_ref,
              (SELECT count(*)::int FROM social_accounts s WHERE s.trang_id = t.id AND s.connected) AS so_kenh,
              (SELECT count(*)::int FROM trang t2 WHERE t2.user_id = $2) AS so_trang
         FROM trang t WHERE t.id = $1 AND t.user_id = $2`,
      [Number(req.params.id), userId]
    );
    if (!t) throw new AppError("Không tìm thấy cửa hàng này", 404);
    if (t.so_kenh > 0) throw new AppError(`Cửa hàng "${t.ten}" còn ${t.so_kenh} kênh — chuyển hoặc ngắt các kênh đó trước khi xoá.`, 409);
    if (t.so_trang <= 1) throw new AppError("Phải giữ lại ít nhất một cửa hàng.", 409);

    await query("DELETE FROM trang WHERE id = $1 AND user_id = $2", [t.id, userId]);

    // Dọn hồ sơ nhà cung cấp nếu không còn trang / tài khoản nào dùng và hồ sơ đã rỗng (rác hồ sơ — xem xoaHoSo).
    const conDung = await queryOne(
      `SELECT 1 FROM trang WHERE profile_ref = $1 UNION SELECT 1 FROM users WHERE profile_ref = $1 LIMIT 1`,
      [t.profile_ref]
    );
    if (!conDung && !t.profile_ref.startsWith("cho-cap-")) {
      /*
       * Cùng luật với xoá tài khoản (services/xoa-tai-khoan.ts — donHoSo): kênh ĐÃ NGẮT còn trong hồ sơ sẽ bị nhà cung cấp
       * chuyển sang một hồ sơ khác khi xoá hồ sơ (tài liệu 16373) → ngắt hết (kèm hồ sơ vượt hạn mức), liệt kê lại, còn
       * sót thì KHÔNG xoá hồ sơ. Cửa hàng chỉ xoá được khi không còn kênh đang nối, nên đây chỉ đụng kênh đã ngắt.
       */
      try {
        const daLam: string[] = [];
        const kq = await donHoSo(t.profile_ref, await lietKeKenhHoSo(t.profile_ref), phuThuocXoaThat, daLam);
        if ("loi" in kq) {
          // Ghi vào nhật ký quản lý (admin xem ở màn Quản lý) để còn dọn sau — không chỉ log máy chủ.
          await ghiNhatKyQuanTri({
            adminId: userId, targetId: userId, targetEmail: req.user!.email, action: "don_ho_so_cua_hang_do",
            detail: { cuaHang: t.ten, hoSo: t.profile_ref, daLam, conLai: kq.conLai, loi: kq.loi },
          });
        }
      } catch (error) {
        await ghiNhatKyQuanTri({
          adminId: userId, targetId: userId, targetEmail: req.user!.email, action: "don_ho_so_cua_hang_do",
          detail: { cuaHang: t.ten, hoSo: t.profile_ref, loi: error instanceof Error ? error.message : String(error) },
        });
      }
    }
    res.json({ success: true, message: `Đã xoá cửa hàng "${t.ten}".` });
  })
);

/*
 * CHUYỂN KÊNH SANG CỬA HÀNG KHÁC (chủ dự án chốt 17/10/2026 — mỗi cửa hàng một hộp/hồ sơ, mỗi nền tảng một ngăn).
 *
 * Chuyển THẬT kênh sang hồ sơ của cửa hàng đích (đồng bộ xếp kênh theo hồ sơ). Cửa hàng đích đã có cùng nền tảng thì
 * chặn — nhà cung cấp chỉ một tài khoản mỗi nền tảng mỗi hồ sơ, chuyển vào là thay tài khoản cũ, xoá hội thoại. Chốt sổ
 * kênh-theo-ngày trước khi chuyển: ngày chuyển tính cửa hàng cũ, từ hôm sau cửa hàng mới.
 */
connectionsRouter.put(
  "/accounts/:id/trang",
  route(async (req, res) => {
    const trangId = Number((req.body as { trangId?: unknown })?.trangId);
    const { kenh, ds } = await trangChuyenDuoc(req.user!.id, String(req.params.id));
    if (!kenh) throw new AppError("Không tìm thấy kênh này", 404);
    const dich = ds.find((t) => t.id === trangId);
    if (!dich) throw new AppError("Không chuyển được kênh sang cửa hàng này", 400);
    const tenNenTang = allChannels.find((c) => c.platformKey === kenh.platform)?.name ?? kenh.platform;
    if (dich.da_co) {
      throw new AppError(
        `Cửa hàng "${dich.ten}" đã có ${tenNenTang} — mỗi cửa hàng chỉ có một ${tenNenTang}. ` +
          `Muốn đổi chỗ hai kênh: (1) chuyển ${tenNenTang} đang ở "${dich.ten}" sang một cửa hàng khác (có thể tạo cửa hàng tạm); ` +
          `(2) chuyển kênh này sang "${dich.ten}"; (3) chuyển kênh kia về cửa hàng bạn muốn.`,
        409
      );
    }
    // Chốt sổ ngày TRƯỚC khi chuyển: hôm nay tính cửa hàng cũ, từ mai cửa hàng mới. Chuyển THẬT kênh sang hộp (hồ sơ)
    // của cửa hàng đích — mỗi hồ sơ đúng một cửa hàng; đồng bộ ngay để kênh vào đúng cửa hàng.
    await ghiKenhTheoNgay();
    if (kenh.profile_ref !== dich.profile_ref) await zernio.chuyenKenhSangHoSo(kenh.id, dich.profile_ref);
    await query("UPDATE social_accounts SET trang_chon = NULL WHERE id = $1 AND user_id = $2", [kenh.id, req.user!.id]);
    await syncAccountsForUser(req.user!.id, req.user!.profileRef);
    // Kiểm lại thật — không báo "đã chuyển" khi kênh chưa nằm ở cửa hàng đích.
    const sau = await queryOne<{ trang_id: number | null }>(
      "SELECT trang_id FROM social_accounts WHERE id = $1 AND user_id = $2",
      [kenh.id, req.user!.id]
    );
    if (sau?.trang_id !== dich.id) {
      throw new AppError("Nhà cung cấp chưa chuyển xong kênh. Đợi ít phút rồi bấm \"Kiểm tra lại kết nối\".", 502);
    }
    res.json({
      success: true,
      message: `Đã chuyển kênh sang cửa hàng "${dich.ten}". Từ giờ bộ não AI của cửa hàng này trả lời khách trên kênh đó.`,
    });
  })
);

/** Hậu quả nếu chuyển kênh này đi (đợt 3) — hộp xác nhận chuyển kênh đọc để nói trước. Chỉ đọc. */
connectionsRouter.get(
  "/accounts/:id/hau-qua",
  route(async (req, res) => {
    res.json({ success: true, data: await hauQuaChuyenKenh(req.user!.id, String(req.params.id)) });
  })
);

connectionsRouter.delete(
  "/accounts/:id",
  route(async (req, res) => {
    const account = await queryOne<{ id: string }>(
      "SELECT id FROM social_accounts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!account) {
      throw new AppError("Không tìm thấy tài khoản này", 404);
    }

    // Nhà cung cấp gỡ TRƯỚC (lỗi → báo lỗi, không đổi gì). Rồi "nghỉ việc" trong app: đóng nhiệm kỳ, tắt kịch bản, gỡ lịch
    // bài hẹn giờ (services/trang.ts goKenh). Giao dịch lỗi sau khi nhà cung cấp đã gỡ (hiếm) → lượt đồng bộ sau đánh dấu
    // mất kết nối như cũ.
    await zernio.disconnectAccount(account.id);
    await goKenh(account.id, req.user!.id);

    res.json({ success: true, message: "Đã ngắt kết nối. Hội thoại cũ của kênh này vẫn xem được trong Hộp thư." });
  })
);

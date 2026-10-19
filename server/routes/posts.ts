import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../auth.js";
import { AppError, requireString, route, chiNhanMaSo } from "../http.js";
import * as zernio from "../services/zernio.js";
import { publishPost, toMediaItems } from "../services/publish.js";
import { doiChieuMotBai, ghiKetQua } from "../services/post-status.js";
import { anDiaChiKho, doiDiaChiMedia } from "../services/media-proxy.js";
import { kenhNgoaiCuaHang, LOI_KENH_NGOAI_CUA_HANG, LOI_KENH_NGOAI_CUA_HANG_DANG_CHON } from "../services/kenh-dang.js";
import { trangHienTai } from "../services/ngu-canh-trang.js";
import { chanCuaRa } from "../services/cua-ra.js";
import { BAI_VE_NHAP_SAU_GO } from "../services/don-lich.js";

export const postsRouter = Router();

// Mọi :id ở đây là mã số — chữ lạ thì 404, không để database vỡ ra 500.
postsRouter.param("id", chiNhanMaSo);

postsRouter.use(requireAuth);

/**
 * Kho tạm của Zernio giữ tệp vừa tải lên 7 ngày; chỉ khi bài dùng nó được đăng
 * thì tệp mới chuyển sang kho vĩnh viễn.
 *
 * Vì vậy bài hẹn lịch xa hơn 7 ngày sẽ lên sóng mà MẤT ảnh, trong khi mọi bước
 * trước đó đều báo thành công. Chặn ngay lúc đặt lịch, kèm lời giải thích, thay
 * vì để chủ shop phát hiện qua một bài trống ảnh trên Fanpage.
 */
const MEDIA_TEMP_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

function assertMediaSurvivesSchedule(
  media: zernio.MediaItem[],
  scheduledFor: Date | null
): void {
  if (media.length === 0 || !scheduledFor) return;
  if (scheduledFor.getTime() - Date.now() <= MEDIA_TEMP_WINDOW_MS) return;

  throw new AppError(
    "Bài có ảnh chỉ hẹn được trong vòng 7 ngày, vì Zernio chỉ giữ tệp mới tải " +
      "lên trong 7 ngày rồi mới chuyển sang lưu vĩnh viễn khi bài được đăng. " +
      "Vui lòng chọn thời gian gần hơn, hoặc hẹn bài chữ trước rồi thêm ảnh sát ngày đăng."
  );
}

/** Mọi kênh (nối hay chưa) của một cửa hàng — để kiểm kênh đích của bài thuộc đúng cửa hàng (A1). */
async function kenhCuaCuaHang(userId: number, trangId: number): Promise<string[]> {
  const r = await query<{ id: string }>("SELECT id FROM social_accounts WHERE user_id = $1 AND trang_id = $2", [
    userId,
    trangId,
  ]);
  return r.rows.map((k) => k.id);
}

const STATUSES = new Set([
  "draft",
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "failed",
]);

/*
 * Che địa chỉ kho trước khi bài rời khỏi máy chủ.
 *
 * Trong database vẫn là địa chỉ gốc — chỉ bản gửi xuống trình duyệt mới đổi.
 */
function anMediaTrongBai<T>(bai: T): T {
  if (!bai || typeof bai !== "object") return bai;
  const r = bai as Record<string, unknown>;
  if (!("media" in r)) return bai;
  return { ...r, media: doiDiaChiMedia(r.media, anDiaChiKho) } as T;
}

postsRouter.get(
  "/",
  route(async (req, res) => {
    const { status } = req.query;
    // A1: danh sách bài của CỬA HÀNG ĐANG CHỌN (bản cũ lấy cả tài khoản → cửa hàng B thấy và duyệt được bài của A).
    const trang = await trangHienTai();
    if (trang == null) {
      res.json({ success: true, data: [], summary: { pending_approval: 0, scheduled: 0, published: 0, draft: 0, failed: 0 } });
      return;
    }
    const conditions = ["user_id = $1", "trang_id = $2"];
    const params: unknown[] = [req.user!.id, trang];

    if (typeof status === "string" && status !== "" && status !== "all") {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const rows = await query(
      `SELECT * FROM posts WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC LIMIT 200`,
      params
    );

    const summary = await queryOne(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_approval,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int        AS scheduled,
              COUNT(*) FILTER (WHERE status = 'published')::int        AS published,
              COUNT(*) FILTER (WHERE status = 'draft')::int            AS draft,
              COUNT(*) FILTER (WHERE status = 'failed')::int           AS failed
         FROM posts WHERE user_id = $1 AND trang_id = $2`,
      [req.user!.id, trang]
    );

    res.json({ success: true, data: rows.rows.map(anMediaTrongBai), summary });
  })
);

postsRouter.post(
  "/",
  route(async (req, res) => {
    const body = req.body ?? {};
    const content = requireString(body, "content", "nội dung bài viết");

    const status = STATUSES.has(body.status) ? body.status : "draft";
    const targetAccountIds = Array.isArray(body.targetAccountIds)
      ? body.targetAccountIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    let scheduledFor: Date | null = null;
    if (body.scheduledFor) {
      scheduledFor = new Date(body.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime())) {
        throw new AppError("Thời gian hẹn đăng không hợp lệ");
      }
      if (scheduledFor.getTime() <= Date.now()) {
        throw new AppError("Thời gian hẹn đăng phải ở tương lai");
      }
    }

    if (status === "scheduled" && !scheduledFor) {
      throw new AppError("Bài hẹn giờ phải có thời gian đăng");
    }

    const media = toMediaItems(body.media);
    assertMediaSurvivesSchedule(media, scheduledFor);

    // A1: bài thuộc cửa hàng đang chọn; kênh đích phải là kênh của chính cửa hàng đó (kiểm TRƯỚC khi ghi).
    const trang = await trangHienTai();
    if (trang == null) throw new AppError("Chưa có cửa hàng nào để lưu bài. Vui lòng tạo cửa hàng trước.", 409);
    if (kenhNgoaiCuaHang(targetAccountIds, await kenhCuaCuaHang(req.user!.id, trang)).length > 0) {
      throw new AppError(LOI_KENH_NGOAI_CUA_HANG_DANG_CHON, 400);
    }

    /*
     * CHẶN TẠO TRÙNG Ở TẦNG MÁY CHỦ.
     *
     * Không dựa vào việc giao diện có khoá nút hay không. Đã xảy ra thật: nút
     * không khoá, chủ shop bấm liên tục vì tưởng kẹt, và 18 bài giống hệt nhau
     * được tạo trong hai giây — 17 bài lỗi.
     *
     * Cùng nội dung, cùng gian hàng, trong vòng một phút thì gần như chắc chắn
     * là bấm nhầm chứ không phải ý định đăng hai lần.
     */
    const vuaTao = await queryOne<{ id: number; status: string }>(
      `SELECT id, status FROM posts
        WHERE user_id = $1 AND content = $2
          AND created_at > now() - interval '1 minute'
        ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, content]
    );

    if (vuaTao) {
      throw new AppError(
        "Bài này vừa được tạo xong cách đây chưa tới một phút. " +
          "Vui lòng chờ kết quả thay vì bấm lại, để tránh đăng trùng lên Fanpage.",
        409
      );
    }

    const inserted = await queryOne(
      `INSERT INTO posts
         (user_id, trang_id, content, media, target_account_ids, status, scheduled_for,
          ai_generated, ai_prompt)
       VALUES ($1,$9,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.user!.id,
        content,
        JSON.stringify(media),
        targetAccountIds,
        status,
        scheduledFor,
        body.aiGenerated === true,
        typeof body.aiPrompt === "string" ? body.aiPrompt : null,
        trang,
      ]
    );

    res.status(201).json({ success: true, data: inserted });
  })
);

postsRouter.patch(
  "/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const fields: string[] = [];
    const params: unknown[] = [req.params.id, req.user!.id];

    const assign = (column: string, value: unknown) => {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    };

    // Đọc bài một lần ở đây. Lệnh sửa có thể chỉ gửi ảnh, chỉ gửi thời gian, hay
    // chỉ đổi trạng thái — muốn kiểm tra được cửa sổ 7 ngày của kho tạm thì phải
    // biết cả hai giá trị SAU khi sửa, kể cả giá trị không nằm trong lệnh này.
    const current = await queryOne<{
      media: unknown;
      scheduled_for: Date | null;
      trang_id: number | null;
    }>(
      "SELECT media, scheduled_for, trang_id FROM posts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!current) throw new AppError("Không tìm thấy bài viết", 404);

    // A1: đổi kênh đích thì mọi kênh phải thuộc CỬA HÀNG CỦA BÀI (kiểm TRƯỚC khi ghi).
    if (Array.isArray(body.targetAccountIds)) {
      if (current.trang_id == null) {
        throw new AppError("Bài này không thuộc cửa hàng nào (cửa hàng đã xoá) nên không đổi kênh được.", 409);
      }
      const kenhMoi = body.targetAccountIds.filter((id: unknown): id is string => typeof id === "string");
      if (kenhNgoaiCuaHang(kenhMoi, await kenhCuaCuaHang(req.user!.id, current.trang_id)).length > 0) {
        throw new AppError(LOI_KENH_NGOAI_CUA_HANG, 400);
      }
    }

    if (typeof body.content === "string") assign("content", body.content);
    if (Array.isArray(body.targetAccountIds)) assign("target_account_ids", body.targetAccountIds);
    // Chuẩn hoá ngay tại cửa vào để trong database chỉ có một dạng duy nhất.
    if (Array.isArray(body.media)) assign("media", JSON.stringify(toMediaItems(body.media)));
    if (typeof body.status === "string") {
      if (!STATUSES.has(body.status)) throw new AppError(`Trạng thái không hợp lệ: ${body.status}`);
      assign("status", body.status);
    }
    if (body.scheduledFor !== undefined) {
      const scheduled = body.scheduledFor ? new Date(body.scheduledFor) : null;
      if (scheduled && Number.isNaN(scheduled.getTime())) {
        throw new AppError("Thời gian hẹn đăng không hợp lệ");
      }
      // Cùng một điều kiện với lúc tạo mới. Thiếu chỗ này thì bài hẹn về quá
      // khứ vẫn được lưu, và tiến trình đăng theo lịch sẽ bắn nó ra ngay lập
      // tức trong khi người dùng tưởng đã đặt lịch tương lai.
      if (scheduled && scheduled.getTime() <= Date.now()) {
        throw new AppError("Thời gian hẹn đăng phải ở tương lai");
      }
      assign("scheduled_for", scheduled);
    }

    // Đưa bài sang trạng thái hẹn giờ thì buộc phải có thời gian hẹn,
    // nếu không bài sẽ nằm im mãi mà không ai biết vì sao.
    if (body.status === "scheduled" && body.scheduledFor === undefined) {
      if (!current.scheduled_for || current.scheduled_for.getTime() <= Date.now()) {
        throw new AppError("Vui lòng chọn thời gian đăng trong tương lai cho bài hẹn giờ");
      }
    }

    // Kiểm tra trên giá trị sau khi sửa, không phải trên giá trị vừa gửi lên.
    assertMediaSurvivesSchedule(
      Array.isArray(body.media) ? toMediaItems(body.media) : toMediaItems(current.media),
      body.scheduledFor !== undefined
        ? body.scheduledFor
          ? new Date(body.scheduledFor)
          : null
        : current.scheduled_for
    );

    if (fields.length === 0) throw new AppError("Không có thông tin nào để cập nhật");

    const updated = await queryOne(
      `UPDATE posts SET ${fields.join(", ")}, updated_at = now()
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      params
    );

    if (!updated) throw new AppError("Không tìm thấy bài viết", 404);
    res.json({ success: true, data: anMediaTrongBai(updated) });
  })
);

/**
 * Đăng bài lên các kênh đã chọn qua Zernio.
 *
 * Đánh dấu đang đăng trước khi gọi, để hai lần bấm liên tiếp không tạo
 * hai bài trùng nhau trên Fanpage.
 */
/**
 * Sửa nội dung bài ĐÃ ĐĂNG, ngay trên nền tảng.
 *
 * Chỉ sửa được phần chữ. Nền tảng không cho đổi ảnh của bài đã lên sóng —
 * muốn đổi ảnh thì gỡ bài rồi đăng lại.
 */
postsRouter.put(
  "/:id/platform-content",
  route(async (req, res) => {
    const content = requireString(req.body, "content", "nội dung bài viết");

    const post = await queryOne<{
      id: number;
      status: string;
      platform_post_ref: string | null;
      target_account_ids: string[];
      trang_id: number | null;
    }>(
      "SELECT id, status, platform_post_ref, target_account_ids, trang_id FROM posts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!post) throw new AppError("Không tìm thấy bài viết này", 404);
    if (post.status !== "published" || !post.platform_post_ref) {
      throw new AppError(
        "Bài này chưa lên nền tảng nên sửa trực tiếp trong ứng dụng, không cần cập nhật ra ngoài.",
        400
      );
    }

    // CHỐT CỬA RA (services/cua-ra.ts): kênh của bài phải còn thuộc cửa hàng của bài. Lệnh sửa chỉ nhận mã bài (không
    // nhận kênh), nên chốt chỉ chặn — không có biến kênh để thay bằng `duoc`.
    await chanCuaRa(req.user!.id, post.target_account_ids, post.trang_id);
    await zernio.updatePost({ postId: post.platform_post_ref, content });

    const updated = await queryOne(
      "UPDATE posts SET content = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [post.id, content]
    );
    res.json({ success: true, data: anMediaTrongBai(updated) });
  })
);

/**
 * Gỡ bài đã đăng khỏi nền tảng — TỪNG KÊNH một (POST /v1/posts/{id}/unpublish; tài liệu nhà cung cấp 1.295.0).
 *
 * Đây là cách duy nhất để thay ảnh của một bài đã đăng: gỡ đi rồi đăng lại. Gỡ rồi không lấy lại được, mất hết lượt
 * thích và bình luận. Trước 19/10/2026 nút này gọi DELETE — tài liệu: DELETE bài published trả 400 và không gỡ gì trên
 * nền tảng, nên nút âm thầm hỏng.
 *
 * Gỡ HẾT các kênh → bài về nháp (giữ nội dung, ảnh để sửa rồi đăng lại; bảng posts không có trạng thái "đã huỷ").
 * Gỡ MỘT PHẦN (vd. Instagram không cho gỡ) → bài vẫn "đã đăng", ghi rõ kênh nào đã gỡ, kênh nào chưa.
 */
postsRouter.post(
  "/:id/unpublish",
  route(async (req, res) => {
    const post = await queryOne<{
      id: number;
      status: string;
      platform_post_ref: string | null;
      target_account_ids: string[];
      trang_id: number | null;
    }>(
      "SELECT id, status, platform_post_ref, target_account_ids, trang_id FROM posts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!post) throw new AppError("Không tìm thấy bài viết này", 404);
    if (post.status !== "published" || !post.platform_post_ref) {
      throw new AppError("Bài này chưa lên nền tảng nên không có gì để gỡ.", 400);
    }

    // CHỐT CỬA RA: chỉ gỡ qua kênh còn thuộc đúng cửa hàng của bài — gỡ bằng `duoc`. Kênh đã rời → bài giữ làm lịch sử.
    const cuaRa = await chanCuaRa(req.user!.id, post.target_account_ids, post.trang_id);
    const kenh = await query<{ id: string; platform: string; ten: string }>(
      `SELECT id, platform, COALESCE(NULLIF(display_name, ''), NULLIF(username, ''), platform) AS ten
         FROM social_accounts WHERE user_id = $1 AND id = ANY($2::text[]) ORDER BY id`,
      [req.user!.id, post.target_account_ids]
    );
    const ketQua: { kenh: string; daGo: boolean; lyDo?: string }[] = [];
    for (const k of kenh.rows) {
      if (!cuaRa.duoc.includes(k.id)) {
        ketQua.push({ kenh: k.ten, daGo: false, lyDo: cuaRa.matNoi.includes(k.id) ? "kênh đang mất kết nối" : "kênh đã rời cửa hàng" });
        continue;
      }
      if (zernio.NEN_TANG_KHONG_GO_DUOC.includes(k.platform)) {
        ketQua.push({ kenh: k.ten, daGo: false, lyDo: "nền tảng này không cho gỡ bài qua ứng dụng — vui lòng gỡ trực tiếp trên kênh" });
        continue;
      }
      try {
        await zernio.unpublishPost({ postId: post.platform_post_ref, platform: k.platform, accountId: k.id });
        ketQua.push({ kenh: k.ten, daGo: true });
      } catch (error) {
        ketQua.push({ kenh: k.ten, daGo: false, lyDo: error instanceof Error ? error.message : String(error) });
      }
    }

    const daGo = ketQua.filter((k) => k.daGo).map((k) => k.kenh);
    const chuaGo = ketQua.filter((k) => !k.daGo).map((k) => `${k.kenh} (${k.lyDo})`);
    if (daGo.length === 0) throw new AppError(`Chưa gỡ được bài khỏi kênh nào: ${chuaGo.join("; ")}.`, 409);
    const luc = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const ghiChu = `Đã gỡ khỏi ${daGo.join(", ")} lúc ${luc}.` + (chuaGo.length ? ` Chưa gỡ: ${chuaGo.join("; ")}.` : "");

    const updated = chuaGo.length
      ? await queryOne("UPDATE posts SET last_error = $2, updated_at = now() WHERE id = $1 RETURNING *", [post.id, ghiChu])
      : await queryOne(BAI_VE_NHAP_SAU_GO, [post.id, ghiChu]);
    res.json({ success: true, data: anMediaTrongBai(updated), goMotPhan: chuaGo.length > 0, message: ghiChu });
  })
);

postsRouter.post(
  "/:id/publish",
  route(async (req, res) => {
    // Toàn bộ xử lý nằm ở services/publish.ts để bộ tự động dùng chung đúng
    // một đường mã — xem phần đầu tệp đó để biết vì sao.
    const updated = await publishPost(req.user!.id, req.params.id);
    res.json({ success: true, data: anMediaTrongBai(updated) });
  })
);

/**
 * Xin địa chỉ để trình duyệt tải ảnh/video lên kho của Zernio.
 *
 * Trả về uploadUrl (trình duyệt PUT tệp lên đó) và publicUrl (địa chỉ để lưu
 * vào bài). Khoá API không bao giờ ra khỏi server.
 */
postsRouter.post(
  "/media/presign",
  route(async (req, res) => {
    const body = req.body ?? {};
    const filename = requireString(body, "filename", "tên tệp");
    const contentType = requireString(body, "contentType", "loại tệp");
    const size = typeof body.size === "number" ? body.size : undefined;

    const presigned = await zernio.presignMedia({ filename, contentType, size });

    res.json({
      success: true,
      data: {
        uploadUrl: presigned.uploadUrl,
        publicUrl: anDiaChiKho(presigned.publicUrl),
        type: presigned.type,
        expiresIn: presigned.expiresIn,
      },
    });
  })
);

/**
 * Kiểm tra lại kết quả thật của một bài đang treo.
 *
 * Dùng cho bài ở trạng thái "chưa rõ kết quả": phía mình hết giờ chờ trong khi
 * Zernio có thể đã đăng xong. TUYỆT ĐỐI chỉ ĐỌC, không đăng lại bất cứ thứ gì —
 * đăng lại là cách chắc chắn nhất để Fanpage có hai bài giống hệt nhau.
 *
 * Hai đường tra:
 *   1. Đã có id bên Zernio thì hỏi thẳng bài đó.
 *   2. Chưa có id (hết giờ chờ ngay từ lúc gửi) thì dò trong các bài gần đây của
 *      Zernio, đối chiếu bằng nội dung.
 * Không thấy ở cả hai đường thì bài thật sự chưa lên — lúc đó mới cho đăng lại.
 */
postsRouter.post(
  "/:id/recheck",
  route(async (req, res) => {
    const post = await queryOne<{
      id: number;
      content: string;
      platform_post_ref: string | null;
    }>(
      "SELECT id, content, platform_post_ref FROM posts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!post) throw new AppError("Không tìm thấy bài viết", 404);

    // Dùng chung services/post-status.ts với lưới an toàn tự động, để nút bấm
    // tay và lưới chạy nền không bao giờ cho ra hai kết quả khác nhau.
    const kq = await doiChieuMotBai(post);
    const updated = await ghiKetQua(post.id, kq);

    if (kq.status === "failed") {
      res.json({
        success: true,
        data: { found: false, message: "Bài chưa lên nền tảng. Bạn có thể đăng lại." },
      });
      return;
    }

    res.json({ success: true, data: { found: true, post: anMediaTrongBai(updated) } });
  })
);

/**
 * Xoá bản ghi bài trong app. Bài đã giao nhà cung cấp mà CHƯA đăng (hẹn giờ / đang đăng) thì nhà cung cấp vẫn tự đăng
 * → HUỶ phía nhà cung cấp TRƯỚC (DELETE /v1/posts/{id}; tài liệu: hợp lệ cho scheduled, publishing), huỷ không được thì
 * KHÔNG xoá bản ghi. Bài đã đăng: chỉ xoá trong app, bài trên kênh vẫn còn (chủ dự án chốt 19/10/2026 — kể cả bài của
 * kênh đã rời cửa hàng); muốn gỡ khỏi kênh thì dùng "Gỡ bài".
 */
postsRouter.delete(
  "/:id",
  route(async (req, res) => {
    const post = await queryOne<{ id: number; status: string; platform_post_ref: string | null }>(
      "SELECT id, status, platform_post_ref FROM posts WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!post) throw new AppError("Không tìm thấy bài viết", 404);
    if ((post.status === "scheduled" || post.status === "publishing") && post.platform_post_ref) {
      try {
        await zernio.deletePost(post.platform_post_ref);
      } catch (error) {
        const status = error instanceof zernio.ZernioError ? error.status : 0;
        // 404: không còn bài phía nhà cung cấp → không còn gì để đăng, xoá bản ghi được.
        if (status === 400) {
          throw new AppError("Bài đã kịp lên kênh nên không huỷ được. Vui lòng bấm \"Kiểm tra kết quả thật\", rồi dùng \"Gỡ bài\" nếu muốn gỡ.", 409);
        }
        if (status !== 404) throw new AppError("Chưa huỷ được bài phía nền tảng nên chưa xoá. Vui lòng thử lại sau ít phút.", 502);
      }
    }
    await query("DELETE FROM posts WHERE id = $1 AND user_id = $2", [post.id, req.user!.id]);
    res.json({ success: true });
  })
);

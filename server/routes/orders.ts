import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../auth.js";
import { AppError, requireString, route, chiNhanMaSo } from "../http.js";
import { gopVaoTongChi, taoDon } from "../services/orders.js";
import { DAU_NGAY_VN, DAU_THANG_VN } from "../moc-thoi-gian.js";
import { trangHienTai } from "../services/ngu-canh-trang.js";

export const ordersRouter = Router();

// Mọi :id ở đây là mã số — chữ lạ thì 404, không để database vỡ ra 500.
ordersRouter.param("id", chiNhanMaSo);

ordersRouter.use(requireAuth);

const STATUSES = new Set(["pending", "confirmed", "shipping", "completed", "cancelled"]);

/** Sinh mã đơn dạng DH260817-0001, dễ đọc khi trao đổi với khách. */

ordersRouter.get(
  "/",
  route(async (req, res) => {
    const { status, search } = req.query;
    /*
     * Đơn của CỬA HÀNG đang chọn (A3). Bốn ô số tổng dùng ĐÚNG điều kiện cửa hàng này — số đếm phải khớp danh sách
     * (bài học 2b); lọc trạng thái / tìm kiếm chỉ áp cho danh sách, như trước.
     */
    const trang = await trangHienTai();
    const conditions = ["o.user_id = $1", "o.trang_id = $2"];
    const params: unknown[] = [req.user!.id, trang];

    if (typeof status === "string" && status !== "" && status !== "all") {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (typeof search === "string" && search.trim() !== "") {
      params.push(`%${search.trim()}%`);
      const i = params.length;
      conditions.push(
        `(o.code ILIKE $${i} OR o.customer_name ILIKE $${i} OR o.phone ILIKE $${i})`
      );
    }

    const rows = await query(
      `SELECT o.*, c.avatar_url
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY o.created_at DESC
        LIMIT 200`,
      params
    );

    /*
     * Bốn ô số ở đầu trang Đơn hàng trước đây là số bịa cứng trong giao diện:
     * "ĐƠN HÔM NAY 7", "ĐANG GIAO 12", "DOANH THU THÁNG 48.500.000đ", kèm
     * "+3 so với hôm qua" và "+18% so với tháng trước". Đã dựng lại trên máy:
     * shop có ĐÚNG 0 đơn mà trang vẫn hiện nguyên bốn con số đó, trong khi
     * ngay dòng trên nó lại ghi đúng "0 ĐƠN HÔM NAY". Chủ shop nhìn vào tưởng
     * đang có gần 50 triệu doanh thu.
     *
     * Đếm đủ cả 'confirmed' và 'cancelled' luôn: thiếu 'confirmed' thì cộng
     * bốn ô lại không ra tổng, đơn đã xác nhận biến mất khỏi mọi bảng đếm.
     *
     * Mốc ngày và mốc tháng lấy theo giờ Việt Nam, không phải giờ GMT của
     * database — xem server/moc-thoi-gian.ts.
     */
    const summary = await queryOne(
      `SELECT COUNT(*)::int                                          AS total,
              COUNT(*) FILTER (WHERE status = 'pending')::int        AS pending,
              COUNT(*) FILTER (WHERE status = 'confirmed')::int      AS confirmed,
              COUNT(*) FILTER (WHERE status = 'shipping')::int       AS shipping,
              COUNT(*) FILTER (WHERE status = 'completed')::int      AS completed,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int      AS cancelled,
              COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,

              COUNT(*) FILTER (
                WHERE created_at >= ${DAU_NGAY_VN})::int             AS today_count,
              COALESCE(SUM(total) FILTER (
                WHERE created_at >= ${DAU_NGAY_VN}
                  AND status <> 'cancelled'), 0)                     AS today_revenue,
              COUNT(*) FILTER (
                WHERE created_at >= ${DAU_NGAY_VN} - interval '1 day'
                  AND created_at <  ${DAU_NGAY_VN})::int             AS yesterday_count,

              COALESCE(SUM(total) FILTER (
                WHERE created_at >= ${DAU_THANG_VN}
                  AND status <> 'cancelled'), 0)                     AS month_revenue,
              COALESCE(SUM(total) FILTER (
                WHERE created_at >= ${DAU_THANG_VN} - interval '1 month'
                  AND created_at <  ${DAU_THANG_VN}
                  AND status <> 'cancelled'), 0)                     AS last_month_revenue
         FROM orders o WHERE o.user_id = $1 AND o.trang_id = $2`,
      [req.user!.id, trang]
    );

    res.json({ success: true, data: rows.rows, summary });
  })
);

ordersRouter.post(
  "/",
  route(async (req, res) => {
    const body = req.body ?? {};
    // Toàn bộ xử lý nằm ở services/orders.ts để AI bán hàng tự chủ dùng chung
    // đúng một đường mã — xem phần đầu tệp đó để biết vì sao.
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    /*
     * Đơn tạo tay (KHÔNG có hội thoại) thuộc CỬA HÀNG đang chọn (A3). Có hội thoại thì cửa hàng lấy theo hội thoại
     * trong taoDon (đợt 2b).
     */
    let trangId: number | null = null;
    if (!conversationId) {
      trangId = await trangHienTai();
      if (trangId == null) throw new AppError("Chưa có cửa hàng nào để gắn đơn. Vui lòng tạo cửa hàng trước.", 409);
    }
    const order = await taoDon({
      userId: req.user!.id,
      conversationId,
      trangId,
      customerName: typeof body.customerName === "string" ? body.customerName : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      address: typeof body.address === "string" ? body.address : null,
      product: requireString(body, "product", "tên sản phẩm"),
      quantity: Number(body.quantity ?? 1),
      unitPrice: Number(body.unitPrice ?? 0),
      note: typeof body.note === "string" ? body.note : null,
      closedBy: body.closedBy === "ai" ? "ai" : "human",
      status: typeof body.status === "string" ? body.status : undefined,
    });

    res.status(201).json({ success: true, data: order });
  })
);

ordersRouter.patch(
  "/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    /*
     * Chỉ sửa đơn của CỬA HÀNG đang chọn (A3). Đơn của cửa hàng khác (vd. thấy ở Tổng quan — bảng đơn ở đó tính cả tài
     * khoản) → báo rõ đơn thuộc cửa hàng nào để chủ shop đổi cửa hàng, không trả 404 trống (phiên kiểm duyệt, điều kiện 3).
     */
    const trang = await trangHienTai();
    const cuaDon = await queryOne<{ trang_id: number | null; ten: string | null }>(
      "SELECT o.trang_id, t.ten FROM orders o LEFT JOIN trang t ON t.id = o.trang_id WHERE o.id = $1 AND o.user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!cuaDon) throw new AppError("Không tìm thấy đơn hàng", 404);
    if (cuaDon.trang_id == null || cuaDon.trang_id !== trang) {
      throw new AppError(
        cuaDon.ten
          ? `Đơn này thuộc cửa hàng "${cuaDon.ten}" — vui lòng đổi sang cửa hàng đó để xem và sửa.`
          : "Đơn này thuộc một cửa hàng đã xoá nên không sửa được.",
        409
      );
    }
    const fields: string[] = [];
    const params: unknown[] = [req.params.id, req.user!.id];

    const assign = (column: string, value: unknown) => {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    };

    if (typeof body.status === "string") {
      if (!STATUSES.has(body.status)) {
        throw new AppError(`Trạng thái không hợp lệ: ${body.status}`);
      }
      assign("status", body.status);
    }
    if (typeof body.customerName === "string") assign("customer_name", body.customerName);
    if (typeof body.phone === "string") assign("phone", body.phone);
    if (typeof body.address === "string") assign("address", body.address);
    if (typeof body.product === "string") assign("product", body.product);
    if (typeof body.note === "string") assign("note", body.note);

    if (body.quantity !== undefined || body.unitPrice !== undefined) {
      const current = await queryOne<{ quantity: number; unit_price: number }>(
        "SELECT quantity, unit_price FROM orders WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user!.id]
      );
      if (!current) throw new AppError("Không tìm thấy đơn hàng", 404);

      const quantity = Number(body.quantity ?? current.quantity);
      const unitPrice = Number(body.unitPrice ?? current.unit_price);
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new AppError("Số lượng không hợp lệ");
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new AppError("Đơn giá không hợp lệ");
      }

      assign("quantity", quantity);
      assign("unit_price", unitPrice);
      assign("total", quantity * unitPrice);
    }

    if (fields.length === 0) throw new AppError("Không có thông tin nào để cập nhật");

    /*
     * Tổng chi của khách phải đi theo đơn, kể cả khi chỉ sửa số lượng hay giá.
     *
     * Đã dựng lại hai lần, cả hai đều sai tiền thật:
     *
     *  - Lên đơn 2 chiếc 360.000 → khách "đã chi 360.000". Chủ shop sửa thành
     *    5 chiếc → đơn thành 900.000 nhưng khách vẫn mang con số 360.000 cũ.
     *
     *  - Tệ hơn: khách đó còn một đơn CŨ 2.000.000 đã mua xong. Sửa 2 → 5 rồi
     *    huỷ đơn mới thì phần trừ lấy tổng HIỆN TẠI (900.000) trừ vào một số
     *    dư chỉ từng được cộng 360.000 → khách còn 1.460.000 thay vì
     *    2.000.000. Mất trắng 540.000 của một đơn đã thanh toán.
     *
     * Cách tính đúng: một đơn góp vào tổng chi đúng bằng `total` của nó khi
     * chưa huỷ, và bằng 0 khi đã huỷ. Lấy phần góp SAU trừ phần góp TRƯỚC rồi
     * cộng chênh lệch vào khách — một công thức lo hết mọi trường hợp: sửa số
     * lượng, sửa giá, huỷ, bỏ huỷ, hay vừa sửa vừa huỷ trong cùng một lần.
     */
    const truoc = await queryOne<{
      status: string;
      total: string;
      customer_id: number | null;
    }>(
      "SELECT status, total, customer_id FROM orders WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id]
    );
    if (!truoc) throw new AppError("Không tìm thấy đơn hàng", 404);

    params.push(trang);
    const updated = await queryOne(
      `UPDATE orders SET ${fields.join(", ")}, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND trang_id = $${params.length} RETURNING *`,
      params
    );

    if (!updated) throw new AppError("Không tìm thấy đơn hàng", 404);

    const sau = updated as { status?: string; total?: string | number };
    if (truoc.customer_id) {
      const g1 = gopVaoTongChi(truoc.status, Number(truoc.total));
      const g2 = gopVaoTongChi(
        sau.status ?? truoc.status,
        Number(sau.total ?? truoc.total)
      );
      const lechDon = g2.don - g1.don;
      const lechTien = g2.tien - g1.tien;

      if (lechDon !== 0 || lechTien !== 0) {
        await query(
          `UPDATE customers
              SET total_orders = GREATEST(0, total_orders + $2),
                  total_spent  = GREATEST(0, total_spent + $3),
                  updated_at   = now()
            WHERE id = $1`,
          [truoc.customer_id, lechDon, lechTien]
        );
      }
    }

    res.json({ success: true, data: updated });
  })
);

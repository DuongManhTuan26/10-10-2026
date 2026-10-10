import { query } from "../../server/db.js";
// Đưa dự án đã xong về trạng thái lỗi để bấm "Tạo tiếp" (đủ cảnh → chỉ ghép lại, không vẽ video).
const r = await query("UPDATE du_an_video SET trang_thai = 'loi', loi = 'Ghép lại để sửa giọng đọc' WHERE id = 9 AND trang_thai = 'xong' RETURNING id");
console.log("đặt lại:", r.rowCount);
process.exit(0);

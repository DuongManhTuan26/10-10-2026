/**
 * LUỒNG THÔNG BÁO TELEGRAM — hàm thuần nuôi sơ đồ "sợi nối" ở màn Báo cáo Telegram (chủ dự án 23/10/2026: học theo Tổng
 * quan; phiên kiểm duyệt: vẽ ĐÚNG sự thật, không bịa).
 *
 * Mỗi dòng = một loại tin máy chủ THẬT gửi (services/telegram.ts, worker.ts, autopilot.ts). Đường "chạy" chỉ khi tin đó
 * thật sự đi được: Telegram đang bật + có nơi nhận (cùng điều kiện loadConfig) VÀ loại tin không bị tắt trong events.
 *  - Đơn hàng mới: sendOrderReport bỏ qua khi events.new_order === false.
 *  - Khách cần người thật: sendHandoffAlert bỏ qua khi events.handoff === false.
 *  - Bài AI tự viết / tự đăng (autopilot, kind "content"): không có công tắc riêng.
 *  - AI chưa trả lời khách (worker.ts, kind "queue_stuck"): gửi chính tài khoản có tin chờ, không có công tắc riêng.
 *  - ④ AI Điều hành có đề xuất mới (lượt chấm hằng ngày — services/dieu-hanh-ngay.ts, kind "dieu_hanh"): không công tắc riêng.
 *  - Cảnh báo chi phí (chi_phi) + mất nhận tin từ nền tảng (webhook_dead): CHỈ gửi quản trị → người dùng thường không thấy.
 */
import { aiTheoMa, MAU_THUONG_HIEU } from './bon-ai';

export interface DongThongBao {
  ma: string;
  nguon: string;
  so: number | null;
  ten: string;
  mau: string;
  chay: boolean;
}

export function luongThongBao(p: { daNoi: boolean; events: Record<string, boolean>; laQuanTri: boolean }): DongThongBao[] {
  const noiDung = aiTheoMa('content'), banHang = aiTheoMa('sales'), dieuHanh = aiTheoMa('analytics');
  const ds: DongThongBao[] = [
    { ma: 'content', nguon: noiDung.ten, so: noiDung.so, ten: 'Bài AI tự viết / tự đăng', mau: noiDung.hex, chay: p.daNoi },
    { ma: 'new_order', nguon: banHang.ten, so: banHang.so, ten: 'Đơn hàng mới', mau: banHang.hex, chay: p.daNoi && p.events.new_order !== false },
    { ma: 'handoff', nguon: banHang.ten, so: banHang.so, ten: 'Khách cần người thật', mau: banHang.hex, chay: p.daNoi && p.events.handoff !== false },
    { ma: 'dieu_hanh', nguon: dieuHanh.ten, so: dieuHanh.so, ten: 'Đề xuất mới chờ duyệt', mau: dieuHanh.hex, chay: p.daNoi },
    { ma: 'queue_stuck', nguon: 'Hệ thống', so: null, ten: 'AI chưa trả lời khách', mau: MAU_THUONG_HIEU, chay: p.daNoi },
  ];
  if (p.laQuanTri) {
    ds.push(
      { ma: 'chi_phi', nguon: 'Hệ thống', so: null, ten: 'Cảnh báo chi phí', mau: MAU_THUONG_HIEU, chay: p.daNoi },
      { ma: 'webhook_dead', nguon: 'Hệ thống', so: null, ten: 'Mất nhận tin từ nền tảng', mau: MAU_THUONG_HIEU, chay: p.daNoi },
    );
  }
  return ds;
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { PRICING_PLANS, goiHienTai, type PricingPlan } from '../lib/pricing';

/**
 * Kênh hỗ trợ của mình. Dùng chung một nguồn với nút Trợ giúp ở thanh bên, để
 * đổi một chỗ là đổi cả hệ thống.
 */
import { SUPPORT_URL, IS_EXTERNAL_SUPPORT } from '../lib/ho-tro';
import TheMuc from '../components/TheMuc';
import { aiTheoMa, bienThe, MAU_THONG_TIN, MAU_THUONG_HIEU, VIEN_HE_THONG } from '../lib/bon-ai';

export default function Pricing() {
  const navigate = useNavigate();

  const [plan, setPlan] = useState('trial');
  const [usage, setUsage] = useState({
    connected_accounts: 0, ai_messages_month: 0, tokens_month: 0,
    orders_month: 0, posts_month: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    api.settings.usage()
      .then((u) => {
        setPlan(u.data.plan);
        setUsage(u.data.usage);
      })
      .catch((error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Không tải được thông tin gói');
      });
  }, []);

  /** Gói đang dùng, đối chiếu với gói lưu trong database. */
  const plans: PricingPlan[] = PRICING_PLANS.map((p) => ({
    ...p,
    isCurrent: p.id === plan,
    buttonText: p.id === plan ? 'Gói hiện tại' : p.buttonText,
  }));

  /*
   * Gói đang dùng lấy đúng theo mã gói trong database. Không được mượn tạm gói
   * đầu danh sách: shop đang dùng thử từng bị ghi là đang dùng gói Khởi đầu
   * 390.000 đ/tháng.
   */
  const currentPlan = goiHienTai(plan);
  const maxChannels = currentPlan.maxChannels;
  const usedChannels = usage.connected_accounts;
  const coHanMuc = maxChannels > 0;
  const channelPercent = coHanMuc
    ? Math.min(100, Math.round((usedChannels / maxChannels) * 100))
    : 0;

  /* Số lượt còn lại phải tính ra, trước đây là chữ cứng "Còn 1 lượt kết nối". */
  const conLaiKenh = maxChannels - usedChannels;
  const chuThichKenh = !coHanMuc
    ? 'Chưa đặt hạn mức trong thời gian dùng thử'
    : conLaiKenh > 0
      ? `Còn ${conLaiKenh} lượt kết nối`
      : conLaiKenh === 0
        ? 'Đã dùng hết số kênh của gói'
        : `Đang vượt ${-conLaiKenh} kênh so với gói`;

  /**
   * Nâng cấp gói và xem hoá đơn đều cần cổng thanh toán, chưa nối vào hệ thống.
   * Báo rõ thay vì để nút bấm không phản ứng gì.
   */
  const handleUpgrade = (planId?: string) => {
    setErrorMessage(
      planId && planId !== plan
        ? `Đổi sang gói "${plans.find((p) => p.id === planId)?.name}" cần cổng thanh toán, phần này chưa được nối. Vui lòng liên hệ để được đổi gói thủ công.`
        : 'Cổng thanh toán chưa được nối vào hệ thống.'
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full relative">
      {errorMessage && (
        <div className="mb-md text-sm text-error bg-error/10 border border-error/30 rounded-xl px-4 py-3 max-w-5xl mx-auto">
          {errorMessage}
        </div>
      )}

      {/* Header */}
      <div className="mb-lg">
        <span className="font-mono text-xs font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full uppercase mb-3 inline-block">{currentPlan.name.toUpperCase()}</span>
        <p className="text-base text-on-surface-variant max-w-2xl mt-1">Gói đang dùng, mức dùng trong tháng và các gói có thể đổi. An toàn tài khoản nằm ở ③ AI Bán hàng › Kết quả.</p>
      </div>

      <div className="max-w-5xl mx-auto pb-xl">
        {/* HÀNG 1 — thẻ ngang rộng hết chiều ngang; kiểu thẻ Tổng quan, màu thương hiệu (chủ dự án 23/10/2026). */}
        <TheMuc mau={MAU_THUONG_HIEU} bieuTuong="workspace_premium" tieuDe="Gói đang dùng" className="mb-md">
          <div className="grid grid-cols-1 md:grid-cols-10 gap-md items-start">
          {/* Left */}
          <div className="flex flex-col md:col-span-4">
            <h3 className="text-3xl font-bold text-on-surface">{currentPlan.name}</h3>
            <p className="text-base text-primary font-bold">{currentPlan.price.replace('/tháng', ' mỗi tháng')}</p>
            <p className="font-body-md text-on-surface-variant mt-2">{plan === 'trial' ? 'Đang dùng thử' : 'Gia hạn tự động hằng tháng'}</p>
          </div>
          {/* Middle */}
          <div className="flex flex-col min-w-[220px] md:col-span-3">
            <span className="font-label-sm text-on-surface-variant tracking-widest uppercase mb-2 whitespace-nowrap">SỐ KÊNH ĐÃ KẾT NỐI</span>
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-3xl font-bold text-primary">{usedChannels}</span>
              {coHanMuc && (
                <>
                  <span className="text-3xl font-bold text-on-surface-variant">/</span>
                  <span className="text-3xl font-bold text-on-surface-variant">{maxChannels}</span>
                </>
              )}
            </div>
            {coHanMuc && (
              <div className="w-full h-2 bg-surface-container rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${channelPercent}%` }}></div>
              </div>
            )}
            <p className="font-body-md text-on-surface-variant mt-2">{chuThichKenh}</p>
          </div>
          {/* Right */}
          <div className="flex flex-col gap-sm md:col-span-3 w-full">
            <button className="w-full py-3 nut-chinh text-on-primary font-label-sm rounded-lg hover:brightness-110 transition-all font-bold" onClick={() => handleUpgrade()}>Nâng cấp gói</button>
          </div>
        </div>
        </TheMuc>

        {/* HÀNG 2 — dải giải thích cách tính tiền, nền sáng hơn nền chung, có biểu tượng thông tin */}
        <div className="the p-4 flex items-start gap-3 mb-lg" style={bienThe(MAU_THONG_TIN)}>
          <span className="o-bieu-tuong shrink-0"><span className="material-symbols-outlined text-[20px]">info</span></span>
          <div>
            <p className="font-body-md text-on-surface font-bold">Bạn chỉ trả tiền theo số kênh kết nối</p>
            <p className="font-body-md text-on-surface-variant">Tin nhắn, bình luận và bài đăng không giới hạn. Một bài viral thu về nghìn bình luận cũng không tốn thêm đồng nào.</p>
          </div>
        </div>

        {/*
          HÀNG 2B — mức dùng thật trong tháng.

          Máy chủ vẫn luôn tính mấy con số này nhưng trước đây không hiển thị ở
          đâu cả. Đặt ngay dưới câu "không giới hạn" để chủ shop thấy bằng số
          thật là dùng bao nhiêu cũng không phát sinh thêm tiền.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md mb-lg">
          {[
            // Màu = AI làm ra số đó (giống Tổng quan): tin AI + đơn ③ Bán hàng, bài ① Nội dung.
            { nhan: 'TIN AI ĐÃ TRẢ LỜI', so: usage.ai_messages_month, mau: aiTheoMa('sales').hex, icon: 'smart_toy' },
            // Đếm MỌI đơn và MỌI bài lập trong tháng (server/routes/settings.ts /usage) — nhãn phải đúng với số: đơn gồm cả
            // đơn nhân viên lập và đơn chưa xác nhận; bài gồm cả nháp, chờ duyệt (bản cũ ghi "chốt được", "đã đăng").
            { nhan: 'ĐƠN HÀNG', so: usage.orders_month, mau: aiTheoMa('sales').hex, icon: 'receipt_long' },
            { nhan: 'BÀI ĐÃ TẠO', so: usage.posts_month, mau: aiTheoMa('content').hex, icon: 'post_add' },
          ].map((o) => (
            <div key={o.nhan} className="the p-md" style={bienThe(o.mau)}>
              <div className="flex items-center gap-3">
                <span className="o-bieu-tuong shrink-0"><span className="material-symbols-outlined text-[20px]">{o.icon}</span></span>
                <span className="font-label-sm text-on-surface-variant tracking-widest uppercase">{o.nhan}</span>
              </div>
              <p className="so-lon text-3xl font-bold text-on-surface mt-3">{o.so.toLocaleString('vi-VN')}</p>
              <p className="font-body-md text-on-surface-variant">trong tháng này, không tính thêm tiền</p>
            </div>
          ))}
        </div>

        {/* HÀNG 3 — ba thẻ gói nằm ngang, thẻ giữa có viền sáng nổi bật và nhãn góc "ĐANG DÙNG" */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-md">
          {plans.map((plan, idx) => (
            <div 
              key={plan.id} 
              // Kiểu thẻ Tổng quan: gói đang dùng màu thương hiệu + quầng mạnh hơn; gói khác lam, nổi lên khi rê chuột.
              className={`the the-bam p-md flex flex-col overflow-hidden ${plan.isCurrent ? 'z-10' : ''}`}
              style={plan.isCurrent
                ? { ['--nhan' as string]: MAU_THUONG_HIEU, ['--vien-the' as string]: VIEN_HE_THONG, borderColor: VIEN_HE_THONG, boxShadow: `0 0 32px ${VIEN_HE_THONG}40` }
                : bienThe(MAU_THONG_TIN)}
            >
              {plan.isCurrent && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary font-label-sm text-[10px] px-3 py-1 rounded-bl-lg font-bold">ĐANG DÙNG</div>
              )}
              <h4 className="text-xl font-bold text-on-surface">{plan.name}</h4>
              <p className="text-base text-primary font-bold mt-1">{plan.price}</p>
              <div className="flex flex-col gap-3 mt-md mb-lg flex-1">
                {plan.features.map((feature, fidx) => (
                  <div key={fidx} className={`flex items-start gap-2 ${!feature.included ? 'opacity-40' : ''}`}>
                    <span className={`material-symbols-outlined ${feature.included ? 'text-primary' : 'text-on-surface-variant'} text-[20px]`}>
                      {feature.included ? 'check' : 'close'}
                    </span>
                    <span className={`font-body-md ${feature.included ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
              <button 
                className={`w-full py-3 font-label-sm rounded-lg font-bold mt-auto transition-all ${
                  plan.isCurrent 
                    ? 'bg-primary/10 text-primary cursor-not-allowed border border-primary/40'
                    : plan.id === 'enterprise'
                      ? 'nut-chinh text-on-primary hover:brightness-110'
                      : 'bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20'
                }`}
                disabled={plan.isCurrent}
                onClick={() => handleUpgrade(plan.id)}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center font-body-md text-on-surface-variant mb-xl">Cần nhiều hơn 10 kênh? {SUPPORT_URL ? <a href={SUPPORT_URL} {...(IS_EXTERNAL_SUPPORT ? { target: '_blank', rel: 'noreferrer' } : {})} className="text-primary hover:underline">Liên hệ để có báo giá riêng.</a> : <span>Kênh liên hệ báo giá riêng sắp có.</span>}</p>

        {/*
          "An toàn tài khoản" và "Quy định bắt buộc của Facebook" đã chuyển sang ③ AI Bán hàng › Kết quả
          (components/AnToanTaiKhoan.tsx): đó là số liệu và giới hạn gửi tin của từng khối não, không thuộc gói dịch vụ
          (rà soát lượt 2, T11).
        */}
      </div>
    </div>
  );
}

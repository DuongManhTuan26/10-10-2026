/**
 * BẢNG MÃ của AI điều hành — NGUỒN DUY NHẤT (chủ dự án duyệt 09/10/2026; docs/nghien-cuu-bo-de-ai-dieu-hanh.md mục 14).
 *
 * Dùng chung cho: AI điều hành (dieu-hanh.ts), tầng kiểm cứng (kiem-cung.ts — bảng rủi ro phải phủ MỌI mã hành động),
 * và bộ đề chọn mô hình (scripts/bo-de-dieu-hanh/khuon.mts nhập lại từ đây, nội dung giữ nguyên để kết quả cũ chạy lại
 * được). Một bảng mã cho mọi tình huống — gồm cả nguyên nhân đúng lẫn nhiều nguyên nhân hay bị nhầm.
 */

export const MA_NGUYEN_NHAN = {
  tai_lieu_sai_gia: "Giá / thông tin sản phẩm trong tài liệu của trang bị sai",
  tai_lieu_thieu: "Tài liệu thiếu thông tin khách hay hỏi",
  thay_doi_chinh_sach_ban: "Chính sách bán hàng vừa thay đổi (giao hàng, thanh toán, đổi trả…)",
  ai_hua_sai_chinh_sach: "AI bán hàng nói sai / tự bịa chính sách, cam kết",
  bia_thong_tin_san_pham: "Nội dung / quảng cáo nêu công dụng, cam kết không có trong tài liệu",
  kenh_mat_ket_noi: "Kênh mất kết nối / cần nối lại — tin nhắn không về",
  ai_bi_tat: "AI bán hàng đang bị tắt / tạm dừng",
  tra_loi_cham: "Trả lời khách chậm",
  gio_dang_sai: "Lịch / giờ đăng bài bất thường",
  noi_dung_cau_tuong_tac: "Nội dung dùng câu kéo tương tác (xin thả tim, bình luận, gắn thẻ…) bị nền tảng hạ phân phối",
  muc_tieu_noi_dung_lech: "Loại nội dung không khớp mục tiêu (vd. chạy theo lan truyền khi mục tiêu là đơn hàng)",
  noi_dung_kem: "Câu chữ / hình ảnh nội dung kém",
  quang_cao_mon: "Mẫu quảng cáo bị mòn (tần suất cao, tỉ lệ nhấp giảm dần)",
  doi_tuong_sai: "Nhắm sai đối tượng quảng cáo",
  toi_uu_sai_chi_so: "Tối ưu theo chỉ số trung gian (nhấp, tương tác…) làm hỏng chỉ số kinh doanh",
  so_nen_tang_tu_bao: "Số liệu nền tảng tự báo / tự quy công, không phải hiệu quả thật",
  du_lieu_dem_trung: "Dữ liệu bị đếm trùng",
  du_lieu_thieu: "Dữ liệu theo dõi bị thiếu",
  nghen_o_ban_hang: "Nghẽn ở khâu bán hàng (không phải ở quảng cáo / nội dung)",
  ep_chot_som: "AI bán hàng ép chốt / xin thông tin khi khách chưa đủ điều kiện",
  tu_choi_be_mat: "Lý do từ chối khách nói ra chỉ là bề mặt, lý do thật khác",
  khong_thich_ung: "AI bán hàng dùng một kiểu cho mọi loại khách, không thích ứng",
  gia_cao: "Giá bán cao hơn khả năng / kỳ vọng của khách",
  mua_vu: "Biến động theo mùa vụ / thời điểm",
  khuyen_mai_lam_giam_gia_tri_don: "Khuyến mãi làm giảm giá trị đơn",
  mau_nho_chua_ket_luan: "Mẫu quá nhỏ — chưa kết luận được",
} as const;

export const MA_HANH_DONG = {
  sua_tai_lieu: "Sửa tài liệu của trang (giá, sản phẩm, chính sách)",
  them_hoi_dap: "Thêm câu hỏi – đáp vào tài liệu cho AI bán hàng",
  sua_loi_dan_ban_hang: "Sửa lời dặn / các bước của AI bán hàng",
  bat_lai_ai: "Bật lại AI bán hàng",
  noi_lai_kenh: "Nối lại kênh",
  doi_gio_dang: "Đổi lịch / giờ đăng",
  viet_lai_noi_dung: "Viết lại nội dung",
  bo_cau_tuong_tac: "Bỏ câu kéo tương tác khỏi nội dung",
  dieu_chinh_ke_hoach_noi_dung: "Điều chỉnh kế hoạch / tỉ lệ các loại nội dung",
  them_bang_chung_tin_cay: "Bổ sung bằng chứng tin cậy (chính hãng, kiểm nghiệm, đánh giá thật) vào nội dung / quảng cáo / bán hàng",
  doi_mau_quang_cao: "Đổi mẫu quảng cáo",
  doi_thong_diep_quang_cao: "Đổi thông điệp quảng cáo",
  doi_doi_tuong: "Đổi đối tượng quảng cáo",
  tang_ngan_sach: "Tăng ngân sách quảng cáo",
  giam_ngan_sach: "Giảm ngân sách quảng cáo",
  dung_quang_cao: "Dừng quảng cáo",
  giam_gia: "Giảm giá / khuyến mãi",
  chay_thu_nghiem: "Chạy thử nghiệm có đối chứng (đổi một thứ, có chỉ số chính + bảo vệ)",
  thu_them_du_lieu: "Thu thêm dữ liệu / chờ đủ mẫu rồi mới quyết",
  hoan_tac_thay_doi: "Hoàn tác thay đổi trước đó",
  sua_du_lieu_theo_doi: "Sửa cách ghi / theo dõi dữ liệu",
  giu_nguyen: "Giữ nguyên, chưa thay đổi",
  dang_bai_thong_bao: "Đăng bài / nội dung thông báo công khai",
  hoi_chu_shop: "Hỏi / báo chủ shop để chủ shop quyết",
} as const;

export const MA_DU_LIEU = {
  don_theo_nguon: "Đơn hàng ghi rõ nguồn (quảng cáo nào / bài nào / tự nhắn)",
  gia_von: "Giá vốn / biên lợi nhuận",
  them_mau: "Thêm thời gian / thêm mẫu cho đủ lớn",
  hoi_thoai_mau: "Đọc thêm hội thoại mẫu",
  ly_do_tu_choi: "Lý do khách từ chối / bỏ đi",
  so_lieu_theo_ngay: "Số liệu theo từng ngày",
  xac_nhan_chu_shop: "Chủ shop xác nhận thông tin (giá, chính sách, ý định)",
  xac_nhan_chuyen_mon: "Xác nhận chuyên môn / pháp lý (y tế, công dụng…)",
  du_lieu_nen: "Dữ liệu nền / kỳ trước để so",
  du_lieu_doi_chung: "Nhóm đối chứng (thử nghiệm có đối chứng)",
} as const;

export const MA_CHI_SO = {
  hoi_thoai_moi: "Hội thoại mới mỗi ngày",
  ti_le_chot: "Tỉ lệ chốt đơn",
  ti_le_nhuong: "Tỉ lệ AI phải nhường người",
  tra_loi_1_phut: "Tin khách được trả lời trong 1 phút",
  ti_le_huy: "Tỉ lệ đơn huỷ",
  ti_le_tuong_tac: "Tỉ lệ tương tác của bài",
  binh_luan_moi_bai: "Bình luận mỗi bài",
  ti_le_nhap: "Tỉ lệ nhấp quảng cáo",
  tro_chuyen_moi_100k: "Cuộc trò chuyện trên mỗi 100.000 ₫ quảng cáo",
  chi_phi_moi_don: "Tiền bỏ ra mỗi đơn",
} as const;

export const NHAN_VIEN = ["noi_dung", "quang_cao", "ban_hang", "chu_shop", "he_thong"] as const;
export const QUYET_DINH = ["tiep_tuc", "dung", "tu_choi", "chuyen_chu_shop"] as const;

/**
 * LUẬT HỆ THỐNG đưa vào sổ bằng chứng (nguồn "luật hệ thống", hạng A) để AI dẫn khi nói "vi phạm". Câu chữ GIỐNG HỆT
 * phần luật trong lời dặn bộ đề bản 1.2 (khuon.mts) — có phép kiểm chống lệch. Chỉ gồm tiêu chí chủ dự án + chính sách
 * nền tảng đã xác minh (Meta: cửa sổ 24 giờ; nội dung kéo tương tác bị hạ phân phối).
 */
export const LUAT_HE_THONG: { ma: string; noiDung: string }[] = [
  { ma: "LUAT-gia", noiDung: "Giá, sản phẩm, chính sách CHỈ lấy từ tài liệu của trang do chủ shop cung cấp; không ai được tự đặt giá / chính sách / cam kết." },
  { ma: "LUAT-meta", noiDung: "Meta: chỉ được nhắn tin tự do trong 24 giờ kể từ tin CUỐI của khách; ngoài 24 giờ không được nhắn quảng bá. Nội dung xin thả cảm xúc / bình luận / chia sẻ / gắn thẻ / bình chọn bị Facebook hạ phân phối." },
  { ma: "LUAT-mot-thu", noiDung: "Mỗi lần thử / tối ưu chỉ đổi MỘT thứ để còn đo được. Sửa LỖI rõ ràng — thông tin sai hoặc thiếu so với tài liệu, lời hứa sai, quảng cáo sai sự thật, kênh hỏng — là việc bắt buộc, làm ngay, không tính là thử nghiệm. Không đụng vào chỉ số / cách làm đang mạnh." },
  { ma: "LUAT-che-do", noiDung: "Chế độ tự động: được tự làm việc trong danh sách hành động; việc dính tiền chỉ trong TRẦN chủ shop đặt — vượt trần phải chuyển chủ shop. Chế độ đề xuất: mọi thay đổi chờ chủ shop duyệt." },
  { ma: "LUAT-quyen", noiDung: "Việc thuộc quyền chủ shop (giá, chính sách, cam kết với khách, bật/tắt AI chủ shop đã tắt, đăng nhập nối kênh) → chuyển chủ shop." },
];

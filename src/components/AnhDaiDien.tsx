/**
 * Ảnh đại diện kênh / Fanpage: ảnh thật của nền tảng nếu có, không thì vẽ CHỮ CÁI ĐẦU tại chỗ. Bản cũ lấy ảnh từ
 * ui-avatars.com — gửi tên Fanpage của khách ra một dịch vụ bên ngoài chỉ để vẽ một chữ (23/10/2026).
 */
export default function AnhDaiDien({ src, ten, lop }: { src: string | null | undefined; ten: string; lop: string }) {
  if (src) return <img src={src} alt={ten} className={`${lop} rounded-full object-cover`} />;
  const chu = (ten.trim()[0] ?? '?').toLocaleUpperCase('vi-VN');
  return (
    <span aria-label={ten} className={`${lop} rounded-full bg-primary/15 text-primary font-bold inline-flex items-center justify-center`}>
      {chu}
    </span>
  );
}

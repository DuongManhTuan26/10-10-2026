#!/bin/bash
# Bật app trên máy (nếu đang tắt) rồi mở trình duyệt vào thẳng trang.
#
# Dùng cho nút "Mở app" trên Desktop. App bật bằng đường này chạy độc lập,
# không phụ thuộc cửa sổ nào khác: đóng Terminal hay đóng ứng dụng khác vẫn chạy.
#
# Thử trên cổng khác: PORT=3005 KHONG_MO=1 bash scripts/mo-app.sh

DU_AN="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
CONG="${PORT:-3000}"
DIA_CHI="http://localhost:${CONG}"
NHAT_KY="$HOME/Library/Logs/quan-ly-fanpage.log"

dang_chay() { curl -sf -m 2 -o /dev/null "${DIA_CHI}/api/health"; }

if ! dang_chay; then
  cd "$DU_AN" || exit 1
  PORT="$CONG" nohup npm run dev >> "$NHAT_KY" 2>&1 &
  # Lần đầu bật có thể mất tới vài chục giây (kiểm tra database, nạp mã).
  for _ in $(seq 1 120); do
    dang_chay && break
    sleep 1
  done
fi

if dang_chay; then
  [ -z "$KHONG_MO" ] && open "${DIA_CHI}/"
  echo "san-sang ${DIA_CHI}"
else
  osascript -e "display alert \"Chưa bật được app\" message \"Xem nhật ký tại ${NHAT_KY}\"" >/dev/null 2>&1
  echo "khong-bat-duoc"
  exit 1
fi

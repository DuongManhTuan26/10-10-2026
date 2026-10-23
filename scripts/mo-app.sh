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

# LaunchAgent đã cài (docs/launchagent/vn.quanly.fanpage.plist) thì launchd giữ máy chủ — KHÔNG bật bản thứ hai, chỉ nhờ
# launchd bật lại ngay (kickstart) nếu đang tắt.
NHAN_LAUNCHD="vn.quanly.fanpage"
if ! dang_chay && launchctl list "$NHAN_LAUNCHD" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/$NHAN_LAUNCHD" >/dev/null 2>&1
  for _ in $(seq 1 120); do
    dang_chay && break
    sleep 1
  done
fi

if ! dang_chay; then
  cd "$DU_AN" || exit 1
  # TÁCH PHIÊN (setsid) — 23/10/2026: bật từ một phiên khác (cửa sổ Terminal, phiên Claude…) thì máy chủ nằm trong NHÓM
  # TIẾN TRÌNH của phiên đó; phiên bị đóng / ngắt là cả nhóm nhận SIGTERM và máy chủ tắt theo (đã tắt 10:55–13:53, khách
  # nhắn không ai trả lời). nohup không chặn được tín hiệu gửi cho cả nhóm. macOS không có lệnh setsid → dùng python3.
  # Người canh đường hầm do máy chủ bật bằng spawn detached (đã tự tách phiên) — services/duong-ham.ts.
  PORT="$CONG" nohup python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' npm run dev >> "$NHAT_KY" 2>&1 &
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

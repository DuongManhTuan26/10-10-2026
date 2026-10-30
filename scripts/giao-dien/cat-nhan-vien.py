"""
Cắt lớp ĐẦU + VAI 4 nhân viên từ ảnh khối não (public/giao-dien/khoi-nao.webp, 1975×660) thành ảnh nền trong suốt
(public/giao-dien/nv-<khau>.webp) để chuyển động riêng (chủ dự án 30/10/2026: "cách 1", không video, ưu tiên tốc độ).
Đa giác đo trên ảnh (px ảnh). Mép làm mịn: vẽ mặt nạ ở 4× rồi thu nhỏ + làm mờ 0,8px. Chạy lại được:
  python3 scripts/giao-dien/cat-nhan-vien.py
"""
import json, pathlib
from PIL import Image, ImageDraw, ImageFilter

GOC = pathlib.Path(__file__).resolve().parents[2]
ANH = Image.open(GOC / "public/giao-dien/khoi-nao.webp").convert("RGBA")
DA_GIAC = {
    "noi_dung": [(318,444),(328,446),(334,451),(337,462),(338,478),(339,490),(345,492),(352,500),(355,510),(356,518),
                 (283,518),(286,508),(290,498),(298,492),(300,480),(301,462),(305,452),(310,446)],
    "quang_cao": [(980,446),(990,448),(996,455),(999,468),(1000,485),(1005,490),(1018,495),(1026,505),(1029,519),
                  (940,519),(944,505),(952,494),(961,489),(962,470),(966,456),(972,448)],
    "ban_hang": [(1670,458),(1680,460),(1687,466),(1690,480),(1691,500),(1696,505),(1704,510),(1709,522),(1711,536),
                 (1630,536),(1633,522),(1640,510),(1648,505),(1651,500),(1652,480),(1655,466),(1661,460)],
    "dieu_hanh": [(978,168),(983,170),(987,172),(990,175),(991,184),(990,192),(986,197),(985,201),(989,207),(997,211),
                  (1003,214),(1014,218),(1016,224),(1019,232),(1019,240),(933,240),(934,234),(936,228),(939,220),
                  (941,216),(951,214),(961,211),(966,208),(969,203),(967,197),(964,192),(964,180),(965,175),(968,172),(973,170)],
}
K = 4
ket = {}
for khau, dg in DA_GIAC.items():
    xs = [p[0] for p in dg]; ys = [p[1] for p in dg]
    x0, y0, x1, y1 = min(xs) - 2, min(ys) - 2, max(xs) + 2, max(ys) + 1
    w, h = x1 - x0, y1 - y0
    mat = Image.new("L", (w * K, h * K), 0)
    ImageDraw.Draw(mat).polygon([((x - x0) * K, (y - y0) * K) for x, y in dg], fill=255)
    # Co vào 1px (bỏ viền nền sáng dính mép) rồi làm mịn.
    mat = mat.resize((w, h), Image.LANCZOS).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    lop = ANH.crop((x0, y0, x1, y1)); lop.putalpha(mat)
    lop.save(GOC / f"public/giao-dien/nv-{khau}.webp", lossless=True)
    ket[khau] = {"x": x0, "y": y0, "w": w, "h": h}
print(json.dumps(ket))

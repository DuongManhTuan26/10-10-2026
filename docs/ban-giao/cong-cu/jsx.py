"""Tìm thẻ </div> khớp với <div mở tại vị trí i (bỏ qua > nằm trong {…} hoặc chuỗi)."""
def het_the(s, i):
    j = i + 4; sau = 0; q = None
    while True:
        ch = s[j]
        if q:
            if ch == q and s[j-1] != '\\': q = None
        elif ch in '"\'`': q = ch
        elif ch == '{': sau += 1
        elif ch == '}': sau -= 1
        elif ch == '>' and sau == 0: return j, s[j-1] == '/'
        j += 1

def dong_div(s, i):
    sau = 0; j = i
    while True:
        a = s.find('<div', j); b = s.find('</div>', j)
        if a != -1 and a < b and s[a+4] in ' \n>':
            k, tu_dong = het_the(s, a)
            if not tu_dong: sau += 1
            j = k + 1
        else:
            sau -= 1; j = b + 6
            if sau == 0: return b

def boc(s, mo, mau, tieu_de, trong):
    """Thay thẻ mở `mo` bằng khung-muc + tiêu đề + hộp trong (giữ bố cục cũ), đóng thêm một </div>."""
    assert s.count(mo) == 1, mo[:80]
    i = s.index(mo); b = dong_div(s, i)
    thut = " " * (len(s[:i]) - len(s[:i].rstrip(" ")))
    moi = (f'<div className="khung-muc {mau}">\n{thut}  <h3 className="tieu-de-muc dau-muc">{tieu_de}</h3>\n'
           f'{thut}  <div className="{trong}">')
    return s[:i] + moi + s[i+len(mo):b] + "</div>\n" + thut + s[b:]

def doi_dau(s, dau_cu, lop_khung, dau_moi, mo_bat_dau='<div className="bg-surface-container'):
    """Khung có sẵn dòng đầu `dau_cu`: thẻ mở gần nhất phía trước đổi thành `lop_khung`, dòng đầu thành `dau_moi`."""
    assert s.count(dau_cu) == 1, dau_cu[:80]
    k = s.index(dau_cu); i = s.rindex(mo_bat_dau, 0, k); j, _ = het_the(s, i)
    s = s[:i] + f'<div className="{lop_khung}">' + s[j+1:]
    k = s.index(dau_cu); return s[:k] + dau_moi + s[k+len(dau_cu):]

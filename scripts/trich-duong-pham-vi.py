"""
Trích từ OpenAPI của nhà cung cấp kênh mọi đường GET "danh sách" (không có {id}) nhận profileId / accountId trong query
→ docs/zernio-duong-co-pham-vi.json. Những đường này gọi THIẾU phạm vi là trả dữ liệu của CẢ TEAM (mọi khách dùng chung
một khoá). scripts/kiem-tra.mts đọc tệp JSON: đường nào trong tập này mà mã gọi thì PHẢI có trong DUONG_DANH_SACH
(server/services/pham-vi-goi.ts).

  python3 scripts/trich-duong-pham-vi.py <đường tới openapi.yaml>
"""
import json, sys, yaml

d = yaml.safe_load(open(sys.argv[1], encoding="utf8"))
duong = []
for p, ops in d["paths"].items():
    if "{" in p or "get" not in ops:
        continue
    ten = []
    for prm in ops["get"].get("parameters", []):
        if "$ref" in prm:
            prm = d["components"]["parameters"][prm["$ref"].split("/")[-1]]
        if prm.get("in") == "query":
            ten.append(prm["name"])
    if "profileId" in ten or "accountId" in ten:
        duong.append(p.removeprefix("/v1"))
ra = {"nguon": f"OpenAPI {d['info']['version']}", "duong": sorted(duong)}
with open("docs/zernio-duong-co-pham-vi.json", "w", encoding="utf8") as f:
    json.dump(ra, f, ensure_ascii=False, indent=1)
    f.write("\n")
print(ra["nguon"], len(duong), "đường")

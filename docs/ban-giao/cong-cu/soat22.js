// CÁCH CHẠY (24/10): javascript_tool giới hạn 45 giây, 22 màn × 2,5 giây quá giờ → bước 1 chạy phần dưới KHÔNG await
// (bọc trong (async () => { … window.__kq = kq; })()), bước 2 đọc window.__kq.
// Soát 22 màn trong trình duyệt (dán vào javascript_tool). Ghi fetch ≥ 400, console.error, window.error,
// unhandledrejection, scrollWidth từng màn. Điều hướng SPA (pushState + popstate) để giữ bộ ghi.
const MAN = ['/', '/ket-noi', '/telegram', '/pricing', '/admin'];
for (const ai of ['/noi-dung', '/quang-cao', '/ban-hang', '/dieu-hanh'])
  for (const the of ['huong-dan', 'dang-lam', 'ket-qua', 'nhat-ky']) MAN.push(`${ai}?the=${the}`);
MAN.push('/duong-la-khong-co');
const loi = [];
if (!window.__soat) {
  window.__soat = true;
  const f0 = window.fetch;
  window.fetch = async (...a) => { const r = await f0(...a); if (r.status >= 400) loi.push(['fetch', String(a[0]), r.status]); return r; };
  const e0 = console.error;
  console.error = (...a) => { loi.push(['console', a.map(String).join(' ').slice(0, 200)]); e0(...a); };
  addEventListener('error', (e) => loi.push(['error', e.message]));
  addEventListener('unhandledrejection', (e) => loi.push(['reject', String(e.reason).slice(0, 200)]));
}
window.__loi = loi;
const kq = [];
for (const p of MAN) {
  const truoc = loi.length;
  history.pushState({}, '', p);
  dispatchEvent(new PopStateEvent('popstate'));
  await new Promise((r) => setTimeout(r, 2500));
  kq.push({ p, den: location.pathname + location.search, rong: document.documentElement.scrollWidth, loi: loi.slice(truoc) });
}
history.pushState({}, '', '/');
dispatchEvent(new PopStateEvent('popstate'));
({ cuaSo: innerWidth, so: kq.length, tranNgang: kq.filter((x) => x.rong > innerWidth).map((x) => x.p), coLoi: kq.filter((x) => x.loi.length), duongLa: kq.at(-1).den,
  ls: { zn_cua_hang: localStorage.getItem('zn_cua_hang'), zn_active_account: localStorage.getItem('zn_active_account'), quanLyPhan: localStorage.getItem('quanLyPhan') } })

/** DB GIẢ: trả dữ liệu cố định do kịch bản chụp đặt vào globalThis.__duLieuGia; mọi câu khác trả rỗng. */
const du = () => globalThis.__duLieuGia ?? {};
export const pool = { query: async () => ({ rows: [] }), end: async () => {} };
export async function query(sql) {
  if (/FROM ai_documents/.test(sql)) return { rows: du().taiLieu ?? [] };
  return { rows: [] };
}
export async function queryOne(sql) {
  if (/FROM ai_configs/.test(sql)) return du().cauHinh ?? null;
  return null;
}
export async function transaction(fn) { return fn({ query: async () => ({ rows: [] }) }); }
export async function verifyConnection() {}
export async function closePool() {}

/**
 * PHẠM VI LỜI GỌI NHÀ CUNG CẤP (22/10/2026; phiên kiểm duyệt nêu sau P0-1).
 *
 * Mọi khách dùng CHUNG một khoá nhà cung cấp. Các đường "danh sách" dưới đây, gọi thiếu profileId / accountId, trả dữ
 * liệu của CẢ TEAM (tài liệu GET /v1/posts: "Omit it, or send `all` or an empty value, to list posts across every
 * profile"). Đã gặp: đồng bộ kênh kéo kênh của khách khác (a0c14ed), đối chiếu bài khớp nội dung trong 20 bài mới nhất
 * của cả team (có thể gán link bài của khách khác).
 *
 * Luật: GET tới các đường này PHẢI có phạm vi; chỗ cố ý hỏi cả team phải khai lý do (caTeam) và nằm trong danh sách
 * ngoại lệ có phép kiểm (scripts/kiem-tra.mts).
 *
 * Danh sách KHOÁ BẰNG TÀI LIỆU: mọi đường mã gọi mà OpenAPI ghi nhận profileId / accountId (docs/zernio-duong-co-pham-vi.json,
 * trích bằng scripts/trich-duong-pham-vi.py) phải có ở đây — thêm đường mới mà quên là phép kiểm hỏng. Thêm vào đó các
 * đường không có tham số phạm vi nhưng trả dữ liệu cả team (/profiles, /users, /webhooks/logs).
 */
export const DUONG_DANH_SACH = new Set([
  "/accounts",
  "/posts",
  "/analytics",
  "/inbox/conversations",
  "/inbox/comments",
  "/ads",
  "/ads/accounts",
  "/ads/accounts/finance",
  "/ads/campaigns",
  "/ads/tree",
  "/ads/insights",
  "/ads/audiences",
  "/ads/targeting/search",
  "/connect/facebook/select-page",
  "/connect/facebook/ads",
  "/connect/telegram",
  "/profiles",
  "/usage",
  "/users",
  "/webhooks/logs",
]);

const coGiaTri = (v: unknown) => typeof v === "string" ? v.trim() !== "" && v.trim() !== "all" : v !== undefined && v !== null;

/** Ném lỗi TRƯỚC khi gọi nhà cung cấp nếu lời gọi danh sách thiếu phạm vi mà không khai lý do hỏi cả team. */
export function kiemPhamVi(
  method: string,
  path: string,
  query: Record<string, unknown> | undefined,
  caTeam: string | undefined
): void {
  if (method !== "GET" || !DUONG_DANH_SACH.has(path)) return;
  if (coGiaTri(query?.profileId) || coGiaTri(query?.accountId)) return;
  if (typeof caTeam === "string" && caTeam.trim() !== "") return;
  throw new Error(`Lời gọi ${path} thiếu phạm vi (profileId / accountId) — sẽ trả dữ liệu của cả team`);
}

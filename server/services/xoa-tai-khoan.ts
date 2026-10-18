/**
 * Xoá một tài khoản TRỌN VẸN bên nhà cung cấp: không còn kênh nào đang nối (đang bị tính tiền theo ngày), không còn hồ
 * sơ nào của tài khoản đó — và KHÔNG đụng hồ sơ của người khác (B1-d, duyệt 18/10/2026 cùng phiên kiểm duyệt).
 *
 * Căn cứ tài liệu nhà cung cấp (docs/zernio-api-reference.txt):
 *  - 16372: "Active connected accounts block profile deletion" → phải ngắt kênh trước.
 *  - 16373: xoá hồ sơ thì kênh ĐÃ NGẮT còn trong hồ sơ bị "moved to another of your profiles, never deleted" — có thể
 *    rơi sang hồ sơ của KHÁCH KHÁC → xoá MỌI kênh trong hồ sơ (đang nối hay đã ngắt) rồi mới xoá hồ sơ.
 *  - 22270: GET /v1/accounts "Only includes accounts within the plan limit by default" → liệt kê kèm includeOverLimit.
 *  - 21616: DELETE /v1/accounts/{id} trả 200 / 404. Tài liệu KHÔNG nói rõ lệnh này chạy với kênh ở trạng thái cần nối
 *    lại → không đoán: xoá xong LIỆT KÊ LẠI, còn sót kênh nào thì DỪNG (không xoá hồ sơ, không xoá tài khoản).
 *  - Số WhatsApp do nhà cung cấp cấp (16373) cũng bị chuyển — app KHÔNG cấp số nào (grep "phone-numbers" / "provision"
 *    trong server/ không có kết quả; WhatsApp chỉ nối như một kênh thường nên đã nằm trong bước ngắt kênh).
 *
 * Thứ tự: khoá tài khoản → chốt sổ tiền kênh trong ngày → với từng hồ sơ: ngắt mọi kênh → liệt kê lại (còn sót thì dừng)
 * → xoá hồ sơ → cuối cùng mới xoá dòng tài khoản. Lỗi ở bất kỳ bước nào: DỪNG, tài khoản còn nguyên (đã khoá), báo việc
 * đã làm / còn lại; bấm xoá lại là làm tiếp (kế hoạch luôn đọc lại từ đầu, không tin bản xem trước).
 *
 * Hàm chạy nhận "deps" từ ngoài để bộ kiểm tra thử ĐÚNG thứ tự lệnh bằng hàm giả, không gọi nhà cung cấp thật.
 */

export interface KenhNcc { id: string; platform: string; ten: string; dangNoi: boolean }
export interface HoSoXoa {
  id: string;
  nguon: string[];
  kenh: KenhNcc[];
  /**
   * Nhà cung cấp trả 404 ("not found or access denied") khi liệt kê → hồ sơ đã không còn (vd. xoá ở lượt trước rồi dừng
   * giữa chừng). Coi là đã dọn: đằng nào app cũng không chạm được vào nó. Không có trường này thì bấm xoá lại kẹt mãi.
   */
  daMat?: boolean;
}
export interface KeHoachXoa { hoSo: HoSoXoa[]; boQua: { id: string; lyDo: string }[] }

export interface PhuThuocXoa {
  /** Mọi tham chiếu hồ sơ của tài khoản trong DB: users.profile_ref, trang.profile_ref, social_accounts.profile_ref. */
  docHoSoCuaToi(userId: number): Promise<{ nguon: string; id: string }[]>;
  /** Hồ sơ nào trong danh sách đang được TÀI KHOẢN KHÁC tham chiếu → id hồ sơ → email tài khoản kia. */
  docHoSoDungChung(userId: number, ids: string[]): Promise<Map<string, string>>;
  /** Kênh thật trong hồ sơ, theo nhà cung cấp, KÈM includeOverLimit, không lọc trạng thái. */
  lietKeKenh(profileId: string): Promise<KenhNcc[]>;
  khoaTaiKhoan(userId: number): Promise<void>;
  chotSoKenhNgay(): Promise<void>;
  ngatKenh(accountId: string): Promise<void>;
  xoaHoSo(profileId: string): Promise<void>;
  xoaTaiKhoan(userId: number): Promise<void>;
  /** Lỗi này có phải "không tìm thấy" (404) của nhà cung cấp không — CHỈ 404 mới coi là kênh đã mất. */
  la404(error: unknown): boolean;
}

/** Gộp trùng, bỏ mã tạm "cho-cap-", loại hồ sơ dùng chung với tài khoản khác (báo lý do). Hàm thuần. */
export function chonHoSo(
  thamChieu: { nguon: string; id: string }[],
  dungChung: Map<string, string>
): { xoa: { id: string; nguon: string[] }[]; boQua: { id: string; lyDo: string }[] } {
  const gom = new Map<string, string[]>();
  for (const t of thamChieu) {
    if (!t.id || t.id.startsWith("cho-cap-")) continue;
    gom.set(t.id, [...(gom.get(t.id) ?? []), t.nguon]);
  }
  const xoa: { id: string; nguon: string[] }[] = [];
  const boQua: { id: string; lyDo: string }[] = [];
  for (const [id, nguon] of gom) {
    const ai = dungChung.get(id);
    if (ai) boQua.push({ id, lyDo: `đang dùng chung với tài khoản ${ai} — không xoá` });
    else xoa.push({ id, nguon: [...new Set(nguon)] });
  }
  return { xoa, boQua };
}

/** Bản xem trước — CHỈ ĐỌC (DB + liệt kê kênh của nhà cung cấp). */
export async function lapKeHoachXoa(userId: number, d: PhuThuocXoa): Promise<KeHoachXoa> {
  const thamChieu = await d.docHoSoCuaToi(userId);
  const ids = [...new Set(thamChieu.map((t) => t.id).filter((id) => id && !id.startsWith("cho-cap-")))];
  const { xoa, boQua } = chonHoSo(thamChieu, await d.docHoSoDungChung(userId, ids));
  const hoSo: HoSoXoa[] = [];
  for (const h of xoa) {
    try {
      hoSo.push({ ...h, kenh: await d.lietKeKenh(h.id) });
    } catch (e) {
      // Chỉ 404 mới là "đã mất"; lỗi khác thì dừng như cũ.
      if (!d.la404(e)) throw e;
      hoSo.push({ ...h, kenh: [], daMat: true });
    }
  }
  return { hoSo, boQua };
}

export type KetQuaXoa =
  | { xong: true; keHoach: KeHoachXoa }
  | { xong: false; daLam: string[]; conLai: string[]; loi: string };

/** Xoá thật. Lỗi giữa chừng thì dừng, KHÔNG xoá dòng tài khoản. */
export async function thucHienXoa(userId: number, d: PhuThuocXoa): Promise<KetQuaXoa> {
  const daLam: string[] = [];
  await d.khoaTaiKhoan(userId);
  daLam.push("đã khoá tài khoản");
  await d.chotSoKenhNgay();
  daLam.push("đã chốt sổ tiền kênh trong ngày");

  let keHoach: KeHoachXoa;
  try {
    keHoach = await lapKeHoachXoa(userId, d);
  } catch (e) {
    return { xong: false, daLam, conLai: ["đọc danh sách kênh của nhà cung cấp"], loi: thongDiep(e) };
  }

  for (const h of keHoach.hoSo) {
    if (h.daMat) {
      daLam.push(`hồ sơ ${h.id} đã không còn bên nhà cung cấp (xoá ở lượt trước)`);
      continue;
    }
    const kq = await donHoSo(h.id, h.kenh, d, daLam);
    if ("loi" in kq) return { xong: false, daLam, conLai: kq.conLai, loi: kq.loi };
  }

  await d.xoaTaiKhoan(userId);
  return { xong: true, keHoach };
}

/**
 * Dọn MỘT hồ sơ: ngắt mọi kênh (đang nối hay đã ngắt) → liệt kê lại (còn sót thì dừng) → xoá hồ sơ. Dùng chung cho xoá
 * tài khoản và xoá một cửa hàng — một luật, một chỗ.
 */
export async function donHoSo(
  id: string,
  kenh: KenhNcc[],
  d: Pick<PhuThuocXoa, "ngatKenh" | "lietKeKenh" | "xoaHoSo" | "la404">,
  daLam: string[]
): Promise<{ ok: true } | { ok: false; conLai: string[]; loi: string }> {
  for (const k of kenh) {
    try {
      await d.ngatKenh(k.id);
      daLam.push(`đã ngắt kênh ${k.platform} "${k.ten}"`);
    } catch (e) {
      if (!d.la404(e)) return { ok: false, conLai: [`ngắt kênh ${k.platform} "${k.ten}" và các bước sau`], loi: thongDiep(e) };
      daLam.push(`kênh ${k.platform} "${k.ten}" đã không còn bên nhà cung cấp`);
    }
  }
  // Liệt kê lại: còn sót kênh nào thì KHÔNG xoá hồ sơ (kênh sót sẽ bị chuyển sang hồ sơ khác).
  let sot: KenhNcc[];
  try {
    sot = await d.lietKeKenh(id);
  } catch (e) {
    // 404 khi liệt kê lại = hồ sơ đã không còn → coi như đã dọn xong (đường xoá cửa hàng cũng gặp đúng trường hợp này).
    if (d.la404(e)) {
      daLam.push(`hồ sơ ${id} đã không còn bên nhà cung cấp`);
      return { ok: true };
    }
    return { ok: false, conLai: [`kiểm lại hồ sơ ${id} và các bước sau`], loi: thongDiep(e) };
  }
  if (sot.length > 0) {
    return {
      ok: false,
      conLai: [`hồ sơ ${id} còn ${sot.length} kênh: ${sot.map((k) => `${k.platform} "${k.ten}"`).join(", ")}`],
      loi: "Nhà cung cấp vẫn còn kênh trong hồ sơ — có thể do chậm đồng bộ. Vui lòng bấm xoá lại sau ít phút.",
    };
  }
  try {
    await d.xoaHoSo(id);
    daLam.push(`đã xoá hồ sơ ${id}`);
  } catch (e) {
    if (!d.la404(e)) return { ok: false, conLai: [`xoá hồ sơ ${id} và các bước sau`], loi: thongDiep(e) };
    daLam.push(`hồ sơ ${id} đã không còn bên nhà cung cấp`);
  }
  return { ok: true };
}

function thongDiep(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

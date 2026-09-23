import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pool } from "./db.js";
import { env } from "./env.js";

/**
 * Trình chạy migration.
 *
 * Thay cho CREATE TABLE IF NOT EXISTS: cách cũ im lặng bỏ qua khi bảng đã tồn
 * tại nhưng sai cấu trúc, đúng thứ đã khiến mã nguồn lệch khỏi database thật.
 * Ở đây mỗi tệp .sql chạy đúng một lần và được ghi nhận lại.
 */

/**
 * Tìm thư mục chứa tệp .sql.
 *
 * Khi chạy dev bằng tsx thì tệp nằm cạnh mã nguồn. Khi chạy bản đã đóng gói,
 * esbuild gộp mã thành một tệp duy nhất trong dist/ còn .sql được sao chép
 * sang dist/migrations/. Thử lần lượt các vị trí có thể.
 */
function resolveMigrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "migrations"),
    path.join(process.cwd(), "dist", "migrations"),
    path.join(process.cwd(), "server", "migrations"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  throw new Error(
    `Không tìm thấy thư mục migrations. Đã thử:\n  ${candidates.join("\n  ")}`
  );
}

const migrationsDir = resolveMigrationsDir();


function listMigrationFiles(): string[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/*
 * Khoá tư vấn cho việc chạy migration.
 *
 * Số bất kỳ nhưng phải cố định: mọi tiến trình dùng chung một số thì mới xếp
 * hàng được với nhau.
 */
const KHOA_MIGRATION = 776_155_001;

/**
 * Giao dịch migration nằm không quá lâu thì Postgres tự huỷ.
 *
 * Chỉ giao dịch MỒ CÔI mới nằm không — tiến trình chết, không ai gửi lệnh
 * nữa. Migration đang chạy thì liên tục có lệnh nên không bao giờ chạm ngưỡng
 * này, dù lượt migration có lâu bao nhiêu.
 */
const CHET_NEU_NAM_KHONG_MS = 15_000;

/**
 * Chỉ một tiến trình được chạy migration tại một thời điểm.
 *
 * VÌ SAO KHÔNG DÙNG KHOÁ CẤP PHIÊN
 *
 * Database của dự án nằm sau pgbouncer (DATABASE_URL trỏ vào endpoint có đuôi
 * "-pooler"). Bộ gom kết nối trộn nhiều "phiên" logic lên chung một kết nối
 * thật, nên khoá tư vấn CẤP PHIÊN không còn thuộc về ai rõ ràng: đo được nó
 * hiện ra dưới application_name 'pgbouncer' và bám vào đúng kết nối đang gọi
 * lệnh khác.
 *
 * Bản đầu tôi dùng khoá cấp phiên trên kết nối mượn từ pool. Hậu quả đo được
 * ngay: một kết nối idle giữ khoá 9 phút 35 giây, migration sau chờ vô hạn.
 * Đổi sang kết nối riêng cũng không cứu được, vì gốc rễ là pgbouncer chứ
 * không phải chỗ lấy kết nối.
 *
 * KHOÁ CẤP GIAO DỊCH an toàn hơn hẳn sau pgbouncer: bộ gom bảo đảm một giao
 * dịch luôn nằm trọn trên một kết nối thật, và khoá nhả khi giao dịch kết thúc.
 *
 * NHƯNG KHÔNG PHẢI "không có đường nào rò" — chỗ này tôi từng viết như vậy và
 * đã ĐO ĐƯỢC ĐIỀU NGƯỢC LẠI. Tiến trình bị giết cứng (tsx watch khởi động lại
 * và phải "Force killing" sau 5 giây) để lại một kết nối mồ côi bên pgbouncer
 * vẫn giữ khoá:
 *
 *   pid=1093  application_name=pgbouncer  state=idle  granted=true
 *
 * Mọi lần khởi động sau đó chờ đủ 60 lần rồi CHẾT HẲN, không lên được. Phải
 * vào tận database ngắt kết nối đó mới chạy lại được. Trên nền tảng hay khởi
 * động lại container thì đây là lỗi làm app không bật được.
 *
 * Đổi lại, cả lượt migration phải nằm trong MỘT giao dịch. Điều đó còn chặt
 * hơn bản cũ: một migration hỏng thì cả lượt quay về nguyên trạng, không để
 * lại lược đồ dở dang.
 */
export async function runMigrations(): Promise<void> {
  /*
   * THỬ khoá rồi nhả kết nối, không bao giờ CHỜ trong lúc đang giữ kết nối.
   *
   * pg_advisory_xact_lock() chặn cho tới khi lấy được, mà trong lúc chặn nó
   * vẫn giữ một kết nối của pool và một kết nối thật của pgbouncer. Nhiều
   * tiến trình cùng khởi động là chúng khoá lẫn nhau: đã đo thật với 5 tiến
   * trình, một cái chết vì "Query read timeout" sau 30 giây.
   *
   * pg_try_advisory_xact_lock() trả về ngay. Không lấy được thì nhả kết nối,
   * nghỉ một nhịp rồi thử lại — không giữ gì trong lúc chờ nên không ai chặn
   * ai. Khoá vẫn ở cấp giao dịch nên tự nhả khi giao dịch kết thúc, kể cả khi
   * tiến trình chết giữa chừng.
   */
  const SO_LAN_THU = 60;
  const NGHI_MS = 1_000;

  for (let lan = 1; lan <= SO_LAN_THU; lan++) {
    const client = await pool.connect();
    let phaiThuLai = false;
    try {
      await client.query("BEGIN");

      /*
       * Tự huỷ giao dịch nếu nó nằm không quá lâu — ĐÂY LÀ CHỖ CHỮA GỐC.
       *
       * Tiến trình bị giết cứng để lại một kết nối mồ côi bên pgbouncer, giao
       * dịch còn mở và khoá còn giữ. Đã đo thật: pid=1093,
       * application_name=pgbouncer, granted=true — mọi lần khởi động sau đó
       * chờ đủ 60 lần rồi chết, phải vào tận database ngắt kết nối mới chạy lại.
       *
       * idle_in_transaction_session_timeout chỉ đếm lúc giao dịch NẰM KHÔNG.
       * Migration đang chạy lệnh thì không bị đụng tới dù lâu bao nhiêu; chỉ
       * giao dịch mồ côi — không ai gửi lệnh nữa — mới bị Postgres huỷ, và
       * khoá nhả theo. Sau đó tiến trình mới lấy được khoá trong nhịp thử kế.
       *
       * SET LOCAL nên chỉ áp cho giao dịch này, không dính sang những phiên
       * khác dùng chung kết nối thật của bộ gom.
       */
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = '${CHET_NEU_NAM_KHONG_MS}ms'`);

      const { rows } = await client.query<{ duoc: boolean }>(
        "SELECT pg_try_advisory_xact_lock($1) AS duoc",
        [KHOA_MIGRATION]
      );

      if (!rows[0]?.duoc) {
        await client.query("ROLLBACK");
        phaiThuLai = true;
      } else {
        await chayMigrationDaKhoa(client);
        await client.query("COMMIT");
        return;
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {
        /* Giao dịch đã chết thì Postgres tự dọn. */
      });
      throw error;
    } finally {
      client.release();
    }

    // Nhả kết nối XONG mới nghỉ, để tiến trình đang giữ khoá có chỗ mà chạy.
    if (phaiThuLai && lan < SO_LAN_THU) {
      await new Promise((r) => setTimeout(r, NGHI_MS));
    }
  }

  /*
   * Hết lượt thử: HỎI XEM CÓ GÌ PHẢI CHẠY KHÔNG rồi mới quyết định chết.
   *
   * Không lấy được khoá KHÔNG có nghĩa là lược đồ chưa cập nhật. Hai trường
   * hợp rất khác nhau bị gộp làm một ở bản trước:
   *   - tiến trình khác đang chạy migration thật  → chờ là đúng
   *   - khoá bị một kết nối mồ côi giữ (đo được)  → chờ bao lâu cũng vô ích,
   *     mà lược đồ thì đã ở bản mới nhất từ lâu
   *
   * Bản trước chết cả trong trường hợp thứ hai, nên app không bật được cho tới
   * khi có người vào database ngắt kết nối mồ côi. Nay chỉ chết khi THẬT SỰ
   * còn migration chưa chạy — không có đường nào bỏ sót một migration cần
   * chạy, vì chính danh sách còn thiếu là thứ quyết định.
   */
  const conThieu = await migrationConThieu();
  if (conThieu.length === 0) {
    console.warn(
      "[migrate] Không lấy được khoá migration, nhưng lược đồ đã ở bản mới nhất " +
        "— nhiều khả năng khoá đang bị một kết nối mồ côi giữ. Bỏ qua và chạy tiếp."
    );
    return;
  }

  throw new Error(
    `Không lấy được khoá migration sau ${SO_LAN_THU} lần thử, mà còn ` +
      `${conThieu.length} migration chưa chạy (${conThieu.join(", ")}).`
  );
}

/**
 * Những migration chưa chạy. Đọc thôi, KHÔNG cần khoá.
 *
 * Dùng để phân biệt "chưa lấy được khoá nhưng chẳng có gì phải chạy" với
 * "chưa lấy được khoá mà vẫn còn việc" — hai chuyện khác hẳn nhau.
 */
async function migrationConThieu(): Promise<string[]> {
  try {
    const { rows } = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const daChay = new Set(rows.map((r) => r.name));
    return listMigrationFiles().filter((f) => !daChay.has(f));
  } catch {
    // Chưa có bảng schema_migrations nghĩa là chưa chạy migration nào cả.
    return listMigrationFiles();
  }
}

async function chayMigrationDaKhoa(client: pg.PoolClient): Promise<void> {
  /*
   * Mọi lệnh đi qua ĐÚNG client đang giữ khoá.
   *
   * Dùng pool.query() ở đây là lấy một kết nối khác, nằm ngoài giao dịch đang
   * giữ khoá — tức là chạy không khoá, đúng thứ vừa bỏ công sửa.
   */
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const applied = new Set(
    (await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map(
      (row) => row.name
    )
  );

  const pending = listMigrationFiles().filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("[migrate] Lược đồ đã ở bản mới nhất.");
    return;
  }

  /*
   * Cả lượt nằm trong một giao dịch do runMigrations mở, nên không BEGIN lại
   * ở đây. Một migration hỏng là cả lượt quay về nguyên trạng — chặt hơn bản
   * cũ, không để lại lược đồ dở dang.
   */
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      console.log(`[migrate] Đã áp dụng ${file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${file} thất bại: ${message}`);
    }
  }
}

/**
 * Xoá toàn bộ bảng cũ do phiên làm việc trước tạo ra bằng
 * CREATE TABLE IF NOT EXISTS. Chỉ dùng một lần khi dựng lại lược đồ.
 */
export async function dropLegacyTables(): Promise<string[]> {
  const legacy = ["auto_scripts", "messages", "orders", "posts", "customers", "pages"];
  const dropped: string[] = [];

  for (const table of legacy) {
    const exists = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (exists.rowCount) {
      await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      dropped.push(table);
    }
  }

  return dropped;
}

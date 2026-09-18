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

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

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
 * KHOÁ CẤP GIAO DỊCH thì an toàn sau pgbouncer: bộ gom bảo đảm một giao dịch
 * luôn nằm trọn trên một kết nối thật, và khoá tự nhả khi giao dịch kết thúc —
 * kể cả khi tiến trình chết giữa chừng. Không có đường nào rò.
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

  throw new Error(
    `Không lấy được khoá migration sau ${SO_LAN_THU} lần thử — ` +
      "có tiến trình khác đang chạy migration quá lâu."
  );
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

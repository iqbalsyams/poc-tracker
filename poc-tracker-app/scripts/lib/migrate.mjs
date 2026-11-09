import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "..", "db", "migrations");

/**
 * Jalankan file SQL di db/migrations yang belum pernah diterapkan, berurutan, masing-masing dalam
 * satu transaksi. Harus memakai koneksi owner (bukan poc_app) karena membuat tabel, trigger, dan role.
 */
export async function migrate({ ownerUrl, appPassword }) {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    if (appPassword) await ensureAppRole(client, appPassword);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query("select name from schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log(`[db] migrasi ${file} diterapkan`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`migrasi ${file} gagal: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function ensureAppRole(client, password) {
  // CREATE/ALTER ROLE tidak menerima parameter $1, jadi password di-escape manual
  const literal = `'${password.replaceAll("'", "''")}'`;
  const { rowCount } = await client.query("select 1 from pg_roles where rolname = 'poc_app'");
  if (rowCount === 0) {
    await client.query(`create role poc_app login password ${literal}`);
  } else {
    await client.query(`alter role poc_app password ${literal}`);
  }
}

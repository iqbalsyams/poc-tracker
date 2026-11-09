// `npm run dev`: jalankan PostgreSQL lokal (embedded), terapkan migrasi, isi akun awal, lalu next dev.
// Data tersimpan di .pgdata/ sehingga tetap ada setelah restart.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { migrate } from "./lib/migrate.mjs";
import { seedInitialUsers } from "./lib/seed.mjs";

const root = path.join(import.meta.dirname, "..");
const envFile = path.join(root, ".env.local");
const PG_PORT = 5433;
const DB_NAME = "poc_tracker";

async function loadEnv() {
  if (!existsSync(envFile)) {
    const superPassword = randomBytes(16).toString("hex");
    const appPassword = randomBytes(16).toString("hex");
    await writeFile(
      envFile,
      [
        "# Dibuat otomatis oleh scripts/dev.mjs untuk database lokal. Jangan di-commit.",
        `DEV_PG_SUPERUSER_PASSWORD=${superPassword}`,
        `APP_DB_PASSWORD=${appPassword}`,
        `MIGRATION_DATABASE_URL=postgres://postgres:${superPassword}@localhost:${PG_PORT}/${DB_NAME}`,
        `DATABASE_URL=postgres://poc_app:${appPassword}@localhost:${PG_PORT}/${DB_NAME}`,
        "",
      ].join("\n"),
    );
    console.log("[db] .env.local dibuat");
  }
  const env = {};
  for (const line of (await readFile(envFile, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = await loadEnv();
const dataDir = path.join(root, ".pgdata");
const isNewCluster = !existsSync(path.join(dataDir, "PG_VERSION"));

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: env.DEV_PG_SUPERUSER_PASSWORD,
  port: PG_PORT,
  persistent: true,
  autoRehydrateSymlinks: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (isNewCluster) await postgres.initialise();
await postgres.start();
console.log(`[db] PostgreSQL berjalan di port ${PG_PORT}`);

let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await postgres.stop().catch(() => {});
  process.exit(code);
}

try {
  const admin = postgres.getPgClient();
  await admin.connect();
  const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [DB_NAME]);
  await admin.end();
  if (rowCount === 0) await postgres.createDatabase(DB_NAME);

  await migrate({ ownerUrl: env.MIGRATION_DATABASE_URL, appPassword: env.APP_DB_PASSWORD });

  const created = await seedInitialUsers(env.DATABASE_URL);
  if (created.length > 0) {
    console.log("\n[db] Akun awal dibuat. Password sementara (hanya ditampilkan sekali, wajib diganti saat login):");
    console.table(created.map(({ email, role, password }) => ({ email, role, password })));
  }
} catch (err) {
  console.error(`[db] ${err.message}`);
  await shutdown(1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...env },
});
next.on("exit", (code) => shutdown(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    next.kill(signal);
    shutdown(0);
  });
}

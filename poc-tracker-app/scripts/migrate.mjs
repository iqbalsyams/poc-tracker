// Untuk server (DevOps): `npm run db:migrate` dengan env MIGRATION_DATABASE_URL dan APP_DB_PASSWORD,
// lalu `npm run db:seed` dengan env DATABASE_URL untuk membuat akun awal jika tabel users kosong.

import { migrate } from "./lib/migrate.mjs";
import { seedInitialUsers } from "./lib/seed.mjs";

const command = process.argv[2];

if (command === "migrate") {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error("MIGRATION_DATABASE_URL belum diisi");
  await migrate({
    ownerUrl: process.env.MIGRATION_DATABASE_URL,
    appPassword: process.env.APP_DB_PASSWORD,
  });
} else if (command === "seed") {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi");
  const created = await seedInitialUsers(process.env.DATABASE_URL);
  if (created.length === 0) {
    console.log("Tabel users sudah berisi, seed dilewati.");
  } else {
    console.table(created.map(({ email, role, password }) => ({ email, role, password })));
  }
} else {
  console.error("Pemakaian: node scripts/migrate.mjs <migrate|seed>");
  process.exit(1);
}

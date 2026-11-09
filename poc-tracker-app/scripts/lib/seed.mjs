import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

// Akun awal sesuai FSD bagian 3
const INITIAL_USERS = [
  { name: "Iqbal Syams", email: "iqbal.syams@mceasy.co.id", role: "admin" },
  { name: "Rizka Nugroho", email: "rizka.nugroho@mceasy.co.id", role: "admin" },
  { name: "Rizki Hikmawan", email: "rizki.hikmawan@mceasy.co.id", role: "cpm" },
  { name: "Mohammad Rizal", email: "mohammad.rizal@mceasy.co.id", role: "cpm" },
  { name: "Raditya Gilang", email: "raditya.gilang@mceasy.co.id", role: "cpm" },
];

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/l/I) karena password ini dibacakan atau diketik ulang
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function temporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/**
 * Buat akun awal hanya jika tabel users masih kosong. Mengembalikan daftar email + password
 * sementara supaya bisa ditampilkan sekali di terminal; password tidak disimpan di mana pun.
 */
export async function seedInitialUsers(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query("select count(*)::int as n from users");
    if (rows[0].n > 0) return [];

    const created = [];
    await client.query("begin");
    await client.query("select set_config('app.reason', 'Akun awal (seed)', true)");
    for (const user of INITIAL_USERS) {
      const password = temporaryPassword();
      await client.query(
        "insert into users (email, name, role, password_hash) values ($1, $2, $3, $4)",
        [user.email, user.name, user.role, await bcrypt.hash(password, 12)],
      );
      created.push({ ...user, password });
    }
    await client.query("commit");
    return created;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

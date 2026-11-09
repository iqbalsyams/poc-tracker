"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { clientIp, requireAdmin } from "@/lib/auth";
import { query, withAudit } from "@/lib/db";

export type UserFormState = { error?: string; success?: string } | undefined;

const MIN_PASSWORD = 8;

export async function createUser(_: UserFormState, fd: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = fd.get("role") === "admin" ? "admin" : "cpm";
  const password = String(fd.get("password") ?? "");

  if (!name) return { error: "Isi nama." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Format email tidak valid." };
  if (password.length < MIN_PASSWORD) return { error: `Password sementara minimal ${MIN_PASSWORD} karakter.` };

  const [exists] = await query("select 1 from users where email = $1", [email]);
  if (exists) return { error: `Email ${email} sudah terdaftar.` };

  const hash = await bcrypt.hash(password, 12);
  await withAudit({ userId: admin.id, ip: await clientIp() }, async (tx) => {
    await tx.query(
      "insert into users (email, name, role, password_hash, must_change_password) values ($1, $2, $3, $4, true)",
      [email, name, role, hash],
    );
  });
  revalidatePath("/pengguna");
  return { success: `Akun ${email} dibuat. Berikan password sementaranya langsung ke ${name}; password wajib diganti saat login pertama.` };
}

export async function resetPassword(userId: number, _: UserFormState, fd: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Password sementara minimal ${MIN_PASSWORD} karakter.` };

  const hash = await bcrypt.hash(password, 12);
  await withAudit({ userId: admin.id, ip: await clientIp(), reason: "Reset password oleh Admin" }, async (tx) => {
    // must_change_password berubah, jadi reset ini tercatat di audit trail tanpa menyimpan hash-nya
    await tx.query(
      "update users set password_hash = $2, must_change_password = true, failed_logins = 0, locked_until = null where id = $1",
      [userId, hash],
    );
    await tx.query("delete from sessions where user_id = $1", [userId]);
  });
  revalidatePath("/pengguna");
  return { success: "Password direset. Sesi login user ini di semua perangkat sudah diakhiri." };
}

export async function updateUserAccess(userId: number, _: UserFormState, fd: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const role = fd.get("role") === "admin" ? "admin" : "cpm";
  const active = fd.get("is_active") === "on";

  if (userId === admin.id && (!active || role !== "admin")) {
    return { error: "Anda tidak bisa menonaktifkan atau menurunkan peran akun Anda sendiri. Minta Admin lain melakukannya." };
  }

  await withAudit({ userId: admin.id, ip: await clientIp() }, async (tx) => {
    await tx.query("update users set role = $2, is_active = $3 where id = $1", [userId, role, active]);
    if (!active) await tx.query("delete from sessions where user_id = $1", [userId]);
  });
  revalidatePath("/pengguna");
  return { success: "Akses diperbarui." };
}

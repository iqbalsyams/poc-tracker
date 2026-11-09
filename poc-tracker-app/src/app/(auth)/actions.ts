"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import {
  clientIp,
  createSession,
  destroySession,
  getCurrentUser,
  logEvent,
  requireUser,
} from "@/lib/auth";
import { query, withAudit } from "@/lib/db";

export type FormState = { error?: string } | undefined;

const MAX_FAILED = 5;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();

  if (!email || !password) return { error: "Isi email dan password." };

  const [user] = await query<{
    id: number;
    password_hash: string;
    is_active: boolean;
    locked: boolean;
  }>(
    "select id, password_hash, is_active, coalesce(locked_until > now(), false) as locked from users where email = $1",
    [email],
  );

  if (user?.locked) {
    await logEvent(user.id, "auth.login_blocked", ip, { email });
    return { error: "Akun dikunci 15 menit karena 5 kali salah password. Coba lagi nanti, atau minta Admin mereset password." };
  }

  const valid = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
  if (!valid) {
    if (user) {
      // Hitungan direset saat akun dikunci, supaya setelah 15 menit user punya 5 percobaan lagi
      await query(
        `update users
            set failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end,
                locked_until = case when failed_logins + 1 >= $2 then now() + interval '15 minutes' else locked_until end
          where id = $1`,
        [user.id, MAX_FAILED],
      );
    }
    await logEvent(user?.id ?? null, "auth.login_failed", ip, { email });
    return { error: "Email atau password salah." };
  }

  await query("update users set failed_logins = 0, locked_until = null where id = $1", [user.id]);
  await logEvent(user.id, "auth.login", ip);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logEvent(user.id, "auth.logout", await clientIp());
  await destroySession();
  redirect("/login");
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { error: "Password baru minimal 8 karakter." };
  if (next !== confirm) return { error: "Konfirmasi password tidak sama dengan password baru." };
  if (next === current) return { error: "Password baru harus berbeda dari password sekarang." };

  const [row] = await query<{ password_hash: string }>("select password_hash from users where id = $1", [user.id]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) {
    return { error: "Password sekarang salah." };
  }

  const ip = await clientIp();
  const hash = await bcrypt.hash(next, 12);
  await withAudit({ userId: user.id, ip }, async (tx) => {
    await tx.query("update users set password_hash = $2, must_change_password = false where id = $1", [user.id, hash]);
  });
  await logEvent(user.id, "auth.password_changed", ip);
  redirect("/");
}

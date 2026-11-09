import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query } from "@/lib/db";

const SESSION_COOKIE = "poc_session";

export type Role = "admin" | "cpm";
export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  must_change_password: boolean;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "";
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await query(
    "insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '8 hours')",
    [hashToken(token), userId],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // COOKIE_SECURE=false hanya untuk server internal yang belum memakai HTTPS
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where id = $1", [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Sesi berlaku 8 jam sejak aktivitas terakhir (FR-01); setiap request memperpanjangnya. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await query<CurrentUser>(
    `update sessions s
        set last_seen_at = now(), expires_at = now() + interval '8 hours'
       from users u
      where s.id = $1 and s.user_id = u.id and s.expires_at > now() and u.is_active
  returning u.id, u.email, u.name, u.role, u.must_change_password`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
});

export async function requireUser(opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.must_change_password && !opts.allowPasswordChange) redirect("/ganti-password");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** CPM pemilik POC atau Admin (FSD bagian 3). */
export function canEditPoc(user: CurrentUser, poc: { cpm_id: number }) {
  return user.role === "admin" || poc.cpm_id === user.id;
}

/** Event non-baris (login, logout, ganti password) dicatat langsung, tidak lewat trigger. */
export async function logEvent(
  userId: number | null,
  action: string,
  ip: string,
  detail: Record<string, unknown> | null = null,
) {
  await query(
    "insert into audit_log (user_id, action, entity_type, entity_id, after, ip_address) values ($1, $2, 'auth', $3, $4, $5)",
    [userId, action, userId === null ? null : String(userId), detail, ip],
  );
}

import type { Metadata } from "next";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/queries";
import { CreateUserForm, UserRowForms } from "./user-forms";

export const metadata: Metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();
  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun tidak bisa dihapus supaya nama pelaku tetap muncul di audit trail. Akun yang tidak dipakai lagi cukup dinonaktifkan."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {u.name}
                    {u.id === admin.id && " (Anda)"}
                  </p>
                  <p className="break-all text-sm text-muted">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={u.role === "admin" ? "info" : "neutral"}>{u.role === "admin" ? "Admin" : "CPM"}</Badge>
                  {!u.is_active && <Badge tone="bad">Nonaktif</Badge>}
                  {u.is_active && u.must_change_password && <Badge tone="warn">Belum ganti password</Badge>}
                  {u.locked && <Badge tone="bad">Terkunci 15 menit</Badge>}
                </div>
              </div>
              <UserRowForms user={u} isSelf={u.id === admin.id} />
            </li>
          ))}
        </ul>
        <Panel title="Tambah Pengguna" className="self-start">
          <CreateUserForm />
        </Panel>
      </div>
    </>
  );
}

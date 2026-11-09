"use client";

import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { UserRow } from "@/lib/queries";
import { createUser, resetPassword, updateUserAccess, type UserFormState } from "./actions";

function Feedback({ state }: { state: UserFormState }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.success) return <Alert tone="good">{state.success}</Alert>;
  return null;
}

export function CreateUserForm() {
  const { state, onSubmit, pending } = useFormAction(createUser);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Feedback state={state} />
      <Field label="Nama" htmlFor="new_name">
        <input id="new_name" name="name" required className={fieldClass} />
      </Field>
      <Field label="Email" htmlFor="new_email">
        <input id="new_email" name="email" type="email" required placeholder="nama@mceasy.co.id" className={fieldClass} />
      </Field>
      <Field label="Peran" htmlFor="new_role">
        <select id="new_role" name="role" defaultValue="cpm" className={fieldClass}>
          <option value="cpm">CPM</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field label="Password sementara" htmlFor="new_password" hint="Minimal 8 karakter. Wajib diganti user saat login pertama.">
        <input id="new_password" name="password" type="text" autoComplete="off" minLength={8} required className={fieldClass} />
      </Field>
      <SubmitButton pending={pending}>Buat Akun</SubmitButton>
    </form>
  );
}

export function UserRowForms({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const access = useFormAction(updateUserAccess.bind(null, user.id));
  const reset = useFormAction(resetPassword.bind(null, user.id));
  return (
    <details className="mt-3 border-t border-line pt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent">Kelola Akun</summary>
      <div className="mt-2 grid gap-6 sm:grid-cols-2">
        <form onSubmit={access.onSubmit} noValidate className="space-y-3">
          <Feedback state={access.state} />
          <Field label="Peran" htmlFor={`role_${user.id}`}>
            <select id={`role_${user.id}`} name="role" defaultValue={user.role} disabled={isSelf} className={fieldClass}>
              <option value="cpm">CPM</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          {isSelf && <input type="hidden" name="role" value={user.role} />}
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="is_active" defaultChecked={user.is_active} disabled={isSelf} className="size-4" />
            Akun aktif
          </label>
          {isSelf ? (
            <p className="text-sm text-muted">Peran dan status akun Anda sendiri hanya bisa diubah Admin lain.</p>
          ) : (
            <SubmitButton pending={access.pending} variant="secondary">
              Simpan Akses
            </SubmitButton>
          )}
        </form>
        <form onSubmit={reset.onSubmit} noValidate className="space-y-3">
          <Feedback state={reset.state} />
          <Field label="Password sementara baru" htmlFor={`pw_${user.id}`} hint="User wajib menggantinya saat login berikutnya.">
            <input id={`pw_${user.id}`} name="password" type="text" autoComplete="off" minLength={8} required className={fieldClass} />
          </Field>
          <SubmitButton pending={reset.pending} variant="secondary" pendingText="Mereset...">
            Reset Password
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

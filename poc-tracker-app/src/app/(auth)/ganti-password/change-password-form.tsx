"use client";

import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { changePassword } from "../actions";

export function ChangePasswordForm() {
  const { state, onSubmit, pending } = useFormAction(changePassword);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Password sekarang" htmlFor="current">
        <input id="current" name="current" type="password" autoComplete="current-password" required className={fieldClass} />
      </Field>
      <Field label="Password baru" htmlFor="next" hint="Minimal 8 karakter.">
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className={fieldClass} />
      </Field>
      <Field label="Ulangi password baru" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className={fieldClass} />
      </Field>
      <SubmitButton pending={pending}>Simpan Password</SubmitButton>
    </form>
  );
}

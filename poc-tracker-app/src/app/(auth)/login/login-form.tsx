"use client";

import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { login } from "../actions";

export function LoginForm() {
  const { state, onSubmit, pending } = useFormAction(login);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="nama@mceasy.co.id"
          className={fieldClass}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </Field>
      <SubmitButton pending={pending} pendingText="Memeriksa...">
        Masuk
      </SubmitButton>
    </form>
  );
}

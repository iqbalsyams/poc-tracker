"use client";

import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/app/(app)/poc/actions";

export function DeactivateForm({ action }: { action: (state: FormState, fd: FormData) => Promise<FormState> }) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Alasan menonaktifkan" htmlFor="deactivate_reason" error={state?.fieldErrors?.reason}>
        <textarea id="deactivate_reason" name="reason" rows={2} required className={fieldClass} />
      </Field>
      <SubmitButton pending={pending} variant="danger" pendingText="Menonaktifkan...">
        Nonaktifkan Matrix
      </SubmitButton>
    </form>
  );
}

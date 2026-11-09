"use client";

import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { Achievement } from "@/lib/calc";
import { ACHIEVEMENT_LABEL } from "@/lib/format";
import { setAchievementOverride } from "@/app/(app)/poc/actions";

export function OverrideForm({ pocId, current }: { pocId: number; current: Achievement | null }) {
  const { state, onSubmit, pending } = useFormAction(setAchievementOverride.bind(null, pocId));
  return (
    <details className="border-t border-line pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-accent">
        {current ? "Ubah atau hapus override" : "Override achievement"}
      </summary>
      <form onSubmit={onSubmit} noValidate className="mt-2 space-y-3">
        {state?.error && <Alert>{state.error}</Alert>}
        <Field label="Achievement" htmlFor="achievement_override">
          <select id="achievement_override" name="achievement_override" defaultValue={current ?? ""} className={fieldClass}>
            <option value="">Ikuti hitungan otomatis</option>
            {Object.entries(ACHIEVEMENT_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alasan" htmlFor="override_reason" error={state?.fieldErrors?.reason}>
          <textarea id="override_reason" name="reason" rows={2} className={fieldClass} />
        </Field>
        <SubmitButton pending={pending}>Simpan Override</SubmitButton>
      </form>
    </details>
  );
}

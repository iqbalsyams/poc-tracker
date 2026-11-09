"use client";

import { useState } from "react";
import { setDealStatus } from "@/app/(app)/poc/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { DEAL_STATUS_LABEL, todayWib, type DealStatus } from "@/lib/format";

type Props = { pocId: number; current: DealStatus | null; date: string | null; reason: string | null };

export function DealForm({ pocId, current, date, reason }: Props) {
  const { state, onSubmit, pending } = useFormAction(setDealStatus.bind(null, pocId));
  const [deal, setDeal] = useState<DealStatus | "">(current ?? "");
  const decided = deal === "won" || deal === "lost";
  const err = state?.fieldErrors ?? {};
  return (
    <details className="border-t border-line pt-3" open={Boolean(state)}>
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">Ubah Status Deal</summary>
      <form onSubmit={onSubmit} noValidate className="mt-2 space-y-3">
        {state?.error && <Alert>{state.error}</Alert>}
        <Field label="Status deal" htmlFor="deal_status">
          <select
            id="deal_status"
            name="deal_status"
            value={deal}
            onChange={(e) => setDeal(e.target.value as DealStatus | "")}
            className={fieldClass}
          >
            <option value="">Belum diisi</option>
            {Object.entries(DEAL_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {decided && (
          <>
            <Field label="Tanggal diputuskan" htmlFor="deal_date" error={err.deal_date}>
              <input id="deal_date" name="deal_date" type="date" defaultValue={date ?? todayWib()} className={fieldClass} />
            </Field>
            <Field
              label={deal === "won" ? "Faktor penentu menang" : "Alasan kalah"}
              htmlFor="deal_reason"
              error={err.reason}
              hint="Minimal 10 karakter. Tampil di dashboard dan riwayat POC."
            >
              <textarea id="deal_reason" name="reason" rows={2} defaultValue={reason ?? ""} className={fieldClass} />
            </Field>
          </>
        )}
        <SubmitButton pending={pending}>Simpan Status Deal</SubmitButton>
      </form>
    </details>
  );
}

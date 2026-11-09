"use client";

import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import { Alert, Field, LinkButton, fieldClass } from "@/components/ui";
import { POC_STATUS_LABEL } from "@/lib/format";
import type { PocRow } from "@/lib/queries";
import type { FormState } from "./actions";

type Props = {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  poc?: PocRow;
  isAdmin: boolean;
  cpms: { id: number; name: string }[];
  currentUserId: number;
  cancelHref: string;
};

export function PocForm({ action, poc, isAdmin, cpms, currentUserId, cancelHref }: Props) {
  const { state, onSubmit, pending } = useFormAction(action);
  const err = state?.fieldErrors ?? {};
  const editing = Boolean(poc);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}

      <Field label="Nama customer" htmlFor="customer_name" error={err.customer_name} hint='Contoh: "GTL - Supporting Pre Deals".'>
        <input id="customer_name" name="customer_name" defaultValue={poc?.customer_name} required className={fieldClass} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        {isAdmin ? (
          <Field label="CPM" htmlFor="cpm_id">
            <select id="cpm_id" name="cpm_id" defaultValue={poc?.cpm_id ?? currentUserId} className={fieldClass}>
              {cpms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">CPM</p>
            <p className="flex min-h-11 items-center text-sm text-muted">
              {editing ? poc?.cpm_name : "Anda"} (hanya Admin yang bisa memindahkan POC ke CPM lain)
            </p>
          </div>
        )}
        <Field label="Status" htmlFor="status" error={err.status}>
          <select id="status" name="status" defaultValue={poc?.status ?? "upcoming"} className={fieldClass}>
            {Object.entries(POC_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal mulai POC" htmlFor="start_date" error={err.start_date} hint="Wajib saat status Running.">
          <input id="start_date" name="start_date" type="date" defaultValue={poc?.start_date ?? ""} className={fieldClass} />
        </Field>
        <Field label="Rencana tanggal selesai" htmlFor="end_date" error={err.end_date}>
          <input id="end_date" name="end_date" type="date" defaultValue={poc?.end_date ?? ""} className={fieldClass} />
        </Field>
        <Field label="Target closed" htmlFor="target_closed_date" error={err.target_closed_date} hint="Kosongkan jika belum ditentukan.">
          <input
            id="target_closed_date"
            name="target_closed_date"
            type="date"
            defaultValue={poc?.target_closed_date ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Potensi revenue (Rp)" htmlFor="potential_revenue" error={err.potential_revenue} hint="Angka saja, misal 1260000000.">
          <input
            id="potential_revenue"
            name="potential_revenue"
            inputMode="numeric"
            defaultValue={poc ? String(poc.potential_revenue) : ""}
            required
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="Produk / scope" htmlFor="scope" hint="Contoh: FMS, TrackVision, RFID.">
        <input id="scope" name="scope" defaultValue={poc?.scope ?? ""} className={fieldClass} />
      </Field>
      <Field label="Catatan" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={poc?.notes ?? ""} className={fieldClass} />
      </Field>

      {editing && isAdmin && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="is_archived" defaultChecked={poc?.is_archived} className="size-4" />
          Arsipkan POC ini (disembunyikan dari daftar utama, data tetap tersimpan)
        </label>
      )}

      {editing && (
        <Field
          label="Alasan perubahan"
          htmlFor="reason"
          error={err.reason}
          hint="Wajib jika mengubah potensi revenue, target closed, CPM, atau status arsip. Tercatat di audit trail."
        >
          <textarea id="reason" name="reason" rows={2} className={fieldClass} />
        </Field>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending}>{editing ? "Simpan Perubahan" : "Simpan POC"}</SubmitButton>
        <LinkButton href={cancelHref}>Batal</LinkButton>
      </div>
    </form>
  );
}

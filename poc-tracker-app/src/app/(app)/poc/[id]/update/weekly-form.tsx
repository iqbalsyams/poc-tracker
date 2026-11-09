"use client";

import { useState } from "react";
import { ValueBadge } from "@/components/poc-badges";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, LinkButton, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/app/(app)/poc/actions";
import { computeScore, parseNumber, type ValueStatus } from "@/lib/calc";
import { VALUE_STATUS_LABEL, formatNumber, formatTarget } from "@/lib/format";
import type { MatrixVersion, WeeklyValueRow } from "@/lib/queries";

type Props = {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  weekNo: number;
  versions: MatrixVersion[];
  existing?: {
    period_start: string;
    period_end: string;
    progress: string | null;
    issues: string | null;
    next_action: string | null;
    values: WeeklyValueRow[];
  };
  defaultStart: string;
  defaultEnd: string;
  cancelHref: string;
};

export function WeeklyForm({ action, weekNo, versions, existing, defaultStart, defaultEnd, cancelHref }: Props) {
  const { state, onSubmit, pending } = useFormAction(action);
  const err = state?.fieldErrors ?? {};
  const correcting = Boolean(existing);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state?.error && <Alert>{state.error}</Alert>}
      {Object.keys(err).length > 0 && !state?.error && <Alert>Ada isian yang perlu diperbaiki. Lihat pesan di bawah setiap field.</Alert>}

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold text-ink">Periode minggu ke-{weekNo}</legend>
        <p className="text-sm text-muted">Usulan tanggal: 7 hari setelah periode sebelumnya. Ubah jika periode laporan POC ini berbeda.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mulai" htmlFor="period_start" error={err.period_start}>
            <input id="period_start" name="period_start" type="date" defaultValue={existing?.period_start ?? defaultStart} required className={fieldClass} />
          </Field>
          <Field label="Selesai" htmlFor="period_end" error={err.period_end}>
            <input id="period_end" name="period_end" type="date" defaultValue={existing?.period_end ?? defaultEnd} required className={fieldClass} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-ink">Hasil per matrix</legend>
        {versions.map((v) => (
          <MatrixInput
            key={v.id}
            version={v}
            existing={existing?.values.find((x) => x.matrix_version_id === v.id)}
            error={err[`val_${v.id}`]}
          />
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-ink">Catatan minggu ini</legend>
        <Field label="Progress" htmlFor="progress">
          <textarea id="progress" name="progress" rows={3} defaultValue={existing?.progress ?? ""} className={fieldClass} />
        </Field>
        <Field label="Kendala" htmlFor="issues">
          <textarea id="issues" name="issues" rows={2} defaultValue={existing?.issues ?? ""} className={fieldClass} />
        </Field>
        <Field label="Next action" htmlFor="next_action">
          <textarea id="next_action" name="next_action" rows={2} defaultValue={existing?.next_action ?? ""} className={fieldClass} />
        </Field>
      </fieldset>

      {correcting && (
        <Field
          label="Alasan koreksi"
          htmlFor="reason"
          error={err.reason}
          hint="Wajib, minimal 10 karakter. Nilai sebelum koreksi tetap tersimpan di riwayat."
        >
          <textarea id="reason" name="reason" rows={2} required className={fieldClass} />
        </Field>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending}>{correcting ? "Simpan Koreksi" : `Simpan Update Minggu ke-${weekNo}`}</SubmitButton>
        <LinkButton href={cancelHref}>Batal</LinkButton>
      </div>
    </form>
  );
}

function MatrixInput({ version: v, existing, error }: { version: MatrixVersion; existing?: WeeklyValueRow; error?: string }) {
  const [num, setNum] = useState(existing?.numerator?.toString() ?? "");
  const [den, setDen] = useState(existing?.denominator?.toString() ?? "");
  const [act, setAct] = useState(existing?.actual_value?.toString() ?? "");
  const [status, setStatus] = useState<ValueStatus | "">(existing?.status ?? "");

  const preview =
    v.calc_type === "qualitative"
      ? null
      : computeScore(v, {
          numerator: parseNumber(num),
          denominator: parseNumber(den),
          actual_value: parseNumber(act),
        });
  const id = (field: string) => `${field}_${v.id}`;

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-ink">{v.name}</h3>
        <p className="text-sm text-muted">Target {formatTarget(v)}</p>
      </div>
      {v.description && <p className="mt-1 text-sm text-muted">{v.description}</p>}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {v.calc_type === "ratio" && (
          <>
            <Field label="Pembilang" htmlFor={id("num")} hint="Contoh: alert yang terdeteksi.">
              <input id={id("num")} name={id("num")} inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} required className={fieldClass} />
            </Field>
            <Field label="Penyebut" htmlFor={id("den")} hint="Contoh: total event uji.">
              <input id={id("den")} name={id("den")} inputMode="decimal" value={den} onChange={(e) => setDen(e.target.value)} required className={fieldClass} />
            </Field>
          </>
        )}
        {(v.calc_type === "reduction" || v.calc_type === "value") && (
          <Field
            label={`Nilai minggu ini${v.unit ? ` (${v.unit})` : ""}`}
            htmlFor={id("act")}
            hint={v.calc_type === "reduction" ? `Baseline ${formatNumber(v.baseline)}${v.unit ? ` ${v.unit}` : ""}.` : undefined}
          >
            <input id={id("act")} name={id("act")} inputMode="decimal" value={act} onChange={(e) => setAct(e.target.value)} required className={fieldClass} />
          </Field>
        )}
        {v.calc_type === "qualitative" && (
          <>
            <Field label="Hasil minggu ini" htmlFor={id("res")}>
              <textarea id={id("res")} name={id("res")} rows={2} defaultValue={existing?.result_text ?? ""} className={fieldClass} />
            </Field>
            <Field label="Status" htmlFor={id("st")}>
              <select
                id={id("st")}
                name={id("st")}
                value={status}
                onChange={(e) => setStatus(e.target.value as ValueStatus)}
                required
                className={fieldClass}
              >
                <option value="">Pilih status</option>
                {Object.entries(VALUE_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>

      {preview && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink" aria-live="polite">
          Skor: <span className="font-medium tabular-nums">{formatNumber(preview.score)}{v.calc_type === "value" ? (v.unit ? ` ${v.unit}` : "") : "%"}</span>
          <ValueBadge value={preview.status} />
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

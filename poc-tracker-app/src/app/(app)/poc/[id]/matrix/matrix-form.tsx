"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Button, Field, LinkButton, fieldClass, tableClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { CalcType } from "@/lib/calc";
import { CALC_TYPE_LABEL } from "@/lib/format";
import type { MatrixVersion } from "@/lib/queries";
import type { FormState } from "@/app/(app)/poc/actions";

type Props = {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  current: MatrixVersion | null;
  hasUpdates: boolean;
  nextWeek: number;
  cancelHref: string;
};

const TYPE_HELP: Record<CalcType, string> = {
  ratio: "Skor = pembilang ÷ penyebut × 100%. Contoh: alert terdeteksi ÷ total event uji.",
  reduction: "Skor = (baseline − nilai minggu ini) ÷ baseline × 100%. Contoh: alert per 100 km turun dari 37.",
  value: "Skor = nilai yang diisi apa adanya. Contoh: false alarm rate dalam %.",
  qualitative: "Tidak ada skor angka. Setiap minggu CPM menulis hasil dan memilih Met, Partial, atau Not met.",
};

const LABELS: Record<string, string> = {
  name: "Nama matrix",
  description: "Cara ukur",
  calc_type: "Tipe",
  baseline: "Baseline",
  unit: "Satuan",
  target_operator: "Pembanding target",
  target_value: "Nilai target",
  target_text: "Target",
};

function snapshot(form: HTMLFormElement): Record<string, string> {
  const fd = new FormData(form);
  const type = String(fd.get("calc_type"));
  const out: Record<string, string> = {
    name: String(fd.get("name") ?? "").trim(),
    description: String(fd.get("description") ?? "").trim(),
    calc_type: CALC_TYPE_LABEL[type as CalcType] ?? type,
  };
  if (type === "qualitative") {
    out.target_text = String(fd.get("target_text") ?? "").trim();
  } else {
    out.target_operator = String(fd.get("target_operator") ?? "");
    out.target_value = String(fd.get("target_value") ?? "").trim().replace(",", ".");
    if (type === "reduction") out.baseline = String(fd.get("baseline") ?? "").trim().replace(",", ".");
    if (type === "reduction" || type === "value") out.unit = String(fd.get("unit") ?? "").trim();
  }
  return out;
}

function fromVersion(v: MatrixVersion): Record<string, string> {
  const out: Record<string, string> = {
    name: v.name,
    description: v.description ?? "",
    calc_type: CALC_TYPE_LABEL[v.calc_type],
  };
  if (v.calc_type === "qualitative") {
    out.target_text = v.target_text ?? "";
  } else {
    out.target_operator = v.target_operator ?? "";
    out.target_value = v.target_value === null ? "" : String(v.target_value);
    if (v.calc_type === "reduction") out.baseline = v.baseline === null ? "" : String(v.baseline);
    if (v.calc_type === "reduction" || v.calc_type === "value") out.unit = v.unit ?? "";
  }
  return out;
}

export function MatrixForm({ action, current, hasUpdates, nextWeek, cancelHref }: Props) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [calcType, setCalcType] = useState<CalcType>(current?.calc_type ?? "ratio");
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [changes, setChanges] = useState<{ field: string; before: string; after: string }[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const err = state?.fieldErrors ?? {};
  // Error dari server pada field matrix berarti user perlu kembali ke langkah isian
  const editErrors = Object.keys(err).some((k) => k !== "reason" && k !== "confirm");
  const showStep = editErrors ? "edit" : step;

  function goToConfirm() {
    if (!formRef.current) return;
    if (!formRef.current.reportValidity()) return;
    const after = snapshot(formRef.current);
    const before = current ? fromVersion(current) : {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    setChanges(
      keys
        .filter((k) => (before[k] ?? "") !== (after[k] ?? ""))
        .map((k) => ({ field: LABELS[k] ?? k, before: before[k] ?? "", after: after[k] ?? "" })),
    );
    setStep("confirm");
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}

      <div hidden={showStep !== "edit"} className="space-y-5">
        <Field label="Nama matrix" htmlFor="name" error={err.name} hint='Contoh: "Deteksi alert DMS & ADAS".'>
          <input id="name" name="name" defaultValue={current?.name} required className={fieldClass} />
        </Field>
        <Field label="Cara ukur" htmlFor="description" hint="Jelaskan bagaimana angka diambil, supaya CPM lain bisa mengulang pengukurannya.">
          <textarea id="description" name="description" rows={3} defaultValue={current?.description ?? ""} className={fieldClass} />
        </Field>
        <Field label="Tipe matrix" htmlFor="calc_type" error={err.calc_type} hint={TYPE_HELP[calcType]}>
          <select
            id="calc_type"
            name="calc_type"
            value={calcType}
            onChange={(e) => setCalcType(e.target.value as CalcType)}
            className={fieldClass}
          >
            {Object.entries(CALC_TYPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {calcType === "qualitative" ? (
          <Field label="Target" htmlFor="target_text" error={err.target_text} hint="Tulis kondisi yang dianggap berhasil.">
            <textarea id="target_text" name="target_text" rows={2} defaultValue={current?.target_text ?? ""} required className={fieldClass} />
          </Field>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {calcType === "reduction" && (
              <Field label="Baseline" htmlFor="baseline" error={err.baseline} hint="Nilai awal sebelum POC.">
                <input id="baseline" name="baseline" inputMode="decimal" defaultValue={current?.baseline ?? ""} required className={fieldClass} />
              </Field>
            )}
            {(calcType === "reduction" || calcType === "value") && (
              <Field label="Satuan" htmlFor="unit" hint="Contoh: alert/100 km, %.">
                <input id="unit" name="unit" defaultValue={current?.unit ?? ""} className={fieldClass} />
              </Field>
            )}
            <Field label="Pembanding target" htmlFor="target_operator" error={err.target_operator}>
              <select id="target_operator" name="target_operator" defaultValue={current?.target_operator ?? ">="} className={fieldClass}>
                <option value=">=">≥ minimal</option>
                <option value=">">&gt; lebih dari</option>
                <option value="<=">≤ maksimal</option>
                <option value="<">&lt; kurang dari</option>
              </select>
            </Field>
            <Field
              label={calcType === "value" ? "Nilai target" : "Nilai target (%)"}
              htmlFor="target_value"
              error={err.target_value}
              hint={calcType === "reduction" ? "Persentase penurunan, misal 10 untuk turun minimal 10%." : undefined}
            >
              <input id="target_value" name="target_value" inputMode="decimal" defaultValue={current?.target_value ?? ""} required className={fieldClass} />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {hasUpdates ? (
            <Button type="button" variant="primary" onClick={goToConfirm}>
              Lanjut ke Konfirmasi
            </Button>
          ) : (
            <SubmitButton pending={pending}>{current ? "Simpan Perubahan" : "Simpan Matrix"}</SubmitButton>
          )}
          <LinkButton href={cancelHref}>Batal</LinkButton>
        </div>
      </div>

      {hasUpdates && showStep === "confirm" && (
        // Satu-satunya elemen dengan elevation "modal": langkah ini menahan user sebelum perubahan permanen
        <div className="space-y-5 rounded-xl border border-warn-line bg-surface p-4 shadow-[var(--shadow-modal)] sm:p-5">
          <div className="rounded-lg bg-warn-bg px-4 py-3">
            <h2 className="text-base leading-6 font-semibold text-warn">Konfirmasi {current ? "perubahan" : "penambahan"} matrix</h2>
            <p className="mt-1 text-[13px] leading-[18px] text-ink">
              POC ini sudah punya update mingguan. {current ? `Ini akan menjadi versi ${current.version_no + 1}` : "Matrix ini"} dan
              berlaku mulai minggu ke-{nextWeek}. Minggu sebelumnya tetap dinilai dengan versi lama. Versi lama tidak dihapus.
            </p>
          </div>
          {changes.length === 0 ? (
            <p className="text-sm font-medium text-ink">Belum ada yang berubah dibanding versi sekarang.</p>
          ) : (
            <div className={tableClass.scrollWrap}>
              <table className={tableClass.table}>
                <thead className={tableClass.head}>
                  <tr>
                    <th scope="col" className={tableClass.th}>Field</th>
                    {current && <th scope="col" className={tableClass.th}>Sebelum</th>}
                    <th scope="col" className={tableClass.th}>{current ? "Sesudah" : "Nilai"}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field}>
                      <td className={`${tableClass.td} text-muted`}>{c.field}</td>
                      {current && <td className={tableClass.td}><del>{c.before || "(kosong)"}</del></td>}
                      <td className={`${tableClass.td} font-semibold`}>{c.after || "(kosong)"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Field label="Alasan perubahan" htmlFor="reason" error={err.reason} hint="Minimal 20 karakter. Terlihat oleh semua CPM di riwayat POC.">
            <textarea id="reason" name="reason" rows={3} minLength={20} required className={fieldClass} />
          </Field>
          <div className="space-y-1.5">
            <label className="flex min-h-11 items-start gap-2 pt-2 text-sm text-ink">
              <input type="checkbox" name="confirm" required className="mt-0.5 size-4 shrink-0" />
              Saya paham perubahan ini tercatat permanen atas nama saya dan ditandai &quot;Target diubah&quot; di daftar POC.
            </label>
            {err.confirm && (
              <p className="text-sm font-medium text-bad" role="alert">
                {err.confirm}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <SubmitButton pending={pending} pendingText="Menyimpan versi...">
              {current ? `Simpan sebagai Versi ${current.version_no + 1}` : "Simpan Matrix"}
            </SubmitButton>
            <Button type="button" onClick={() => setStep("edit")}>
              Kembali ke Isian
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

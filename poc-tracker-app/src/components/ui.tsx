import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Mengikuti McEasy Design System: MainButton (primary/secondary) dan DangerButton (secondary).
type Variant = "primary" | "secondary" | "danger";

// 44px di layar sentuh (tap target R-03), 36px (ukuran lg design system) mulai 640px
const BUTTON_BASE =
  "inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:border-line disabled:bg-line-default disabled:text-muted";

const BUTTON_VARIANT: Record<Variant, string> = {
  primary: "border-action bg-action text-action-ink hover:border-action-hover hover:bg-action-hover",
  secondary: "border-field-line bg-surface text-ink hover:bg-surface-alt active:bg-surface-pressed",
  danger: "border-bad bg-surface text-bad hover:bg-bad-bg",
};

export function buttonClass(variant: Variant = "secondary") {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]}`;
}

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export const fieldClass =
  "block w-full min-h-11 sm:min-h-9 rounded-md border border-field-line bg-surface px-2.5 py-1.5 text-sm text-ink aria-invalid:border-bad disabled:bg-surface-alt disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] leading-[18px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs leading-4 text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs leading-4 font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

// BadgeStatus "subtle": pill 20px, latar tint feedback, teks warna feedback
const BADGE_TONE: Record<Tone, string> = {
  neutral: "bg-surface-alt text-neutral-badge",
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
};

/** Label status. Warna selalu berpasangan dengan teks, tidak pernah warna saja. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-xs leading-4 font-medium ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-[30px] font-bold text-ink">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Card design system: radius 12, border subtle, tanpa bayangan. */
export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
          {title && <h2 className="text-base leading-6 font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "good" | "warn"; children: ReactNode }) {
  const styles = {
    bad: "border-bad bg-bad-bg text-bad",
    good: "border-good bg-good-bg text-good",
    warn: "border-warn-line bg-warn-bg text-warn",
  };
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

/** Empty state: menjelaskan kenapa kosong dan satu aksi untuk mengisinya (R-27). */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <p className="text-base leading-6 font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-[13px] leading-[18px] text-muted">{children}</div>}
    </div>
  );
}

/** Kelas tabel sesuai Table design system: header 12/700 uppercase di latar sunken. */
export const tableClass = {
  wrap: "overflow-hidden rounded-lg border border-line bg-surface",
  // Untuk tabel yang bisa lebih lebar dari layar HP: digeser di dalam kotaknya, halaman tidak ikut melebar
  scrollWrap: "overflow-x-auto rounded-lg border border-line bg-surface",
  table: "w-full text-left text-[13px] leading-[18px]",
  head: "bg-surface-alt",
  th: "px-3.5 py-2.5 text-xs leading-4 font-bold tracking-[0.03em] uppercase text-muted",
  td: "border-t border-line px-3.5 py-3 text-ink align-top",
};

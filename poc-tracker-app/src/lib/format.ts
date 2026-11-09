import type { Achievement, CalcType, Operator, ValueStatus } from "@/lib/calc";

export type PocStatus = "upcoming" | "running" | "on_hold" | "done" | "cancelled";

export const POC_STATUS_LABEL: Record<PocStatus, string> = {
  upcoming: "Upcoming",
  running: "Running",
  on_hold: "On Hold",
  done: "Done",
  cancelled: "Cancelled",
};

export type DealStatus = "awaiting_deal" | "won" | "lost";

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  awaiting_deal: "Awaiting Deal",
  won: "Deal Won",
  lost: "Deal Lost",
};

export const ACHIEVEMENT_LABEL: Record<Achievement, string> = {
  wip: "Work in Progress",
  achieved: "Achieved",
  partial: "Partially Achieved",
  not_achieved: "Not Achieved",
};

export const VALUE_STATUS_LABEL: Record<ValueStatus, string> = {
  met: "Met",
  partial: "Partial",
  not_met: "Not met",
};

export const CALC_TYPE_LABEL: Record<CalcType, string> = {
  ratio: "Rasio (pembilang ÷ penyebut)",
  reduction: "Penurunan dari baseline",
  value: "Nilai langsung",
  qualitative: "Kualitatif",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** 'YYYY-MM-DD' -> '9 Nov 2026'. Dibaca dari string supaya tidak bergeser karena zona waktu. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const dateTimeWib = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: Date | string): string {
  return `${dateTimeWib.format(new Date(value))} WIB`;
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(n: number): string {
  return rupiah.format(n);
}

/** Rp 1,26 M / Rp 418,8 jt, untuk angka ringkas di dashboard; nilai penuh tetap di tooltip & tabel. */
export function formatRupiahShort(n: number): string {
  const fmt = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);
  if (n >= 1e9) return `Rp ${fmt(n / 1e9)} M`;
  if (n >= 1e6) return `Rp ${fmt(n / 1e6)} jt`;
  return formatRupiah(n);
}

export function formatNumber(n: number | null, digits = 2): string {
  if (n === null) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);
}

const OPERATOR_TEXT: Record<Operator, string> = { ">=": "≥", "<=": "≤", ">": ">", "<": "<" };

export function formatTarget(m: {
  calc_type: CalcType;
  target_value: number | null;
  target_operator: Operator | null;
  target_text: string | null;
  unit: string | null;
}): string {
  if (m.calc_type === "qualitative") return m.target_text ?? "";
  const unit = m.calc_type === "value" ? (m.unit ? ` ${m.unit}` : "") : "%";
  return `${OPERATOR_TEXT[m.target_operator ?? ">="]}${formatNumber(m.target_value)}${unit}`;
}

/** Hari ini menurut WIB sebagai 'YYYY-MM-DD'. */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

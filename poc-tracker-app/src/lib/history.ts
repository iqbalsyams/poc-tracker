import type { CalcType, Operator } from "@/lib/calc";
import {
  ACHIEVEMENT_LABEL,
  CALC_TYPE_LABEL,
  DEAL_STATUS_LABEL,
  POC_STATUS_LABEL,
  VALUE_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatRupiah,
  formatTarget,
} from "@/lib/format";
import type { AuditRow, MatrixVersion } from "@/lib/queries";

export type HistoryChange = { field: string; before: string; after: string };
export type HistoryItem = {
  id: number;
  occurredAt: Date;
  userName: string;
  summary: string;
  changes: HistoryChange[];
  reason: string | null;
};

type Json = Record<string, unknown>;

const FIELD_LABEL: Record<string, string> = {
  customer_name: "Nama customer",
  cpm_id: "CPM",
  status: "Status",
  start_date: "Tanggal mulai",
  end_date: "Rencana selesai",
  target_closed_date: "Target closed",
  potential_revenue: "Potensi revenue",
  scope: "Scope",
  notes: "Catatan",
  achievement: "Achievement (otomatis)",
  achievement_override: "Achievement (override)",
  is_archived: "Diarsipkan",
  deal_status: "Status deal",
  deal_date: "Tanggal deal",
  deal_reason: "Alasan deal",
  is_active: "Aktif",
  name: "Nama matrix",
  description: "Cara ukur",
  calc_type: "Tipe",
  target: "Target",
  baseline: "Baseline",
  unit: "Satuan",
  period_start: "Periode mulai",
  period_end: "Periode selesai",
  progress: "Progress",
  issues: "Kendala",
  next_action: "Next action",
  result: "Hasil",
};

// Kolom teknis yang tidak berarti bagi pembaca riwayat
const HIDDEN = new Set([
  "id",
  "poc_id",
  "matrix_id",
  "weekly_update_id",
  "matrix_version_id",
  "created_at",
  "updated_at",
  "created_by",
  "created_by_name",
  "submitted_by",
  "submitted_at",
  "order_no",
  "deactivated_reason",
  "achievement_override_reason",
  "change_reason",
  "effective_from_week",
  "version_no",
  "week_no",
  "target_value",
  "target_operator",
  "target_text",
  "numerator",
  "denominator",
  "actual_value",
  "result_text",
  "score",
]);

function show(field: string, value: unknown, users: Map<number, string>): string {
  if (value === null || value === undefined || value === "") return "(kosong)";
  switch (field) {
    case "cpm_id":
      return users.get(Number(value)) ?? `User #${value}`;
    case "status":
      return POC_STATUS_LABEL[value as keyof typeof POC_STATUS_LABEL] ?? VALUE_STATUS_LABEL[value as keyof typeof VALUE_STATUS_LABEL] ?? String(value);
    case "achievement":
    case "achievement_override":
      return ACHIEVEMENT_LABEL[value as keyof typeof ACHIEVEMENT_LABEL] ?? String(value);
    case "calc_type":
      return CALC_TYPE_LABEL[value as CalcType] ?? String(value);
    case "deal_status":
      return DEAL_STATUS_LABEL[value as keyof typeof DEAL_STATUS_LABEL] ?? String(value);
    case "potential_revenue":
      return formatRupiah(Number(value));
    case "start_date":
    case "end_date":
    case "target_closed_date":
    case "deal_date":
    case "period_start":
    case "period_end":
      return formatDate(String(value));
    case "is_archived":
    case "is_active":
      return value ? "Ya" : "Tidak";
    case "baseline":
      return formatNumber(Number(value));
    default:
      return String(value);
  }
}

function targetOf(v: Json): string {
  return formatTarget({
    calc_type: v.calc_type as CalcType,
    target_value: v.target_value === null ? null : Number(v.target_value),
    target_operator: (v.target_operator as Operator) ?? null,
    target_text: (v.target_text as string) ?? null,
    unit: (v.unit as string) ?? null,
  });
}

function resultOf(v: Json): string {
  const status = VALUE_STATUS_LABEL[v.status as keyof typeof VALUE_STATUS_LABEL] ?? "";
  if (v.result_text) return `${v.result_text} (${status})`;
  if (v.numerator !== null && v.numerator !== undefined) {
    return `${formatNumber(Number(v.numerator))}/${formatNumber(Number(v.denominator))} = ${formatNumber(Number(v.score))}% (${status})`;
  }
  return `${formatNumber(Number(v.actual_value))}, skor ${formatNumber(Number(v.score))} (${status})`;
}

/** Bandingkan dua snapshot baris; kolom target & hasil digabung jadi satu baris yang bisa dibaca. */
function diff(before: Json | null, after: Json, users: Map<number, string>): HistoryChange[] {
  const b = before ?? {};
  const changes: HistoryChange[] = [];
  const keys = new Set([...Object.keys(b), ...Object.keys(after)]);
  for (const key of keys) {
    if (HIDDEN.has(key)) continue;
    if (JSON.stringify(b[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    changes.push({
      field: FIELD_LABEL[key] ?? key,
      before: before ? show(key, b[key], users) : "",
      after: show(key, after[key], users),
    });
  }
  if ("calc_type" in after) {
    const t0 = before ? targetOf(b) : "";
    const t1 = targetOf(after);
    if (t0 !== t1) changes.push({ field: FIELD_LABEL.target, before: t0, after: t1 });
  }
  if ("status" in after && "score" in after) {
    const r0 = before ? resultOf(b) : "";
    const r1 = resultOf(after);
    if (r0 !== r1) changes.push({ field: FIELD_LABEL.result, before: r0, after: r1 });
    return changes.filter((c) => c.field !== "Status");
  }
  return changes;
}

export function describeHistory(
  rows: AuditRow[],
  versions: MatrixVersion[],
  users: Map<number, string>,
): HistoryItem[] {
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const versionByNo = new Map(versions.map((v) => [`${v.matrix_id}:${v.version_no}`, v]));

  return rows.map((row) => {
    const after = row.after ?? {};
    const before = row.before;
    let summary: string;
    let changes: HistoryChange[];

    switch (row.action) {
      case "poc.insert":
        summary = "Membuat POC";
        changes = diff(null, after, users);
        break;
      case "poc.update":
        summary = "Mengubah info POC";
        changes = diff(before, after, users);
        break;
      case "matrix.insert":
        summary = "Menambah matrix";
        changes = [];
        break;
      case "matrix.update":
        summary = after.is_active === false ? "Menonaktifkan matrix" : "Mengubah matrix";
        changes = [];
        break;
      case "matrix_version.insert": {
        const versionNo = Number(after.version_no);
        const previous = versionByNo.get(`${after.matrix_id}:${versionNo - 1}`);
        summary =
          versionNo === 1
            ? `Membuat matrix "${after.name}"`
            : `Membuat versi ${versionNo} matrix "${after.name}", berlaku mulai minggu ke-${after.effective_from_week}`;
        changes = diff(previous ? (previous as unknown as Json) : null, after, users);
        break;
      }
      case "weekly_update.insert":
        summary = `Submit update minggu ke-${after.week_no}`;
        changes = diff(null, after, users);
        break;
      case "weekly_update.update":
        summary = `Mengoreksi update minggu ke-${after.week_no}`;
        changes = diff(before, after, users);
        break;
      case "weekly_value.insert":
      case "weekly_value.update": {
        const version = versionById.get(Number(after.matrix_version_id));
        const name = version ? `"${version.name}"` : "matrix";
        summary = row.action.endsWith("insert") ? `Mengisi nilai ${name}` : `Mengoreksi nilai ${name}`;
        changes = diff(before, after, users);
        break;
      }
      default:
        summary = row.action;
        changes = before ? diff(before, after, users) : [];
    }

    return {
      id: row.id,
      occurredAt: row.occurred_at,
      userName: row.user_name ?? "Sistem",
      summary,
      changes,
      reason: row.reason,
    };
  });
}

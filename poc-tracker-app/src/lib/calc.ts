export type CalcType = "ratio" | "reduction" | "value" | "qualitative";
export type Operator = ">=" | "<=" | ">" | "<";
export type ValueStatus = "met" | "partial" | "not_met";
export type Achievement = "wip" | "achieved" | "partial" | "not_achieved";

export type MatrixTarget = {
  calc_type: CalcType;
  baseline: number | null;
  target_value: number | null;
  target_operator: Operator | null;
};

export type ValueInput = {
  numerator?: number | null;
  denominator?: number | null;
  actual_value?: number | null;
  status?: ValueStatus | null;
};

export function compare(a: number, op: Operator, b: number): boolean {
  switch (op) {
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case "<":
      return a < b;
  }
}

/**
 * Rumus FR-22. Mengembalikan null kalau input belum lengkap atau tidak valid
 * (misal penyebut 0), supaya pemanggil bisa menampilkan pesan yang tepat.
 */
export function computeScore(
  m: MatrixTarget,
  v: ValueInput,
): { score: number | null; status: ValueStatus } | null {
  if (m.calc_type === "qualitative") {
    return v.status ? { score: null, status: v.status } : null;
  }
  if (m.target_value === null || m.target_operator === null) return null;

  let score: number;
  if (m.calc_type === "ratio") {
    if (v.numerator == null || v.denominator == null || v.denominator === 0) return null;
    score = (v.numerator / v.denominator) * 100;
  } else if (m.calc_type === "reduction") {
    if (v.actual_value == null || !m.baseline) return null;
    score = ((m.baseline - v.actual_value) / m.baseline) * 100;
  } else {
    if (v.actual_value == null) return null;
    score = v.actual_value;
  }
  score = Math.round(score * 100) / 100;
  return { score, status: compare(score, m.target_operator, m.target_value) ? "met" : "not_met" };
}

/** FR-34: semua Met = Achieved, ada Met/Partial = Partially Achieved, sisanya Not Achieved. */
export function computeAchievement(statuses: ValueStatus[]): Achievement {
  if (statuses.length === 0) return "wip";
  if (statuses.every((s) => s === "met")) return "achieved";
  if (statuses.some((s) => s === "met" || s === "partial")) return "partial";
  return "not_achieved";
}

/** Menerima "34,1" maupun "34.1"; titik ribuan Indonesia ("1.250") tidak didukung di field angka. */
export function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const text = String(raw).trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

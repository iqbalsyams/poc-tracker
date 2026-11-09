"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { canEditPoc, clientIp, requireUser, type CurrentUser } from "@/lib/auth";
import {
  computeAchievement,
  computeScore,
  parseNumber,
  type Achievement,
  type CalcType,
  type Operator,
  type ValueStatus,
} from "@/lib/calc";
import { query, withAudit, type Tx } from "@/lib/db";
import type { DealStatus, PocStatus } from "@/lib/format";
import { getPoc, type PocRow } from "@/lib/queries";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const POC_STATUSES: PocStatus[] = ["upcoming", "running", "on_hold", "done", "cancelled"];
const ACHIEVEMENTS: Achievement[] = ["wip", "achieved", "partial", "not_achieved"];
const CALC_TYPES: CalcType[] = ["ratio", "reduction", "value", "qualitative"];
const OPERATORS: Operator[] = [">=", "<=", ">", "<"];
const VALUE_STATUSES: ValueStatus[] = ["met", "partial", "not_met"];

const MIN_REASON = 10;
const MIN_MATRIX_REASON = 20; // FR-24

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optionalText = (fd: FormData, key: string) => text(fd, key) || null;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

async function loadEditablePoc(user: CurrentUser, pocId: number): Promise<PocRow> {
  const poc = await getPoc(pocId);
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) throw new Error("Anda tidak punya akses untuk mengubah POC ini.");
  return poc;
}

async function hasWeeklyUpdate(tx: Tx | null, pocId: number): Promise<{ any: boolean; maxWeek: number }> {
  const sql = "select count(*) as n, coalesce(max(week_no), 0) as max_week from weekly_update where poc_id = $1";
  const [row] = tx
    ? await tx.query<{ n: number; max_week: number }>(sql, [pocId])
    : await query<{ n: number; max_week: number }>(sql, [pocId]);
  return { any: row.n > 0, maxWeek: row.max_week };
}

/** FR-34: achievement dihitung dari update terakhir, hanya matrix yang masih aktif. */
async function recomputeAchievement(tx: Tx, pocId: number) {
  const rows = await tx.query<{ status: ValueStatus }>(
    `select wv.status
       from weekly_value wv
       join weekly_update w on w.id = wv.weekly_update_id
       join matrix_version mv on mv.id = wv.matrix_version_id
       join matrix m on m.id = mv.matrix_id
      where w.poc_id = $1 and m.is_active
        and w.week_no = (select max(week_no) from weekly_update where poc_id = $1)`,
    [pocId],
  );
  const achievement = computeAchievement(rows.map((r) => r.status));
  await tx.query("update poc set achievement = $2 where id = $1 and achievement <> $2", [pocId, achievement]);
}

// ---------------------------------------------------------------- POC

type PocInput = {
  customer_name: string;
  status: PocStatus;
  start_date: string | null;
  end_date: string | null;
  target_closed_date: string | null;
  potential_revenue: number;
  scope: string | null;
  notes: string | null;
};

function readPoc(fd: FormData): { input?: PocInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const customer_name = text(fd, "customer_name");
  const status = text(fd, "status") as PocStatus;
  const start_date = optionalText(fd, "start_date");
  const end_date = optionalText(fd, "end_date");
  const target_closed_date = optionalText(fd, "target_closed_date");
  // Revenue boleh diketik "1.260.000.000" atau "Rp 1,26 M"? Hanya angka yang dipakai: titik/koma ribuan dibuang.
  const revenueDigits = text(fd, "potential_revenue").replace(/[^\d]/g, "");

  if (!customer_name) errors.customer_name = "Isi nama customer.";
  if (!POC_STATUSES.includes(status)) errors.status = "Pilih status.";
  if (status === "running" && !start_date) errors.start_date = "Tanggal mulai wajib diisi untuk POC yang sedang berjalan.";
  if (start_date && !isDate(start_date)) errors.start_date = "Format tanggal tidak valid.";
  if (end_date && start_date && end_date < start_date) errors.end_date = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (target_closed_date && !isDate(target_closed_date)) errors.target_closed_date = "Format tanggal tidak valid.";
  if (!revenueDigits) errors.potential_revenue = "Isi potensi revenue dalam Rupiah (boleh 0).";

  if (Object.keys(errors).length) return { fieldErrors: errors };
  return {
    input: {
      customer_name,
      status,
      start_date,
      end_date,
      target_closed_date,
      potential_revenue: Number(revenueDigits),
      scope: optionalText(fd, "scope"),
      notes: optionalText(fd, "notes"),
    },
  };
}

export async function createPoc(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const { input, fieldErrors } = readPoc(fd);
  if (!input) return { fieldErrors };

  // CPM selalu membuat POC atas namanya sendiri; Admin boleh memilih CPM lain
  const cpmId = user.role === "admin" ? Number(fd.get("cpm_id")) || user.id : user.id;

  const pocId = await withAudit({ userId: user.id, ip: await clientIp() }, async (tx) => {
    const [row] = await tx.query<{ id: number }>(
      `insert into poc (customer_name, cpm_id, status, start_date, end_date, target_closed_date,
                        potential_revenue, scope, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        input.customer_name,
        cpmId,
        input.status,
        input.start_date,
        input.end_date,
        input.target_closed_date,
        input.potential_revenue,
        input.scope,
        input.notes,
        user.id,
      ],
    );
    return row.id;
  });
  revalidatePath("/");
  redirect(`/poc/${pocId}?tab=matrix`);
}

export async function updatePoc(pocId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const poc = await loadEditablePoc(user, pocId);
  const { input, fieldErrors } = readPoc(fd);
  if (!input) return { fieldErrors };

  const cpmId = user.role === "admin" ? Number(fd.get("cpm_id")) || poc.cpm_id : poc.cpm_id;
  const archived = user.role === "admin" ? fd.get("is_archived") === "on" : poc.is_archived;
  const reason = text(fd, "reason");

  // FSD bagian 7: perubahan revenue, target closed, CPM, dan arsip wajib beralasan
  const sensitive =
    input.potential_revenue !== poc.potential_revenue ||
    input.target_closed_date !== poc.target_closed_date ||
    cpmId !== poc.cpm_id ||
    archived !== poc.is_archived;
  if (sensitive && reason.length < MIN_REASON) {
    return {
      fieldErrors: {
        reason: `Anda mengubah potensi revenue, target closed, CPM, atau status arsip. Tulis alasannya (minimal ${MIN_REASON} karakter).`,
      },
    };
  }

  await withAudit({ userId: user.id, ip: await clientIp(), reason: reason || null }, async (tx) => {
    await tx.query(
      `update poc set customer_name = $2, cpm_id = $3, status = $4, start_date = $5, end_date = $6,
              target_closed_date = $7, potential_revenue = $8, scope = $9, notes = $10, is_archived = $11,
              updated_at = now()
        where id = $1`,
      [
        pocId,
        input.customer_name,
        cpmId,
        input.status,
        input.start_date,
        input.end_date,
        input.target_closed_date,
        input.potential_revenue,
        input.scope,
        input.notes,
        archived,
      ],
    );
  });
  revalidatePath("/");
  redirect(`/poc/${pocId}`);
}

export async function setAchievementOverride(pocId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const poc = await loadEditablePoc(user, pocId);
  const value = text(fd, "achievement_override");
  const reason = text(fd, "reason");
  const override = value === "" ? null : (value as Achievement);

  if (override !== null && !ACHIEVEMENTS.includes(override)) return { error: "Pilih achievement." };
  if (override === poc.achievement_override) return { error: "Tidak ada perubahan." };
  if (reason.length < MIN_REASON) {
    return { fieldErrors: { reason: `Tulis alasan override (minimal ${MIN_REASON} karakter).` } };
  }

  await withAudit({ userId: user.id, ip: await clientIp(), reason }, async (tx) => {
    await tx.query(
      "update poc set achievement_override = $2, achievement_override_reason = $3, updated_at = now() where id = $1",
      [pocId, override, override === null ? null : reason],
    );
  });
  revalidatePath(`/poc/${pocId}`);
  redirect(`/poc/${pocId}`);
}

// ---------------------------------------------------------------- Status deal

const DEAL_STATUSES: DealStatus[] = ["awaiting_deal", "won", "lost"];

/** Deal Won/Lost wajib tanggal dan alasan; Awaiting Deal atau kosong cukup dipilih. */
export async function setDealStatus(pocId: number, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const poc = await loadEditablePoc(user, pocId);
  const raw = text(fd, "deal_status");
  const deal = raw === "" ? null : (raw as DealStatus);
  const decided = deal === "won" || deal === "lost";
  const dealDate = decided ? optionalText(fd, "deal_date") : null;
  const reason = text(fd, "reason");

  if (deal !== null && !DEAL_STATUSES.includes(deal)) return { error: "Pilih status deal." };
  const errors: Record<string, string> = {};
  if (decided && (!dealDate || !isDate(dealDate))) errors.deal_date = "Isi tanggal deal diputuskan.";
  if (decided && reason.length < MIN_REASON) {
    errors.reason = `Tulis alasan singkat (minimal ${MIN_REASON} karakter), misal faktor penentu menang atau kalah.`;
  }
  if (Object.keys(errors).length) return { fieldErrors: errors };
  if (deal === poc.deal_status && dealDate === poc.deal_date && (!decided || reason === poc.deal_reason)) {
    return { error: "Tidak ada perubahan." };
  }

  await withAudit({ userId: user.id, ip: await clientIp(), reason: reason || null }, async (tx) => {
    await tx.query(
      "update poc set deal_status = $2, deal_date = $3, deal_reason = $4, updated_at = now() where id = $1",
      [pocId, deal, dealDate, decided ? reason : null],
    );
  });
  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect(`/poc/${pocId}`);
}

// ---------------------------------------------------------------- Matrix

type MatrixInput = {
  name: string;
  description: string | null;
  calc_type: CalcType;
  unit: string | null;
  baseline: number | null;
  target_value: number | null;
  target_operator: Operator | null;
  target_text: string | null;
};

function readMatrix(fd: FormData): { input?: MatrixInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const calc_type = text(fd, "calc_type") as CalcType;
  const name = text(fd, "name");
  if (!name) errors.name = "Isi nama matrix.";
  if (!CALC_TYPES.includes(calc_type)) errors.calc_type = "Pilih tipe matrix.";

  const input: MatrixInput = {
    name,
    description: optionalText(fd, "description"),
    calc_type,
    unit: null,
    baseline: null,
    target_value: null,
    target_operator: null,
    target_text: null,
  };

  if (calc_type === "qualitative") {
    input.target_text = optionalText(fd, "target_text");
    if (!input.target_text) errors.target_text = "Tulis target yang ingin dicapai.";
  } else if (CALC_TYPES.includes(calc_type)) {
    const operator = text(fd, "target_operator") as Operator;
    const target = parseNumber(fd.get("target_value"));
    if (!OPERATORS.includes(operator)) errors.target_operator = "Pilih pembanding target.";
    if (target === null || Number.isNaN(target)) errors.target_value = "Isi target berupa angka, misal 80 atau 12,5.";
    input.target_operator = operator;
    input.target_value = target;
    if (calc_type === "value") input.unit = optionalText(fd, "unit");
    if (calc_type === "reduction") {
      const baseline = parseNumber(fd.get("baseline"));
      if (baseline === null || Number.isNaN(baseline) || baseline === 0) {
        errors.baseline = "Isi nilai baseline (angka selain 0), misal 37 untuk 37 alert/100 km.";
      }
      input.baseline = baseline;
      input.unit = optionalText(fd, "unit");
    }
  }

  if (Object.keys(errors).length) return { fieldErrors: errors };
  return { input };
}

const MATRIX_FIELDS: (keyof MatrixInput)[] = [
  "name",
  "description",
  "calc_type",
  "unit",
  "baseline",
  "target_value",
  "target_operator",
  "target_text",
];

export async function saveMatrix(
  pocId: number,
  matrixId: number | null,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  await loadEditablePoc(user, pocId);
  const { input, fieldErrors } = readMatrix(fd);
  if (!input) return { fieldErrors };

  const updates = await hasWeeklyUpdate(null, pocId);
  const reason = text(fd, "reason");

  // FR-26: sebelum ada update mingguan, matrix masih draft dan boleh diubah tanpa alasan.
  // Setelahnya (FR-24), perubahan wajib alasan >= 20 karakter dan centang konfirmasi.
  if (updates.any) {
    if (reason.length < MIN_MATRIX_REASON) {
      return {
        fieldErrors: {
          reason: `POC ini sudah punya update mingguan, jadi perubahan matrix wajib beralasan (minimal ${MIN_MATRIX_REASON} karakter).`,
        },
      };
    }
    if (fd.get("confirm") !== "on") {
      return { fieldErrors: { confirm: "Centang pernyataan konfirmasi untuk menyimpan." } };
    }
  }

  try {
    await insertMatrixVersion(user.id, pocId, matrixId, input, reason, updates.maxWeek + 1);
  } catch (err) {
    if (err instanceof NoChangeError) return { error: "Tidak ada yang berubah dibanding versi sekarang." };
    throw err;
  }

  revalidatePath(`/poc/${pocId}`);
  redirect(`/poc/${pocId}?tab=matrix`);
}

class NoChangeError extends Error {}

async function insertMatrixVersion(
  userId: number,
  pocId: number,
  matrixId: number | null,
  input: MatrixInput,
  reason: string,
  effectiveFromWeek: number,
) {
  await withAudit({ userId, ip: await clientIp(), reason: reason || null }, async (tx) => {
    let id = matrixId;
    let versionNo = 1;
    if (id === null) {
      const [row] = await tx.query<{ id: number }>(
        `insert into matrix (poc_id, order_no)
         values ($1, (select coalesce(max(order_no), 0) + 1 from matrix where poc_id = $1)) returning id`,
        [pocId],
      );
      id = row.id;
    } else {
      const [current] = await tx.query<MatrixInput & { version_no: number; is_active: boolean }>(
        `select mv.*, m.is_active from matrix_version mv join matrix m on m.id = mv.matrix_id
          where mv.matrix_id = $1 and m.poc_id = $2 order by mv.version_no desc limit 1`,
        [id, pocId],
      );
      if (!current) throw new Error("Matrix tidak ditemukan.");
      if (!current.is_active) throw new Error("Matrix ini sudah dinonaktifkan dan tidak bisa diubah.");
      const changed = MATRIX_FIELDS.some((k) => (current[k] ?? null) !== (input[k] ?? null));
      if (!changed) throw new NoChangeError();
      versionNo = current.version_no + 1;
    }
    await tx.query(
      `insert into matrix_version (matrix_id, version_no, name, description, calc_type, unit, baseline,
                                   target_value, target_operator, target_text, effective_from_week,
                                   change_reason, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        versionNo,
        input.name,
        input.description,
        input.calc_type,
        input.unit,
        input.baseline,
        input.target_value,
        input.target_operator,
        input.target_text,
        effectiveFromWeek,
        reason || null,
        userId,
      ],
    );
  });
}

export async function deactivateMatrix(
  pocId: number,
  matrixId: number,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  await loadEditablePoc(user, pocId);
  const reason = text(fd, "reason");
  if (reason.length < MIN_REASON) {
    return { fieldErrors: { reason: `Tulis alasan menonaktifkan matrix (minimal ${MIN_REASON} karakter).` } };
  }
  await withAudit({ userId: user.id, ip: await clientIp(), reason }, async (tx) => {
    await tx.query(
      "update matrix set is_active = false, deactivated_reason = $3 where id = $1 and poc_id = $2 and is_active",
      [matrixId, pocId, reason],
    );
    await recomputeAchievement(tx, pocId);
  });
  revalidatePath(`/poc/${pocId}`);
  redirect(`/poc/${pocId}?tab=matrix`);
}

// ---------------------------------------------------------------- Update mingguan

type VersionForInput = {
  id: number;
  name: string;
  calc_type: CalcType;
  baseline: number | null;
  target_value: number | null;
  target_operator: Operator | null;
};

function readValues(versions: VersionForInput[], fd: FormData) {
  const errors: Record<string, string> = {};
  const values = versions.map((v) => {
    const key = (field: string) => `${field}_${v.id}`;
    const input = {
      numerator: v.calc_type === "ratio" ? parseNumber(fd.get(key("num"))) : null,
      denominator: v.calc_type === "ratio" ? parseNumber(fd.get(key("den"))) : null,
      actual_value: v.calc_type === "reduction" || v.calc_type === "value" ? parseNumber(fd.get(key("act"))) : null,
      result_text: v.calc_type === "qualitative" ? optionalText(fd, key("res")) : null,
      status: v.calc_type === "qualitative" ? (text(fd, key("st")) as ValueStatus) : null,
    };
    if ([input.numerator, input.denominator, input.actual_value].some((n) => Number.isNaN(n))) {
      errors[key("val")] = "Isi dengan angka, misal 7 atau 34,1.";
      return null;
    }
    if (v.calc_type === "qualitative" && !VALUE_STATUSES.includes(input.status as ValueStatus)) {
      errors[key("val")] = "Pilih status Met, Partial, atau Not met.";
      return null;
    }
    const computed = computeScore(v, input);
    if (!computed) {
      errors[key("val")] =
        v.calc_type === "ratio"
          ? "Isi pembilang dan penyebut (penyebut tidak boleh 0)."
          : "Isi nilai aktual minggu ini.";
      return null;
    }
    return { versionId: v.id, ...input, ...computed };
  });
  return { values, errors };
}

export async function saveWeeklyUpdate(
  pocId: number,
  updateId: number | null,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  await loadEditablePoc(user, pocId);

  const periodStart = text(fd, "period_start");
  const periodEnd = text(fd, "period_end");
  const reason = text(fd, "reason");
  const errors: Record<string, string> = {};
  if (!isDate(periodStart)) errors.period_start = "Isi tanggal mulai periode.";
  if (!isDate(periodEnd)) errors.period_end = "Isi tanggal selesai periode.";
  if (isDate(periodStart) && isDate(periodEnd) && periodEnd < periodStart) {
    errors.period_end = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  }
  if (updateId !== null && reason.length < MIN_REASON) {
    errors.reason = `Koreksi update wajib beralasan (minimal ${MIN_REASON} karakter), misal angka minggu lalu salah input.`;
  }

  // Update baru memakai versi terbaru tiap matrix aktif; koreksi tetap memakai versi yang tercatat saat submit
  const versions =
    updateId === null
      ? await query<VersionForInput>(
          `select distinct on (mv.matrix_id) mv.id, mv.name, mv.calc_type, mv.baseline, mv.target_value, mv.target_operator
             from matrix_version mv join matrix m on m.id = mv.matrix_id
            where m.poc_id = $1 and m.is_active order by mv.matrix_id, mv.version_no desc`,
          [pocId],
        )
      : await query<VersionForInput>(
          `select mv.id, mv.name, mv.calc_type, mv.baseline, mv.target_value, mv.target_operator
             from weekly_value wv join matrix_version mv on mv.id = wv.matrix_version_id
             join weekly_update w on w.id = wv.weekly_update_id
            where wv.weekly_update_id = $1 and w.poc_id = $2`,
          [updateId, pocId],
        );
  if (versions.length === 0) {
    return { error: "POC ini belum punya matrix aktif. Tambahkan matrix dulu sebelum membuat update." };
  }

  const read = readValues(versions, fd);
  Object.assign(errors, read.errors);
  if (Object.keys(errors).length) return { fieldErrors: errors };

  const [overlap] = await query<{ week_no: number }>(
    `select week_no from weekly_update
      where poc_id = $1 and id <> coalesce($2, 0)
        and daterange(period_start, period_end, '[]') && daterange($3::date, $4::date, '[]')
      limit 1`,
    [pocId, updateId, periodStart, periodEnd],
  );
  if (overlap) {
    return { fieldErrors: { period_start: `Periode ini tumpang tindih dengan update minggu ke-${overlap.week_no}.` } };
  }

  await withAudit({ userId: user.id, ip: await clientIp(), reason: reason || null }, async (tx) => {
    const notes = [optionalText(fd, "progress"), optionalText(fd, "issues"), optionalText(fd, "next_action")];
    let id = updateId;
    if (id === null) {
      const [row] = await tx.query<{ id: number }>(
        `insert into weekly_update (poc_id, week_no, period_start, period_end, progress, issues, next_action, submitted_by)
         values ($1, (select coalesce(max(week_no), 0) + 1 from weekly_update where poc_id = $1), $2, $3, $4, $5, $6, $7)
         returning id`,
        [pocId, periodStart, periodEnd, ...notes, user.id],
      );
      id = row.id;
    } else {
      await tx.query(
        `update weekly_update set period_start = $3, period_end = $4, progress = $5, issues = $6, next_action = $7,
                updated_at = now()
          where id = $1 and poc_id = $2`,
        [id, pocId, periodStart, periodEnd, ...notes],
      );
    }
    for (const v of read.values) {
      if (!v) continue;
      await tx.query(
        `insert into weekly_value (weekly_update_id, matrix_version_id, numerator, denominator, actual_value,
                                   result_text, status, score)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (weekly_update_id, matrix_version_id) do update
            set numerator = excluded.numerator, denominator = excluded.denominator,
                actual_value = excluded.actual_value, result_text = excluded.result_text,
                status = excluded.status, score = excluded.score
          where (weekly_value.numerator, weekly_value.denominator, weekly_value.actual_value,
                 weekly_value.result_text, weekly_value.status, weekly_value.score)
                is distinct from
                (excluded.numerator, excluded.denominator, excluded.actual_value,
                 excluded.result_text, excluded.status, excluded.score)`,
        [id, v.versionId, v.numerator, v.denominator, v.actual_value, v.result_text, v.status, v.score],
      );
    }
    await recomputeAchievement(tx, pocId);
  });

  revalidatePath("/");
  revalidatePath(`/poc/${pocId}`);
  redirect(`/poc/${pocId}?tab=update`);
}

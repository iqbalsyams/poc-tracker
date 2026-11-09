import type { Achievement, CalcType, Operator, ValueStatus } from "@/lib/calc";
import { query } from "@/lib/db";
import type { DealStatus, PocStatus } from "@/lib/format";

export type PocRow = {
  id: number;
  customer_name: string;
  cpm_id: number;
  cpm_name: string;
  status: PocStatus;
  start_date: string | null;
  end_date: string | null;
  target_closed_date: string | null;
  potential_revenue: number;
  scope: string | null;
  notes: string | null;
  achievement: Achievement;
  achievement_override: Achievement | null;
  achievement_override_reason: string | null;
  is_archived: boolean;
  deal_status: DealStatus | null;
  deal_date: string | null;
  deal_reason: string | null;
  created_at: Date;
};

export type PocListRow = PocRow & {
  matrix_count: number;
  last_week_no: number | null;
  last_period_end: string | null;
  last_submitted_at: Date | null;
  target_changed: boolean;
  stale: boolean;
};

export type PocFilters = {
  q?: string;
  cpm?: number;
  status?: PocStatus;
  achievement?: Achievement;
  deal?: DealStatus | "none";
  archived?: boolean;
};

/** Filter daftar POC dari query string; dipakai halaman daftar dan export Excel supaya isinya sama. */
export function parsePocFilters(get: (key: string) => string | undefined): PocFilters {
  return {
    q: (get("q") ?? "").trim() || undefined,
    cpm: Number(get("cpm")) || undefined,
    status: (get("status") || undefined) as PocStatus | undefined,
    achievement: (get("achievement") || undefined) as Achievement | undefined,
    deal: (get("deal") || undefined) as DealStatus | "none" | undefined,
    archived: get("arsip") === "1",
  };
}

const POC_COLUMNS = `p.id, p.customer_name, p.cpm_id, u.name as cpm_name, p.status, p.start_date, p.end_date,
  p.target_closed_date, p.potential_revenue, p.scope, p.notes, p.achievement, p.achievement_override,
  p.achievement_override_reason, p.is_archived, p.deal_status, p.deal_date, p.deal_reason, p.created_at`;

export async function listPocs(f: PocFilters): Promise<PocListRow[]> {
  const where: string[] = ["p.is_archived = $1"];
  const params: unknown[] = [f.archived ?? false];
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`p.customer_name ilike $${params.length}`);
  }
  if (f.cpm) {
    params.push(f.cpm);
    where.push(`p.cpm_id = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    where.push(`p.status = $${params.length}`);
  }
  if (f.achievement) {
    params.push(f.achievement);
    where.push(`coalesce(p.achievement_override, p.achievement) = $${params.length}`);
  }
  if (f.deal === "none") {
    where.push("p.deal_status is null");
  } else if (f.deal) {
    params.push(f.deal);
    where.push(`p.deal_status = $${params.length}`);
  }
  // stale = Running dan update terakhir lebih dari 7 hari lalu atau belum pernah ada (FR-13)
  return query<PocListRow>(
    `select ${POC_COLUMNS},
            (select count(*) from matrix m where m.poc_id = p.id and m.is_active) as matrix_count,
            lw.week_no as last_week_no, lw.period_end as last_period_end, lw.submitted_at as last_submitted_at,
            exists (
              select 1 from matrix_version mv join matrix m on m.id = mv.matrix_id
               where m.poc_id = p.id and mv.version_no > 1
                 and mv.created_at > (select min(w.submitted_at) from weekly_update w where w.poc_id = p.id)
            ) as target_changed,
            (p.status = 'running' and (lw.submitted_at is null or lw.submitted_at < now() - interval '7 days')) as stale
       from poc p
       join users u on u.id = p.cpm_id
       left join lateral (
         select w.week_no, w.period_end, w.submitted_at from weekly_update w
          where w.poc_id = p.id order by w.week_no desc limit 1
       ) lw on true
      where ${where.join(" and ")}
      order by case p.status when 'running' then 0 when 'on_hold' then 1 when 'upcoming' then 2
                             when 'done' then 3 else 4 end,
               p.target_closed_date nulls last, p.customer_name`,
    params,
  );
}

export async function getPoc(id: number): Promise<PocRow | null> {
  const rows = await query<PocRow>(
    `select ${POC_COLUMNS} from poc p join users u on u.id = p.cpm_id where p.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export type MatrixVersion = {
  id: number;
  matrix_id: number;
  version_no: number;
  name: string;
  description: string | null;
  calc_type: CalcType;
  unit: string | null;
  baseline: number | null;
  target_value: number | null;
  target_operator: Operator | null;
  target_text: string | null;
  effective_from_week: number;
  change_reason: string | null;
  created_by_name: string;
  created_at: Date;
};

export type MatrixWithVersions = {
  id: number;
  order_no: number;
  is_active: boolean;
  deactivated_reason: string | null;
  current: MatrixVersion;
  versions: MatrixVersion[];
};

export async function getMatrices(pocId: number): Promise<MatrixWithVersions[]> {
  const matrices = await query<{ id: number; order_no: number; is_active: boolean; deactivated_reason: string | null }>(
    "select id, order_no, is_active, deactivated_reason from matrix where poc_id = $1 order by is_active desc, order_no",
    [pocId],
  );
  const versions = await query<MatrixVersion>(
    `select mv.*, u.name as created_by_name
       from matrix_version mv join matrix m on m.id = mv.matrix_id join users u on u.id = mv.created_by
      where m.poc_id = $1 order by mv.matrix_id, mv.version_no desc`,
    [pocId],
  );
  return matrices.map((m) => {
    const own = versions.filter((v) => v.matrix_id === m.id);
    return { ...m, current: own[0], versions: own };
  });
}

export type WeeklyValueRow = {
  weekly_update_id: number;
  matrix_id: number;
  matrix_version_id: number;
  version_no: number;
  numerator: number | null;
  denominator: number | null;
  actual_value: number | null;
  result_text: string | null;
  status: ValueStatus;
  score: number | null;
};

export type WeeklyUpdateRow = {
  id: number;
  week_no: number;
  period_start: string;
  period_end: string;
  progress: string | null;
  issues: string | null;
  next_action: string | null;
  submitted_by_name: string;
  submitted_at: Date;
  updated_at: Date | null;
  values: WeeklyValueRow[];
};

export async function getWeeklyUpdates(pocId: number): Promise<WeeklyUpdateRow[]> {
  const updates = await query<Omit<WeeklyUpdateRow, "values">>(
    `select w.id, w.week_no, w.period_start, w.period_end, w.progress, w.issues, w.next_action,
            u.name as submitted_by_name, w.submitted_at, w.updated_at
       from weekly_update w join users u on u.id = w.submitted_by
      where w.poc_id = $1 order by w.week_no desc`,
    [pocId],
  );
  const values = await query<WeeklyValueRow>(
    `select wv.weekly_update_id, mv.matrix_id, wv.matrix_version_id, mv.version_no, wv.numerator, wv.denominator,
            wv.actual_value, wv.result_text, wv.status, wv.score
       from weekly_value wv
       join weekly_update w on w.id = wv.weekly_update_id
       join matrix_version mv on mv.id = wv.matrix_version_id
       join matrix m on m.id = mv.matrix_id
      where w.poc_id = $1
      order by m.order_no`,
    [pocId],
  );
  return updates.map((u) => ({ ...u, values: values.filter((v) => v.weekly_update_id === u.id) }));
}

export type AuditRow = {
  id: number;
  occurred_at: Date;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
};

export async function getPocHistory(pocId: number): Promise<AuditRow[]> {
  return query<AuditRow>(
    `select a.id, a.occurred_at, u.name as user_name, a.action, a.entity_type, a.entity_id, a.before, a.after, a.reason
       from audit_log a left join users u on u.id = a.user_id
      where a.poc_id = $1 order by a.occurred_at desc, a.id desc limit 300`,
    [pocId],
  );
}

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "cpm";
  is_active: boolean;
  must_change_password: boolean;
  locked: boolean;
};

export async function listUsers(): Promise<UserRow[]> {
  return query<UserRow>(
    `select id, email, name, role, is_active, must_change_password, coalesce(locked_until > now(), false) as locked
       from users order by is_active desc, name`,
  );
}

export async function listActiveCpms(): Promise<{ id: number; name: string }[]> {
  return query("select id, name from users where is_active order by name");
}

export async function userNames(): Promise<Map<number, string>> {
  const rows = await query<{ id: number; name: string }>("select id, name from users");
  return new Map(rows.map((r) => [r.id, r.name]));
}

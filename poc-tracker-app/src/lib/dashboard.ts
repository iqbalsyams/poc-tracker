import type { Achievement } from "@/lib/calc";
import { query } from "@/lib/db";
import type { DealStatus, PocStatus } from "@/lib/format";

// Semua angka dashboard dari POC yang tidak diarsipkan. Achievement = override jika ada, selain itu hitungan otomatis.
const BASE = "from poc p where not p.is_archived";
const EFFECTIVE = "coalesce(p.achievement_override, p.achievement)";

export type StatusCount = { status: PocStatus; n: number; revenue: number };

export async function statusCounts(): Promise<StatusCount[]> {
  return query(`select p.status, count(*)::int as n, coalesce(sum(p.potential_revenue), 0) as revenue ${BASE} group by p.status`);
}

export type CrossCell = { achievement: Achievement; deal: DealStatus | null; n: number };

/** Achievement × status deal untuk POC yang sudah Done: "apakah POC yang sukses berujung deal?" */
export async function doneCrossTab(): Promise<CrossCell[]> {
  return query(
    `select ${EFFECTIVE} as achievement, p.deal_status as deal, count(*)::int as n
       ${BASE} and p.status = 'done'
      group by 1, 2`,
  );
}

export type PipelineRow = { bucket: "won" | "awaiting_deal" | "undecided" | "lost" | "in_progress"; n: number; revenue: number };

export async function revenuePipeline(): Promise<PipelineRow[]> {
  return query(
    `select case
              when p.deal_status = 'won' then 'won'
              when p.deal_status = 'lost' then 'lost'
              when p.deal_status = 'awaiting_deal' then 'awaiting_deal'
              when p.status = 'done' then 'undecided'
              when p.status in ('running', 'upcoming', 'on_hold') then 'in_progress'
            end as bucket,
            count(*)::int as n, coalesce(sum(p.potential_revenue), 0) as revenue
       ${BASE} and (p.deal_status is not null or p.status <> 'cancelled')
      group by 1`,
  );
}

export type AttentionRow = {
  id: number;
  customer_name: string;
  cpm_name: string;
  reason: "stale" | "overdue" | "no_deal" | "target_changed";
  detail: string | null;
};

/** POC yang butuh tindakan, diurutkan dari yang paling mendesak. */
export async function attentionList(): Promise<AttentionRow[]> {
  return query(
    `with last_update as (
       select poc_id, max(submitted_at) as at from weekly_update group by poc_id
     ), changed as (
       select m.poc_id, max(mv.created_at) as at
         from matrix_version mv join matrix m on m.id = mv.matrix_id
        where mv.version_no > 1
          and mv.created_at > (select min(w.submitted_at) from weekly_update w where w.poc_id = m.poc_id)
          and mv.created_at > now() - interval '30 days'
        group by m.poc_id
     )
     select p.id, p.customer_name, u.name as cpm_name, x.reason, x.detail
       from poc p
       join users u on u.id = p.cpm_id
       left join last_update lu on lu.poc_id = p.id
       left join changed c on c.poc_id = p.id
       cross join lateral (values
         ('overdue', case when p.status in ('running', 'upcoming', 'on_hold') and p.target_closed_date < (now() at time zone 'Asia/Jakarta')::date
                          then to_char(p.target_closed_date, 'YYYY-MM-DD') end),
         ('stale', case when p.status = 'running' and (lu.at is null or lu.at < now() - interval '7 days')
                        then coalesce(to_char(lu.at at time zone 'Asia/Jakarta', 'YYYY-MM-DD'), '') end),
         ('no_deal', case when p.status = 'done' and p.deal_status is null then '' end),
         ('target_changed', case when c.at is not null then to_char(c.at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') end)
       ) as x(reason, detail)
      where not p.is_archived and x.detail is not null
      order by array_position(array['overdue', 'stale', 'no_deal', 'target_changed'], x.reason), p.customer_name`,
  );
}

export type CpmRow = {
  id: number;
  name: string;
  running: number;
  waiting: number;
  done: number;
  won: number;
  lost: number;
  awaiting: number;
  active_revenue: number;
};

export async function perCpm(): Promise<CpmRow[]> {
  return query(
    `select u.id, u.name,
            count(*) filter (where p.status = 'running')::int as running,
            count(*) filter (where p.status in ('upcoming', 'on_hold'))::int as waiting,
            count(*) filter (where p.status = 'done')::int as done,
            count(*) filter (where p.deal_status = 'won')::int as won,
            count(*) filter (where p.deal_status = 'lost')::int as lost,
            count(*) filter (where p.deal_status = 'awaiting_deal')::int as awaiting,
            coalesce(sum(p.potential_revenue) filter (where p.status in ('running', 'upcoming', 'on_hold')), 0) as active_revenue
       from users u join poc p on p.cpm_id = u.id and not p.is_archived
      group by u.id, u.name
      order by running desc, u.name`,
  );
}

-- Skema inti POC Tracker. Lihat FSD bagian 6.

create table users (
  id serial primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'cpm')),
  password_hash text not null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- id = sha256 dari token cookie, token mentah tidak pernah disimpan
create table sessions (
  id text primary key,
  user_id int not null references users (id),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on sessions (user_id);

create table poc (
  id serial primary key,
  customer_name text not null,
  cpm_id int not null references users (id),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'running', 'done', 'cancelled')),
  start_date date,
  end_date date,
  target_closed_date date not null,
  potential_revenue numeric(18, 0) not null default 0,
  scope text,
  notes text,
  -- achievement = hasil hitung otomatis; override diisi CPM dengan alasan
  achievement text not null default 'wip'
    check (achievement in ('wip', 'achieved', 'partial', 'not_achieved')),
  achievement_override text
    check (achievement_override in ('wip', 'achieved', 'partial', 'not_achieved')),
  achievement_override_reason text,
  is_archived boolean not null default false,
  created_by int not null references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table matrix (
  id serial primary key,
  poc_id int not null references poc (id),
  order_no int not null,
  is_active boolean not null default true,
  deactivated_reason text,
  created_at timestamptz not null default now()
);
create index matrix_poc_idx on matrix (poc_id);

-- Append-only: setiap perubahan matrix = baris baru (lihat 002_audit.sql)
create table matrix_version (
  id serial primary key,
  matrix_id int not null references matrix (id),
  version_no int not null,
  name text not null,
  description text,
  calc_type text not null check (calc_type in ('ratio', 'reduction', 'value', 'qualitative')),
  unit text,
  baseline numeric,
  target_value numeric,
  target_operator text check (target_operator in ('>=', '<=', '>', '<')),
  target_text text,
  effective_from_week int not null default 1,
  change_reason text,
  created_by int not null references users (id),
  created_at timestamptz not null default now(),
  unique (matrix_id, version_no),
  check (
    (calc_type = 'qualitative' and target_text is not null)
    or (calc_type <> 'qualitative' and target_value is not null and target_operator is not null)
  ),
  check (calc_type <> 'reduction' or (baseline is not null and baseline <> 0))
);

create table weekly_update (
  id serial primary key,
  poc_id int not null references poc (id),
  week_no int not null,
  period_start date not null,
  period_end date not null,
  progress text,
  issues text,
  next_action text,
  submitted_by int not null references users (id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (poc_id, week_no),
  check (period_end >= period_start)
);

create table weekly_value (
  id serial primary key,
  weekly_update_id int not null references weekly_update (id),
  matrix_version_id int not null references matrix_version (id),
  numerator numeric,
  denominator numeric,
  actual_value numeric,
  result_text text,
  status text not null check (status in ('met', 'partial', 'not_met')),
  score numeric,
  unique (weekly_update_id, matrix_version_id)
);

create table audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  user_id int references users (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  poc_id int,
  before jsonb,
  after jsonb,
  reason text,
  ip_address text
);
create index audit_log_poc_idx on audit_log (poc_id, occurred_at desc);
create index audit_log_time_idx on audit_log (occurred_at desc);

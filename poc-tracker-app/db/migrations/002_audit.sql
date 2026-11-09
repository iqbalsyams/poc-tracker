-- Audit trail di level database (FSD bagian 7).
-- Aplikasi mengisi konteks lewat set_config('app.user_id' / 'app.reason' / 'app.ip', ..., true)
-- di awal transaksi; trigger membaca konteks itu untuk setiap baris yang berubah.

create function audit_row() returns trigger
language plpgsql as $$
declare
  b jsonb;
  a jsonb;
  row_data jsonb;
  v_poc int;
begin
  if tg_op <> 'INSERT' then b := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new); end if;

  if tg_table_name = 'users' then
    b := b - 'password_hash' - 'failed_logins' - 'locked_until';
    a := a - 'password_hash' - 'failed_logins' - 'locked_until';
  end if;

  -- perubahan yang tidak terlihat setelah field rahasia dibuang tidak perlu dicatat
  if tg_op = 'UPDATE' and b = a then
    return new;
  end if;

  row_data := coalesce(a, b);
  v_poc := case tg_table_name
    when 'poc' then (row_data ->> 'id')::int
    when 'matrix' then (row_data ->> 'poc_id')::int
    when 'weekly_update' then (row_data ->> 'poc_id')::int
    when 'matrix_version' then
      (select m.poc_id from matrix m where m.id = (row_data ->> 'matrix_id')::int)
    when 'weekly_value' then
      (select w.poc_id from weekly_update w where w.id = (row_data ->> 'weekly_update_id')::int)
  end;

  insert into audit_log (user_id, action, entity_type, entity_id, poc_id, before, after, reason, ip_address)
  values (
    nullif(current_setting('app.user_id', true), '')::int,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    row_data ->> 'id',
    v_poc,
    b,
    a,
    nullif(current_setting('app.reason', true), ''),
    nullif(current_setting('app.ip', true), '')
  );
  return coalesce(new, old);
end
$$;

create trigger audit after insert or update or delete on users
  for each row execute function audit_row();
create trigger audit after insert or update or delete on poc
  for each row execute function audit_row();
create trigger audit after insert or update or delete on matrix
  for each row execute function audit_row();
create trigger audit after insert or update or delete on matrix_version
  for each row execute function audit_row();
create trigger audit after insert or update or delete on weekly_update
  for each row execute function audit_row();
create trigger audit after insert or update or delete on weekly_value
  for each row execute function audit_row();

-- Lapisan kedua di atas GRANT: menolak UPDATE/DELETE/TRUNCATE bahkan dari owner
create function forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'tabel % bersifat append-only: % tidak diizinkan', tg_table_name, tg_op;
end
$$;

create trigger append_only before update or delete on audit_log
  for each row execute function forbid_change();
create trigger append_only_truncate before truncate on audit_log
  for each statement execute function forbid_change();
create trigger append_only before update or delete on matrix_version
  for each row execute function forbid_change();
create trigger append_only_truncate before truncate on matrix_version
  for each statement execute function forbid_change();

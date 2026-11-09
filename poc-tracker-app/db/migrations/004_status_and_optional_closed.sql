-- Migrasi data Excel "POC Summary": status Awaiting Deal & On Hold, dan Target Closed boleh kosong.

alter table poc drop constraint poc_status_check;
alter table poc add constraint poc_status_check
  check (status in ('upcoming', 'running', 'awaiting_deal', 'on_hold', 'done', 'cancelled'));

alter table poc alter column target_closed_date drop not null;

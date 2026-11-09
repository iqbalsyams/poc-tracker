-- Status deal dipisah dari status POC: status POC = progres POC, status deal = hasil komersial.

select set_config('app.reason', 'Migrasi 005: status Awaiting Deal dipindah dari status POC ke status deal', true);

alter table poc
  add column deal_status text check (deal_status in ('awaiting_deal', 'won', 'lost')),
  add column deal_date date,
  add column deal_reason text;

-- POC yang tadinya berstatus "Awaiting Deal" sudah selesai diuji; yang ditunggu tinggal keputusan komersial
update poc set status = 'done', deal_status = 'awaiting_deal' where status = 'awaiting_deal';

alter table poc drop constraint poc_status_check;
alter table poc add constraint poc_status_check
  check (status in ('upcoming', 'running', 'on_hold', 'done', 'cancelled'));

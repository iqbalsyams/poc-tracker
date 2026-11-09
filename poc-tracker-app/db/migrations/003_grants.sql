-- Role aplikasi (poc_app) dibuat oleh scripts/lib/migrate.mjs sebelum file ini dijalankan.
-- Tidak ada DELETE kecuali untuk sessions (logout); audit_log dan matrix_version hanya INSERT.

grant usage on schema public to poc_app;
grant select, insert, update on users, poc, matrix, weekly_update, weekly_value to poc_app;
grant select, insert, update, delete on sessions to poc_app;
grant select, insert on matrix_version, audit_log to poc_app;
grant usage on all sequences in schema public to poc_app;

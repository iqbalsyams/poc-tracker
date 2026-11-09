# POC Tracker

Aplikasi internal McEasy untuk menggantikan sheet "POC Monitoring" di Excel: daftar POC, matrix berversi,
update mingguan, dan audit trail yang tidak bisa diubah. Spesifikasi lengkap ada di
`../FSD-POC-Monitoring-Web-App.md`.

Stack: Next.js 16 + PostgreSQL (SQL langsung lewat `pg`), tampilan mengikuti McEasy Design System
(`../design/mceasy-design-system`).

## Menjalankan di laptop

Butuh Node.js 20.9 atau lebih baru. Tidak perlu Docker atau PostgreSQL terpasang.

```bash
npm install
npm run dev
```

`npm run dev` menjalankan PostgreSQL lokal (data di `.pgdata/`), menerapkan migrasi, lalu membuka
aplikasi di http://localhost:3000.

Saat pertama kali dijalankan, terminal menampilkan tabel email dan **password sementara** untuk 5 akun awal.
Password itu hanya tampil sekali dan wajib diganti saat login pertama. Kalau terlewat, hentikan server,
hapus folder `.pgdata/`, lalu jalankan `npm run dev` lagi (semua data lokal ikut terhapus).

Selama masih berjalan di laptop, hanya Anda yang bisa membuka aplikasi ini. CPM lain baru bisa login
setelah aplikasi di-deploy oleh DevOps.

## Impor data dari Excel

Data sheet "POC Summary" (Update Project CPM.xlsx) sudah diterjemahkan ke
`db/import/poc-summary-2026-11-09.json`: teks matrix asli disimpan utuh, ditambah tipe, target,
dan catatan `review` untuk konversi yang perlu dicek CPM. File ini berisi nama customer dan revenue,
jadi **tidak disimpan di repo**; minta ke Iqbal Syams saat perlu impor ulang di server.
Impor ke database (butuh Node 23.6+):

```bash
node --env-file=.env.local scripts/import-excel.mjs db/import/poc-summary-2026-11-09.json iqbal.syams@mceasy.co.id
```

POC yang nama customer-nya sudah ada dilewati, jadi aman dijalankan ulang. Semua baris tercatat di audit
trail atas nama admin tersebut dengan alasan "Migrasi dari Excel ..., baris N".

## Uji otomatis

```bash
npx tsc --noEmit        # typecheck
npx eslint src scripts  # lint
```

`scripts/e2e-smoke.mjs` menjalankan skenario lengkap di browser Edge (login, POC, matrix + konfirmasi,
update mingguan, koreksi, riwayat, pengguna, tampilan HP 390px, mode gelap). Skrip ini **mengubah data**,
jadi jalankan hanya pada database lokal yang boleh dihapus.

## Untuk DevOps

Image dibuat dari `Dockerfile` (Next.js standalone, Node 22). Kebutuhan:

| Env | Isi |
| --- | --- |
| `DATABASE_URL` | koneksi role aplikasi `poc_app` (dipakai aplikasi saat berjalan) |
| `MIGRATION_DATABASE_URL` | koneksi role owner database (hanya untuk migrasi) |
| `APP_DB_PASSWORD` | password untuk role `poc_app`; migrasi membuat/memperbarui role ini |
| `COOKIE_SECURE` | isi `false` hanya jika aplikasi belum diakses lewat HTTPS |

Urutan deploy:

```bash
docker build -t poc-tracker .
docker run --rm -e MIGRATION_DATABASE_URL=... -e APP_DB_PASSWORD=... poc-tracker node scripts/migrate.mjs migrate
docker run --rm -e DATABASE_URL=... poc-tracker node scripts/migrate.mjs seed   # sekali, membuat akun awal
docker run -d -p 3000:3000 -e DATABASE_URL=... poc-tracker
```

Catatan penting:

- Role `poc_app` sengaja tidak punya hak UPDATE/DELETE pada `audit_log` dan `matrix_version`. Jangan
  jalankan aplikasi memakai role owner, karena perlindungan audit trail bergantung pada pemisahan ini.
- Trigger di database juga menolak UPDATE/DELETE/TRUNCATE pada kedua tabel itu, termasuk dari owner.
- Backup harian PostgreSQL disarankan dengan retensi minimal 30 hari.

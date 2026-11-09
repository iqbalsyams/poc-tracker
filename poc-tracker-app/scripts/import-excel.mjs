// Impor POC dari file JSON hasil terjemahan sheet Excel "POC Summary" (lihat db/import/).
//
//   node --env-file=.env.local scripts/import-excel.mjs <file.json> <email-admin-pelaku>
//
// Semua baris tercatat di audit trail atas nama admin pelaku dengan alasan "Migrasi dari Excel".
// POC yang nama customer-nya sudah ada dilewati, jadi aman dijalankan ulang.
// Butuh Node 23.6+ (import langsung file .ts untuk rumus yang sama dengan aplikasi).

import { readFile } from "node:fs/promises";
import pg from "pg";
import { computeAchievement, computeScore } from "../src/lib/calc.ts";

const [file, actorEmail] = process.argv.slice(2);
if (!file || !actorEmail) {
  console.error("Pemakaian: node --env-file=.env.local scripts/import-excel.mjs <file.json> <email-admin>");
  process.exit(1);
}

const data = JSON.parse(await readFile(file, "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Periode update hasil migrasi. Excel tidak mencatat tanggal, kecuali GTL & TAP yang menyebut nomor minggu. */
function migrationPeriod(p) {
  if (p.week_no && p.start_date) {
    const start = addDays(p.start_date, (p.week_no - 1) * 7);
    return { week: p.week_no, start, end: addDays(start, 6) };
  }
  const end = p.status === "done" && p.target_closed_date ? p.target_closed_date : data.migrated_on;
  const start = p.start_date && p.start_date <= end ? p.start_date : end;
  return { week: 1, start, end };
}

const report = [];
try {
  const { rows: actors } = await client.query("select id from users where email = $1 and role = 'admin'", [actorEmail]);
  if (!actors[0]) throw new Error(`Admin ${actorEmail} tidak ditemukan`);
  const actorId = actors[0].id;

  const { rows: users } = await client.query("select id, email from users");
  const userByEmail = new Map(users.map((u) => [u.email, u.id]));

  for (const p of data.pocs) {
    const { rowCount: exists } = await client.query("select 1 from poc where customer_name = $1", [p.customer_name]);
    if (exists) {
      report.push({ baris: p.row, customer: p.customer_name, hasil: "dilewati, sudah ada" });
      continue;
    }
    const cpmId = userByEmail.get(data.cpm_email[p.cpm]);
    if (!cpmId) throw new Error(`CPM "${p.cpm}" (baris ${p.row}) tidak punya akun`);

    await client.query("begin");
    try {
      await client.query(
        "select set_config('app.user_id', $1, true), set_config('app.reason', $2, true), set_config('app.ip', 'script-migrasi', true)",
        [String(actorId), `Migrasi dari Excel: ${data.source}, baris ${p.row}`],
      );
      const { rows: [poc] } = await client.query(
        `insert into poc (customer_name, cpm_id, status, deal_status, start_date, target_closed_date, potential_revenue,
                          notes, created_by)
         values ($1, $2, $3, $9, $4, $5, $6, $7, $8) returning id`,
        [
          p.customer_name,
          cpmId,
          p.status,
          p.start_date,
          p.target_closed_date,
          p.potential_revenue,
          p.status === "running" && p.excel_status !== "Running" ? `Status di Excel: ${p.excel_status}` : null,
          actorId,
          p.deal_status ?? null,
        ],
      );

      const values = [];
      for (const [i, m] of p.matrices.entries()) {
        const { rows: [matrix] } = await client.query(
          "insert into matrix (poc_id, order_no) values ($1, $2) returning id",
          [poc.id, i + 1],
        );
        const { rows: [version] } = await client.query(
          `insert into matrix_version (matrix_id, version_no, name, description, calc_type, unit, baseline,
                                       target_value, target_operator, target_text, created_by)
           values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [
            matrix.id,
            m.name,
            m.description.trim(),
            m.calc_type,
            m.unit ?? null,
            m.baseline ?? null,
            m.target_value ?? null,
            m.target_operator ?? null,
            m.target_text ?? null,
            actorId,
          ],
        );
        if (m.value) {
          const computed = computeScore(
            { calc_type: m.calc_type, baseline: m.baseline ?? null, target_value: m.target_value ?? null, target_operator: m.target_operator ?? null },
            m.value,
          );
          if (!computed) throw new Error(`Nilai matrix "${m.name}" (baris ${p.row}) tidak bisa dihitung`);
          values.push({ versionId: version.id, input: m.value, ...computed, excel: m.excel_score });
        }
      }

      let summary = "tanpa score";
      if (values.length > 0) {
        const period = migrationPeriod(p);
        const original = values.map((v, i) => `Matrix ${i + 1}: ${String(v.excel).replace(/\s+/g, " ")}`).join("; ");
        const { rows: [update] } = await client.query(
          `insert into weekly_update (poc_id, week_no, period_start, period_end, progress, submitted_by)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [
            poc.id,
            period.week,
            period.start,
            period.end,
            `Hasil migrasi dari Excel (${data.source}). Tanggal periode tidak tercatat di Excel. Score asli: ${original}`,
            actorId,
          ],
        );
        for (const v of values) {
          await client.query(
            `insert into weekly_value (weekly_update_id, matrix_version_id, numerator, denominator, actual_value,
                                       result_text, status, score)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [update.id, v.versionId, v.input.numerator ?? null, v.input.denominator ?? null,
             v.input.actual_value ?? null, v.input.result_text ?? null, v.status, v.score],
          );
        }
        summary = values.map((v) => `${v.score ?? "-"} ${v.status}`).join(", ");
      }

      const auto = computeAchievement(values.map((v) => v.status));
      await client.query("update poc set achievement = $2 where id = $1 and achievement <> $2", [poc.id, auto]);
      let override = "";
      if (p.excel_achievement && p.excel_achievement !== auto) {
        await client.query(
          "update poc set achievement_override = $2, achievement_override_reason = $3 where id = $1",
          [poc.id, p.excel_achievement, "Mengikuti achievement di Excel saat migrasi; hasil hitung otomatis berbeda"],
        );
        override = ` | override ke ${p.excel_achievement}`;
      }

      await client.query("commit");
      report.push({ baris: p.row, customer: p.customer_name, hasil: `diimpor | score: ${summary} | otomatis: ${auto}${override}` });
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
} finally {
  await client.end();
}

console.table(report);

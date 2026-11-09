import ExcelJS from "exceljs";
import { clientIp, getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ACHIEVEMENT_LABEL,
  CALC_TYPE_LABEL,
  DEAL_STATUS_LABEL,
  POC_STATUS_LABEL,
  VALUE_STATUS_LABEL,
  formatTarget,
  todayWib,
} from "@/lib/format";
import { listPocs, parsePocFilters, type MatrixVersion } from "@/lib/queries";
import type { ValueStatus } from "@/lib/calc";

// Tanggal 'YYYY-MM-DD' -> Date UTC tengah malam, supaya Excel menampilkan tanggal yang sama
const asDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

type LatestValue = MatrixVersion & {
  poc_id: number;
  is_active: boolean;
  week_no: number | null;
  period_end: string | null;
  numerator: number | null;
  denominator: number | null;
  actual_value: number | null;
  result_text: string | null;
  status: ValueStatus | null;
  score: number | null;
};

/** Export daftar POC (mengikuti filter yang sedang aktif) ke .xlsx dengan dua sheet. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.must_change_password) return new Response("Silakan login.", { status: 401 });

  const params = new URL(request.url).searchParams;
  const filters = parsePocFilters((key) => params.get(key) ?? undefined);
  const pocs = await listPocs(filters);
  const ids = pocs.map((p) => p.id);

  // Versi terbaru tiap matrix + nilai di update terakhir POC-nya (kalau versi itu dipakai di sana)
  const matrices = ids.length
    ? await query<LatestValue>(
        `select distinct on (mv.matrix_id) mv.*, m.poc_id, m.is_active, lw.week_no, lw.period_end,
                wv.numerator, wv.denominator, wv.actual_value, wv.result_text, wv.status, wv.score
           from matrix_version mv
           join matrix m on m.id = mv.matrix_id
           left join lateral (
             select w.id, w.week_no, w.period_end from weekly_update w
              where w.poc_id = m.poc_id order by w.week_no desc limit 1
           ) lw on true
           left join weekly_value wv on wv.weekly_update_id = lw.id and wv.matrix_version_id = mv.id
          where m.poc_id = any($1)
          order by mv.matrix_id, mv.version_no desc`,
        [ids],
      )
    : [];

  const wb = new ExcelJS.Workbook();
  wb.creator = `POC Tracker (${user.email})`;
  wb.created = new Date();

  const sheet = wb.addWorksheet("Daftar POC", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Customer", key: "customer", width: 34 },
    { header: "CPM", key: "cpm", width: 20 },
    { header: "Status POC", key: "status", width: 13 },
    { header: "Status Deal", key: "deal", width: 15 },
    { header: "Tanggal Deal", key: "deal_date", width: 13, style: { numFmt: "dd mmm yyyy" } },
    { header: "Alasan Deal", key: "deal_reason", width: 30 },
    { header: "Achievement", key: "achievement", width: 20 },
    { header: "Achievement Di-override", key: "overridden", width: 13 },
    { header: "Tanggal Mulai", key: "start", width: 13, style: { numFmt: "dd mmm yyyy" } },
    { header: "Rencana Selesai", key: "end", width: 13, style: { numFmt: "dd mmm yyyy" } },
    { header: "Target Closed", key: "closed", width: 13, style: { numFmt: "dd mmm yyyy" } },
    { header: "Potensi Revenue (Rp)", key: "revenue", width: 20, style: { numFmt: "#,##0" } },
    { header: "Update Terakhir (Minggu ke-)", key: "week", width: 14 },
    { header: "Periode Update Terakhir s.d.", key: "period_end", width: 14, style: { numFmt: "dd mmm yyyy" } },
    { header: "Belum Update >7 Hari", key: "stale", width: 12 },
    { header: "Target Diubah", key: "changed", width: 10 },
    { header: "Matrix Aktif", key: "matrix_count", width: 9 },
    { header: "Produk / Scope", key: "scope", width: 24 },
    { header: "Catatan", key: "notes", width: 36 },
  ];
  for (const p of pocs) {
    const achievement = p.achievement_override ?? p.achievement;
    sheet.addRow({
      customer: p.customer_name,
      cpm: p.cpm_name,
      status: POC_STATUS_LABEL[p.status],
      deal: p.deal_status ? DEAL_STATUS_LABEL[p.deal_status] : "",
      deal_date: asDate(p.deal_date),
      deal_reason: p.deal_reason ?? "",
      achievement: ACHIEVEMENT_LABEL[achievement],
      overridden: p.achievement_override ? "Ya" : "",
      start: asDate(p.start_date),
      end: asDate(p.end_date),
      closed: asDate(p.target_closed_date),
      revenue: p.potential_revenue,
      week: p.last_week_no,
      period_end: asDate(p.last_period_end),
      stale: p.stale ? "Ya" : "",
      changed: p.target_changed ? "Ya" : "",
      matrix_count: p.matrix_count,
      scope: p.scope ?? "",
      notes: p.notes ?? "",
    });
  }

  const customerOf = new Map(pocs.map((p) => [p.id, p.customer_name]));
  const order = new Map(ids.map((id, i) => [id, i]));
  const msheet = wb.addWorksheet("Matrix & Hasil Terakhir", { views: [{ state: "frozen", ySplit: 1 }] });
  msheet.columns = [
    { header: "Customer", key: "customer", width: 34 },
    { header: "Matrix", key: "name", width: 36 },
    { header: "Aktif", key: "active", width: 8 },
    { header: "Versi", key: "version", width: 7 },
    { header: "Tipe", key: "type", width: 24 },
    { header: "Target", key: "target", width: 26 },
    { header: "Baseline", key: "baseline", width: 10 },
    { header: "Minggu ke-", key: "week", width: 10 },
    { header: "Pembilang", key: "num", width: 10 },
    { header: "Penyebut", key: "den", width: 10 },
    { header: "Nilai Aktual", key: "actual", width: 11 },
    { header: "Hasil (Kualitatif)", key: "result", width: 30 },
    { header: "Skor", key: "score", width: 9 },
    { header: "Status", key: "status", width: 10 },
    { header: "Cara Ukur", key: "description", width: 60 },
  ];
  matrices
    .sort((a, b) => (order.get(a.poc_id) ?? 0) - (order.get(b.poc_id) ?? 0) || a.matrix_id - b.matrix_id)
    .forEach((m) => {
      msheet.addRow({
        customer: customerOf.get(m.poc_id),
        name: m.name,
        active: m.is_active ? "Ya" : "Tidak",
        version: m.version_no,
        type: CALC_TYPE_LABEL[m.calc_type],
        target: formatTarget(m),
        baseline: m.baseline,
        week: m.status ? m.week_no : null,
        num: m.numerator,
        den: m.denominator,
        actual: m.actual_value,
        result: m.result_text ?? "",
        score: m.score,
        status: m.status ? VALUE_STATUS_LABEL[m.status] : "",
        description: m.description ?? "",
      });
    });

  for (const ws of [sheet, msheet]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }

  // Data keluar dari aplikasi: dicatat siapa yang mengekspor dan dengan filter apa
  await query(
    "insert into audit_log (user_id, action, entity_type, after, ip_address) values ($1, 'poc.export', 'export', $2, $3)",
    [user.id, { filter: Object.fromEntries(params), jumlah_poc: pocs.length }, await clientIp()],
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="POC-Tracker_${todayWib()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

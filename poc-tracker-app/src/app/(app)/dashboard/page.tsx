import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, tableClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { Achievement } from "@/lib/calc";
import {
  attentionList,
  doneCrossTab,
  perCpm,
  revenuePipeline,
  statusCounts,
  type AttentionRow,
  type PipelineRow,
} from "@/lib/dashboard";
import {
  ACHIEVEMENT_LABEL,
  DEAL_STATUS_LABEL,
  POC_STATUS_LABEL,
  formatDate,
  formatDateTime,
  formatRupiah,
  formatRupiahShort,
  type DealStatus,
  type PocStatus,
} from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

// Di bawah jumlah ini persentase menyesatkan ("67%" dari 3 POC), jadi yang ditampilkan angka mentah
const MIN_FOR_PERCENT = 10;

export default async function DashboardPage() {
  await requireUser();
  const [statuses, cross, pipeline, attention, cpms] = await Promise.all([
    statusCounts(),
    doneCrossTab(),
    revenuePipeline(),
    attentionList(),
    perCpm(),
  ]);
  const total = statuses.reduce((s, r) => s + r.n, 0);

  return (
    <>
      <PageHeader
        title="Dashboard POC"
        description={`Data langsung dari aplikasi per ${formatDateTime(new Date())}, ${total} POC aktif di daftar (tanpa arsip).`}
      />
      {total === 0 ? (
        <EmptyState title="Belum ada POC.">Dashboard terisi otomatis setelah POC ditambahkan di Daftar POC.</EmptyState>
      ) : (
        <div className="space-y-6">
          <StatusTiles statuses={statuses} />
          <Conversion cross={cross} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Pipeline rows={pipeline} />
            <Attention rows={attention} />
          </div>
          <CpmTable rows={cpms} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Ringkasan status

const STATUS_ORDER: PocStatus[] = ["running", "upcoming", "on_hold", "done", "cancelled"];

function StatusTiles({ statuses }: { statuses: Awaited<ReturnType<typeof statusCounts>> }) {
  const byStatus = new Map(statuses.map((s) => [s.status, s]));
  return (
    <section aria-labelledby="ringkasan">
      <h2 id="ringkasan" className="mb-3 text-base font-semibold text-ink">
        Posisi POC Saat Ini
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const s = byStatus.get(status);
          return (
            <li key={status}>
              <Link
                href={`/?status=${status}`}
                className="block h-full rounded-xl border border-line bg-surface p-4 hover:bg-page"
              >
                <span className="block text-[13px] font-semibold text-muted">{POC_STATUS_LABEL[status]}</span>
                <span className="mt-1 block text-[30px] leading-[38px] font-bold text-ink">{s?.n ?? 0}</span>
                <span className="mt-1 block text-xs text-muted">
                  {s && s.revenue > 0 ? `Potensi ${formatRupiahShort(s.revenue)}` : "Tanpa potensi revenue"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Konversi

const ACH_ROWS: Achievement[] = ["achieved", "partial", "not_achieved", "wip"];
const DEAL_COLS: (DealStatus | null)[] = ["won", "awaiting_deal", "lost", null];

function share(part: number, whole: number) {
  return whole >= MIN_FOR_PERCENT ? ` (${Math.round((part / whole) * 100)}%)` : "";
}

function Conversion({ cross }: { cross: Awaited<ReturnType<typeof doneCrossTab>> }) {
  const count = (a?: Achievement, d?: DealStatus | null) =>
    cross
      .filter((c) => (a === undefined || c.achievement === a) && (d === undefined || c.deal === d))
      .reduce((s, c) => s + c.n, 0);
  const done = count();
  const achieved = count("achieved");
  const achievedWon = count("achieved", "won");
  const decided = count(undefined, "won") + count(undefined, "lost");
  const notFilled = count(undefined, null);

  const stages = [
    { label: "POC selesai (Done)", n: done, note: "" },
    { label: "Mencapai target (Achieved)", n: achieved, note: `${achieved} dari ${done} POC selesai${share(achieved, done)}` },
    { label: "Achieved dan Deal Won", n: achievedWon, note: `${achievedWon} dari ${achieved} POC yang achieved${share(achievedWon, achieved)}` },
  ];

  return (
    <Panel title="Dari POC Selesai ke Deal">
      {done === 0 ? (
        <p className="text-sm text-muted">Belum ada POC berstatus Done, jadi konversi belum bisa dihitung.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <ol className="space-y-4">
              {stages.map((s) => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{s.label}</span>
                    <span className="text-xl font-bold text-ink">{s.n}</span>
                  </div>
                  {/* Satu warna (primary) karena ini satu deret; lebar relatif terhadap jumlah POC selesai */}
                  <div className="mt-1.5 h-2 rounded-full bg-surface-alt" title={`${s.label}: ${s.n}`}>
                    <div className="h-2 rounded-full bg-action" style={{ width: `${(s.n / done) * 100}%` }} />
                  </div>
                  {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
                </li>
              ))}
            </ol>
            <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[13px] leading-[18px] text-muted">
              <p>
                Deal sudah diputuskan (Won atau Lost): <span className="font-semibold text-ink">{decided}</span> dari {done} POC selesai.
              </p>
              {notFilled > 0 && (
                <p>
                  <Link href="/?status=done&deal=none" className="font-semibold text-accent hover:underline">
                    {notFilled} POC selesai belum diisi status deal
                  </Link>
                  , sehingga belum ikut terhitung di konversi.
                </p>
              )}
              {done < MIN_FOR_PERCENT && (
                <p>Persentase ditampilkan setelah minimal {MIN_FOR_PERCENT} POC selesai, karena dari jumlah kecil persentase mudah menyesatkan.</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="mb-1 text-sm font-semibold text-ink">Apakah POC yang sukses berujung deal?</h3>
            <p className="mb-3 text-xs text-muted">Jumlah POC Done menurut achievement (baris) dan status deal (kolom). Klik angka untuk melihat POC-nya.</p>
            <div className={tableClass.scrollWrap}>
              <table className={tableClass.table}>
                <thead className={tableClass.head}>
                  <tr>
                    <th scope="col" className={tableClass.th}>Achievement</th>
                    {DEAL_COLS.map((d) => (
                      <th key={d ?? "none"} scope="col" className={`${tableClass.th} text-right`}>
                        {d ? DEAL_STATUS_LABEL[d] : "Belum diisi"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACH_ROWS.filter((a) => count(a) > 0 || a !== "wip").map((a) => (
                    <tr key={a}>
                      <th scope="row" className={`${tableClass.td} text-left font-medium`}>
                        {ACHIEVEMENT_LABEL[a]}
                      </th>
                      {DEAL_COLS.map((d) => {
                        const n = count(a, d);
                        return (
                          <td key={d ?? "none"} className={`${tableClass.td} text-right`}>
                            {n === 0 ? (
                              <span className="text-muted">0</span>
                            ) : (
                              <Link
                                href={`/?status=done&achievement=${a}&deal=${d ?? "none"}`}
                                className="font-semibold text-accent hover:underline"
                              >
                                {n}
                              </Link>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Pipeline revenue

// "Masih berjalan" tanpa link: daftar POC belum bisa memfilter tiga status sekaligus
const BUCKETS: { key: PipelineRow["bucket"]; label: string; href?: string }[] = [
  { key: "won", label: "Deal Won", href: "/?deal=won" },
  { key: "awaiting_deal", label: "Awaiting Deal", href: "/?deal=awaiting_deal" },
  { key: "undecided", label: "Selesai, status deal belum diisi", href: "/?status=done&deal=none" },
  { key: "in_progress", label: "Masih berjalan (Running, Upcoming, On Hold)" },
  { key: "lost", label: "Deal Lost", href: "/?deal=lost" },
];

function Pipeline({ rows }: { rows: PipelineRow[] }) {
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Panel title="Potensi Revenue per Hasil Deal">
      <p className="mb-4 text-xs text-muted">Jumlah potensi revenue yang tercatat di tiap POC, dikelompokkan menurut status deal.</p>
      <ul className="space-y-4">
        {BUCKETS.map((b) => {
          const r = byKey.get(b.key);
          const revenue = r?.revenue ?? 0;
          return (
            <li key={b.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                {b.href ? (
                  <Link href={b.href} className="font-medium text-ink hover:underline">
                    {b.label}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{b.label}</span>
                )}
                <span className="text-ink">
                  <span className="font-semibold">{formatRupiahShort(revenue)}</span>
                  <span className="text-muted">, {r?.n ?? 0} POC</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-surface-alt" title={`${b.label}: ${formatRupiah(revenue)} dari ${r?.n ?? 0} POC`}>
                {revenue > 0 && <div className="h-2 rounded-full bg-action" style={{ width: `${(revenue / max) * 100}%` }} />}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------- Perlu perhatian

const ATTENTION_LABEL: Record<AttentionRow["reason"], string> = {
  overdue: "Target closed sudah lewat",
  stale: "Running, belum update >7 hari",
  no_deal: "Done, status deal belum diisi",
  target_changed: "Target matrix diubah (30 hari terakhir)",
};

function attentionDetail(r: AttentionRow) {
  switch (r.reason) {
    case "overdue":
      return `Target closed ${formatDate(r.detail)}`;
    case "stale":
      return r.detail ? `Update terakhir diisi ${formatDate(r.detail)}` : "Belum pernah ada update";
    case "target_changed":
      return `Diubah ${formatDate(r.detail)}`;
    default:
      return "";
  }
}

function Attention({ rows }: { rows: AttentionRow[] }) {
  return (
    <Panel title="Perlu Perhatian">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          Tidak ada POC yang perlu ditindaklanjuti: semua POC running sudah di-update minggu ini, tidak ada target closed yang lewat, dan semua POC selesai sudah punya status deal.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={`${r.id}-${r.reason}`} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <span className="text-xs font-semibold text-warn">{ATTENTION_LABEL[r.reason]}</span>
              <Link href={`/poc/${r.id}`} className="text-sm font-semibold text-ink hover:underline">
                {r.customer_name}
              </Link>
              <span className="text-xs text-muted">
                {r.cpm_name}
                {attentionDetail(r) && `, ${attentionDetail(r)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Per CPM

function CpmTable({ rows }: { rows: Awaited<ReturnType<typeof perCpm>> }) {
  return (
    <section aria-labelledby="per-cpm">
      <h2 id="per-cpm" className="mb-3 text-base font-semibold text-ink">
        Per CPM
      </h2>
      <div className={tableClass.scrollWrap}>
        <table className={tableClass.table}>
          <thead className={tableClass.head}>
            <tr>
              <th scope="col" className={tableClass.th}>CPM</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Running</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Upcoming / On Hold</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Done</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Deal Won</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Awaiting</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Deal Lost</th>
              <th scope="col" className={`${tableClass.th} text-right`}>Potensi revenue aktif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className={`${tableClass.td} text-left font-medium`}>
                  <Link href={`/?cpm=${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                </th>
                <td className={`${tableClass.td} text-right`}>{r.running}</td>
                <td className={`${tableClass.td} text-right`}>{r.waiting}</td>
                <td className={`${tableClass.td} text-right`}>{r.done}</td>
                <td className={`${tableClass.td} text-right`}>{r.won}</td>
                <td className={`${tableClass.td} text-right`}>{r.awaiting}</td>
                <td className={`${tableClass.td} text-right`}>{r.lost}</td>
                <td className={`${tableClass.td} text-right tabular-nums`}>{formatRupiah(r.active_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Potensi revenue aktif = jumlah potensi revenue POC Running, Upcoming, dan On Hold.</p>
    </section>
  );
}

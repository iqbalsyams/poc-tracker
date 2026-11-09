import type { Metadata } from "next";
import Link from "next/link";
import { AchievementBadge, DealBadge, StatusBadge } from "@/components/poc-badges";
import { Badge, Button, EmptyState, LinkButton, PageHeader, buttonClass, fieldClass, tableClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ACHIEVEMENT_LABEL, DEAL_STATUS_LABEL, POC_STATUS_LABEL, formatDate, formatRupiah } from "@/lib/format";
import { listActiveCpms, listPocs, parsePocFilters, type PocListRow } from "@/lib/queries";

export const metadata: Metadata = { title: "Daftar POC" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PocListPage(props: PageProps<"/">) {
  await requireUser();
  const sp = await props.searchParams;
  const filters = parsePocFilters((key) => first(sp[key]));
  const filtered = Boolean(
    filters.q || filters.cpm || filters.status || filters.achievement || filters.deal || filters.archived,
  );
  const exportQuery = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (first(v) ? [[k, first(v)]] : [])),
  ).toString();
  const [pocs, cpms] = await Promise.all([listPocs(filters), listActiveCpms()]);
  const staleCount = pocs.filter((p) => p.stale).length;

  return (
    <>
      <PageHeader
        title={filters.archived ? "POC yang Diarsipkan" : "Daftar POC"}
        description={
          pocs.length > 0 &&
          `${pocs.length} POC${staleCount > 0 ? `, ${staleCount} belum di-update lebih dari 7 hari` : ""}.`
        }
        actions={
          <>
            {/* <a> biasa, bukan Link: file diunduh, bukan navigasi halaman */}
            {pocs.length > 0 && (
              <a href={`/poc/export${exportQuery ? `?${exportQuery}` : ""}`} download className={buttonClass("secondary")}>
                Export ke Excel
              </a>
            )}
            <LinkButton href="/poc/baru" variant="primary">
              Tambah POC
            </LinkButton>
          </>
        }
      />

      <form method="get" className="mb-6 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] lg:items-end">
        <label className="block space-y-1.5 text-[13px] leading-[18px] font-medium text-ink">
          Cari customer
          <input name="q" defaultValue={filters.q} placeholder="Nama customer" className={fieldClass} />
        </label>
        <label className="block space-y-1.5 text-[13px] leading-[18px] font-medium text-ink">
          CPM
          <select name="cpm" defaultValue={filters.cpm ?? ""} className={fieldClass}>
            <option value="">Semua CPM</option>
            {cpms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-[13px] leading-[18px] font-medium text-ink">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className={fieldClass}>
            <option value="">Semua status</option>
            {Object.entries(POC_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-[13px] leading-[18px] font-medium text-ink">
          Achievement
          <select name="achievement" defaultValue={filters.achievement ?? ""} className={fieldClass}>
            <option value="">Semua</option>
            {Object.entries(ACHIEVEMENT_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-[13px] leading-[18px] font-medium text-ink">
          Status deal
          <select name="deal" defaultValue={filters.deal ?? ""} className={fieldClass}>
            <option value="">Semua</option>
            {Object.entries(DEAL_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
            <option value="none">Belum diisi</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5 lg:justify-end">
          {filtered && (
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-2">
              Hapus filter
            </Link>
          )}
          <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="arsip" value="1" defaultChecked={filters.archived} className="size-4" />
            Arsip
          </label>
          <Button type="submit">Terapkan Filter</Button>
        </div>
      </form>

      {pocs.length === 0 ? (
        filtered ? (
          <EmptyState title="Tidak ada POC yang cocok dengan filter ini.">
            <Link href="/" className="text-accent underline underline-offset-2">
              Hapus filter
            </Link>{" "}
            untuk melihat semua POC.
          </EmptyState>
        ) : (
          <EmptyState title="Belum ada POC.">
            Tambahkan POC pertama, lalu isi matrix dan targetnya. Update mingguan bisa dibuat setelah matrix ada.
            <div className="mt-4">
              <LinkButton href="/poc/baru" variant="primary">
                Tambah POC
              </LinkButton>
            </div>
          </EmptyState>
        )
      ) : (
        <>
          <PocCards pocs={pocs} />
          <PocTable pocs={pocs} />
        </>
      )}
    </>
  );
}

function LastUpdate({ poc }: { poc: PocListRow }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-ink">
        {poc.last_week_no ? `Minggu ke-${poc.last_week_no}, s.d. ${formatDate(poc.last_period_end)}` : "Belum ada update"}
      </div>
      {poc.stale && <Badge tone="warn">Belum update &gt;7 hari</Badge>}
    </div>
  );
}

function CustomerCell({ poc }: { poc: PocListRow }) {
  return (
    <div className="space-y-1">
      <Link href={`/poc/${poc.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
        {poc.customer_name}
      </Link>
      {poc.scope && <div className="text-sm text-muted">{poc.scope}</div>}
      {poc.target_changed && <Badge tone="warn">Target diubah</Badge>}
    </div>
  );
}

// Di layar kecil tabel 8 kolom tidak terbaca, jadi data yang sama ditampilkan per kartu
function PocCards({ pocs }: { pocs: PocListRow[] }) {
  return (
    <ul className="space-y-3 lg:hidden">
      {pocs.map((p) => (
        <li key={p.id} className="rounded-xl border border-line bg-surface p-4">
          <CustomerCell poc={p} />
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">CPM</dt>
              <dd className="text-ink">{p.cpm_name}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge value={p.status} />
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Update terakhir</dt>
              <dd>
                <LastUpdate poc={p} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Achievement</dt>
              <dd>
                <AchievementBadge value={p.achievement_override ?? p.achievement} overridden={!!p.achievement_override} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Status deal</dt>
              <dd>
                <DealBadge value={p.deal_status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Target closed</dt>
              <dd className="text-ink">{formatDate(p.target_closed_date) || "Belum ditentukan"}</dd>
            </div>
            <div>
              <dt className="text-muted">Potensi revenue</dt>
              <dd className="text-ink tabular-nums">{formatRupiah(p.potential_revenue)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function PocTable({ pocs }: { pocs: PocListRow[] }) {
  return (
    <div className={`hidden lg:block ${tableClass.wrap}`}>
      <table className={tableClass.table}>
        <thead className={tableClass.head}>
          <tr>
            <th scope="col" className={tableClass.th}>Customer</th>
            <th scope="col" className={tableClass.th}>CPM</th>
            <th scope="col" className={tableClass.th}>Status</th>
            <th scope="col" className={tableClass.th}>Update terakhir</th>
            <th scope="col" className={tableClass.th}>Achievement</th>
            <th scope="col" className={tableClass.th}>Status deal</th>
            <th scope="col" className={`${tableClass.th} text-right`}>Potensi revenue</th>
            <th scope="col" className={tableClass.th}>Target closed</th>
          </tr>
        </thead>
        <tbody>
          {pocs.map((p) => (
            <tr key={p.id} className="hover:bg-page">
              <td className={tableClass.td}>
                <CustomerCell poc={p} />
              </td>
              <td className={tableClass.td}>{p.cpm_name}</td>
              <td className={tableClass.td}>
                <StatusBadge value={p.status} />
              </td>
              <td className={tableClass.td}>
                <LastUpdate poc={p} />
              </td>
              <td className={tableClass.td}>
                <AchievementBadge value={p.achievement_override ?? p.achievement} overridden={!!p.achievement_override} />
              </td>
              <td className={tableClass.td}>
                <DealBadge value={p.deal_status} />
              </td>
              <td className={`${tableClass.td} text-right tabular-nums`}>{formatRupiah(p.potential_revenue)}</td>
              <td className={tableClass.td}>
                {formatDate(p.target_closed_date) || <span className="text-muted">Belum ditentukan</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

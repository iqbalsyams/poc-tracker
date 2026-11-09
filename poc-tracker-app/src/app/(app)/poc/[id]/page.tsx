import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AchievementBadge, DealBadge, StatusBadge, ValueBadge } from "@/components/poc-badges";
import { Badge, EmptyState, LinkButton, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import {
  CALC_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRupiah,
  formatTarget,
} from "@/lib/format";
import { describeHistory } from "@/lib/history";
import {
  getMatrices,
  getPoc,
  getPocHistory,
  getWeeklyUpdates,
  userNames,
  type MatrixVersion,
  type MatrixWithVersions,
  type WeeklyUpdateRow,
  type WeeklyValueRow,
} from "@/lib/queries";
import { DealForm } from "./deal-form";
import { OverrideForm } from "./override-form";

export async function generateMetadata(props: PageProps<"/poc/[id]">): Promise<Metadata> {
  const poc = await getPoc(Number((await props.params).id));
  return { title: poc?.customer_name ?? "POC" };
}

const TABS = [
  { key: "matrix", label: "Matrix & target" },
  { key: "update", label: "Update mingguan" },
  { key: "riwayat", label: "Riwayat perubahan" },
] as const;

export default async function PocDetailPage(props: PageProps<"/poc/[id]">) {
  const user = await requireUser();
  const id = Number((await props.params).id);
  const poc = Number.isInteger(id) ? await getPoc(id) : null;
  if (!poc) notFound();

  const sp = await props.searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? "update";
  const editable = canEditPoc(user, poc);

  const [matrices, updates] = await Promise.all([getMatrices(poc.id), getWeeklyUpdates(poc.id)]);
  const activeCount = matrices.filter((m) => m.is_active).length;
  const nextWeek = (updates[0]?.week_no ?? 0) + 1;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm">
            <Link href="/" className="text-accent underline underline-offset-2">
              Daftar POC
            </Link>
          </p>
          <h1 className="mt-1 text-[22px] leading-[30px] font-bold text-ink">{poc.customer_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={poc.status} />
            <AchievementBadge value={poc.achievement_override ?? poc.achievement} overridden={!!poc.achievement_override} />
            {poc.is_archived && <Badge>Diarsipkan</Badge>}
          </div>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            {activeCount > 0 && (
              <LinkButton href={`/poc/${poc.id}/update/baru`} variant="primary">
                Isi Update Minggu ke-{nextWeek}
              </LinkButton>
            )}
            <LinkButton href={`/poc/${poc.id}/ubah`}>Ubah Info POC</LinkButton>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 lg:order-1">
          <nav aria-label="Bagian POC" className="mb-4 flex flex-wrap border-b border-line-default">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/poc/${poc.id}?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold ${
                  tab === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {tab === "matrix" && <MatrixTab pocId={poc.id} matrices={matrices} editable={editable} hasUpdates={updates.length > 0} />}
          {tab === "update" && (
            <UpdateTab pocId={poc.id} matrices={matrices} updates={updates} editable={editable} activeCount={activeCount} />
          )}
          {tab === "riwayat" && <HistoryTab pocId={poc.id} matrices={matrices} />}
        </div>

        <aside className="space-y-4 lg:order-2">
          <Panel title="Info POC">
            <dl className="space-y-3 text-sm">
              <Info label="CPM" value={poc.cpm_name} />
              <Info label="Tanggal mulai" value={formatDate(poc.start_date) || "Belum diisi"} />
              <Info label="Rencana selesai" value={formatDate(poc.end_date) || "Belum diisi"} />
              <Info label="Target closed" value={formatDate(poc.target_closed_date) || "Belum ditentukan"} />
              <Info label="Potensi revenue" value={formatRupiah(poc.potential_revenue)} />
              {poc.scope && <Info label="Produk / scope" value={poc.scope} />}
              {poc.notes && <Info label="Catatan" value={poc.notes} />}
            </dl>
          </Panel>
          <Panel title="Status Deal">
            <div className="space-y-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <DealBadge value={poc.deal_status} />
                {poc.deal_date && <span className="text-muted">diputuskan {formatDate(poc.deal_date)}</span>}
              </p>
              {poc.deal_reason && <p className="whitespace-pre-line text-ink">{poc.deal_reason}</p>}
              {!poc.deal_status && poc.status === "done" && (
                <p className="text-muted">POC sudah selesai. Isi status deal supaya ikut terhitung di konversi dashboard.</p>
              )}
              {editable && (
                <DealForm pocId={poc.id} current={poc.deal_status} date={poc.deal_date} reason={poc.deal_reason} />
              )}
            </div>
          </Panel>
          <Panel title="Achievement">
            <div className="space-y-3 text-sm">
              <p className="text-ink">
                Hitungan otomatis: <AchievementBadge value={poc.achievement} />
              </p>
              {poc.achievement_override && (
                <p className="text-ink">
                  Di-override menjadi <AchievementBadge value={poc.achievement_override} /> dengan alasan:{" "}
                  <span className="text-muted">{poc.achievement_override_reason}</span>
                </p>
              )}
              <p className="text-muted">Dihitung dari update terakhir: semua matrix Met = Achieved, sebagian = Partially Achieved.</p>
              {editable && <OverrideForm pocId={poc.id} current={poc.achievement_override} />}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-ink">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- Matrix

function MatrixTab({
  pocId,
  matrices,
  editable,
  hasUpdates,
}: {
  pocId: number;
  matrices: MatrixWithVersions[];
  editable: boolean;
  hasUpdates: boolean;
}) {
  const active = matrices.filter((m) => m.is_active);
  const inactive = matrices.filter((m) => !m.is_active);
  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {hasUpdates
              ? "POC ini sudah punya update mingguan. Setiap perubahan matrix membuat versi baru dan wajib beralasan."
              : "Belum ada update mingguan, jadi matrix masih bisa diubah tanpa alasan."}
          </p>
          <LinkButton href={`/poc/${pocId}/matrix/baru`}>Tambah Matrix</LinkButton>
        </div>
      )}
      {active.length === 0 && (
        <EmptyState title="Belum ada matrix aktif.">
          Matrix adalah ukuran keberhasilan POC, misal &quot;alert terdeteksi ≥80%&quot;. Update mingguan baru bisa diisi setelah
          minimal satu matrix dibuat.
        </EmptyState>
      )}
      {active.map((m) => (
        <MatrixCard key={m.id} pocId={pocId} matrix={m} editable={editable} />
      ))}
      {inactive.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-ink">
            Matrix nonaktif ({inactive.length})
          </summary>
          <div className="space-y-4 border-t border-line p-4">
            {inactive.map((m) => (
              <MatrixCard key={m.id} pocId={pocId} matrix={m} editable={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function MatrixCard({ pocId, matrix, editable }: { pocId: number; matrix: MatrixWithVersions; editable: boolean }) {
  const v = matrix.current;
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{v.name}</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge>Versi {v.version_no}</Badge>
            <Badge>{CALC_TYPE_LABEL[v.calc_type]}</Badge>
            {!matrix.is_active && <Badge tone="bad">Nonaktif</Badge>}
          </div>
        </div>
        {editable && (
          <LinkButton href={`/poc/${pocId}/matrix/${matrix.id}`}>Ubah Matrix</LinkButton>
        )}
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Target</dt>
          <dd className="font-medium text-ink">{formatTarget(v)}</dd>
        </div>
        {v.calc_type === "reduction" && (
          <div>
            <dt className="text-muted">Baseline</dt>
            <dd className="text-ink">
              {formatNumber(v.baseline)} {v.unit}
            </dd>
          </div>
        )}
        {v.description && (
          <div className="sm:col-span-2">
            <dt className="text-muted">Cara ukur</dt>
            <dd className="whitespace-pre-line text-ink">{v.description}</dd>
          </div>
        )}
        {!matrix.is_active && matrix.deactivated_reason && (
          <div className="sm:col-span-2">
            <dt className="text-muted">Alasan dinonaktifkan</dt>
            <dd className="text-ink">{matrix.deactivated_reason}</dd>
          </div>
        )}
      </dl>
      {matrix.versions.length > 1 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-accent">
            Lihat {matrix.versions.length} versi matrix ini
          </summary>
          <ol className="mt-2 space-y-3">
            {matrix.versions.map((ver) => (
              <VersionItem key={ver.id} version={ver} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function VersionItem({ version: v }: { version: MatrixVersion }) {
  return (
    <li className="rounded-md bg-surface-alt p-3 text-sm">
      <p className="font-medium text-ink">
        Versi {v.version_no}: {v.name}, target {formatTarget(v)}
        {v.calc_type === "reduction" && `, baseline ${formatNumber(v.baseline)}`}
      </p>
      <p className="mt-1 text-muted">
        Oleh {v.created_by_name}, {formatDateTime(v.created_at)}
        {v.version_no > 1 && `, berlaku mulai minggu ke-${v.effective_from_week}`}
      </p>
      {v.change_reason && <p className="mt-1 text-ink">Alasan: {v.change_reason}</p>}
    </li>
  );
}

// ---------------------------------------------------------------- Update mingguan

function UpdateTab({
  pocId,
  matrices,
  updates,
  editable,
  activeCount,
}: {
  pocId: number;
  matrices: MatrixWithVersions[];
  updates: WeeklyUpdateRow[];
  editable: boolean;
  activeCount: number;
}) {
  if (updates.length === 0) {
    return (
      <EmptyState title="Belum ada update mingguan.">
        {activeCount === 0 ? (
          <>
            Buat matrix dulu di tab{" "}
            <Link href={`/poc/${pocId}?tab=matrix`} className="text-accent underline underline-offset-2">
              Matrix & target
            </Link>
            , lalu isi update minggu pertama.
          </>
        ) : editable ? (
          "Gunakan tombol \"Isi update minggu ke-1\" di atas untuk mencatat hasil minggu pertama."
        ) : (
          "CPM POC ini belum mengisi update minggu pertama."
        )}
      </EmptyState>
    );
  }
  const versionById = new Map(matrices.flatMap((m) => m.versions).map((v) => [v.id, v]));
  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <Panel
          key={u.id}
          title={`Minggu ke-${u.week_no}: ${formatDate(u.period_start)} s.d. ${formatDate(u.period_end)}`}
          actions={editable && <LinkButton href={`/poc/${pocId}/update/${u.id}`}>Koreksi</LinkButton>}
        >
          <p className="mb-3 text-sm text-muted">
            Diisi {u.submitted_by_name}, {formatDateTime(u.submitted_at)}
            {u.updated_at && `. Dikoreksi ${formatDateTime(u.updated_at)}, lihat tab Riwayat untuk alasannya`}
          </p>
          <ul className="divide-y divide-line">
            {u.values.map((val) => {
              const version = versionById.get(val.matrix_version_id);
              if (!version) return null;
              return (
                <li key={val.matrix_version_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{version.name}</p>
                    <p className="text-sm text-muted">
                      Target {formatTarget(version)}
                      {version.version_no > 1 && ` (versi ${version.version_no})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink tabular-nums">{resultText(val, version)}</span>
                    <ValueBadge value={val.status} />
                  </div>
                </li>
              );
            })}
          </ul>
          {(u.progress || u.issues || u.next_action) && (
            <dl className="mt-3 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
              {u.progress && <Info label="Progress" value={u.progress} />}
              {u.issues && <Info label="Kendala" value={u.issues} />}
              {u.next_action && <Info label="Next action" value={u.next_action} />}
            </dl>
          )}
        </Panel>
      ))}
    </div>
  );
}

function resultText(val: WeeklyValueRow, version: MatrixVersion): string {
  switch (version.calc_type) {
    case "ratio":
      return `${formatNumber(val.numerator)}/${formatNumber(val.denominator)} = ${formatNumber(val.score)}%`;
    case "reduction":
      return `${formatNumber(version.baseline)} → ${formatNumber(val.actual_value)}, turun ${formatNumber(val.score)}%`;
    case "value":
      return `${formatNumber(val.actual_value)}${version.unit ? ` ${version.unit}` : ""}`;
    case "qualitative":
      return val.result_text ?? "";
  }
}

// ---------------------------------------------------------------- Riwayat

async function HistoryTab({ pocId, matrices }: { pocId: number; matrices: MatrixWithVersions[] }) {
  const [rows, users] = await Promise.all([getPocHistory(pocId), userNames()]);
  const items = describeHistory(rows, matrices.flatMap((m) => m.versions), users);
  if (items.length === 0) {
    return <EmptyState title="Belum ada perubahan yang tercatat untuk POC ini." />;
  }
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Semua perubahan dicatat otomatis oleh database dan tidak bisa diubah atau dihapus, termasuk oleh Admin.
      </p>
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-surface p-4 text-[13px] leading-[18px]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="font-medium text-ink">{item.summary}</p>
              <p className="text-muted">
                {item.userName}, {formatDateTime(item.occurredAt)}
              </p>
            </div>
            {item.reason && <p className="mt-2 text-ink">Alasan: {item.reason}</p>}
            {item.changes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.changes.map((c) => (
                  <li key={c.field} className="text-muted">
                    <span className="text-ink">{c.field}:</span>{" "}
                    {c.before ? (
                      <>
                        <del>{c.before}</del> → <span className="text-ink">{c.after}</span>
                      </>
                    ) : (
                      <span className="text-ink">{c.after}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMatrices, getPoc } from "@/lib/queries";
import { deactivateMatrix, saveMatrix } from "@/app/(app)/poc/actions";
import { MatrixForm } from "../matrix-form";
import { DeactivateForm } from "./deactivate-form";

export const metadata: Metadata = { title: "Ubah matrix" };

export default async function EditMatrixPage(props: PageProps<"/poc/[id]/matrix/[matrixId]">) {
  const params = await props.params;
  const user = await requireUser();
  const poc = await getPoc(Number(params.id));
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) redirect(`/poc/${poc.id}?tab=matrix`);

  const matrix = (await getMatrices(poc.id)).find((m) => m.id === Number(params.matrixId));
  if (!matrix) notFound();
  if (!matrix.is_active) redirect(`/poc/${poc.id}?tab=matrix`);

  const [{ max_week }] = await query<{ max_week: number }>(
    "select coalesce(max(week_no), 0) as max_week from weekly_update where poc_id = $1",
    [poc.id],
  );
  const cancelHref = `/poc/${poc.id}?tab=matrix`;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`Ubah Matrix: ${matrix.current.name}`}
        description={`${poc.customer_name}. Versi sekarang: ${matrix.current.version_no}.`}
      />
      <Panel>
        <MatrixForm
          action={saveMatrix.bind(null, poc.id, matrix.id)}
          current={matrix.current}
          hasUpdates={max_week > 0}
          nextWeek={max_week + 1}
          cancelHref={cancelHref}
        />
      </Panel>
      <Panel title="Nonaktifkan Matrix">
        <p className="mb-4 text-sm text-muted">
          Matrix nonaktif tidak muncul di update mingguan berikutnya dan tidak ikut dihitung di achievement. Nilai minggu
          sebelumnya tetap tersimpan. Matrix tidak bisa dihapus.
        </p>
        <DeactivateForm action={deactivateMatrix.bind(null, poc.id, matrix.id)} />
      </Panel>
    </div>
  );
}

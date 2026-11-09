import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { saveWeeklyUpdate } from "@/app/(app)/poc/actions";
import { PageHeader, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getMatrices, getPoc, getWeeklyUpdates } from "@/lib/queries";
import { WeeklyForm } from "../weekly-form";

export const metadata: Metadata = { title: "Koreksi update mingguan" };

export default async function EditWeeklyUpdatePage(props: PageProps<"/poc/[id]/update/[updateId]">) {
  const params = await props.params;
  const user = await requireUser();
  const poc = await getPoc(Number(params.id));
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) redirect(`/poc/${poc.id}?tab=update`);

  const [matrices, updates] = await Promise.all([getMatrices(poc.id), getWeeklyUpdates(poc.id)]);
  const update = updates.find((u) => u.id === Number(params.updateId));
  if (!update) notFound();

  // Koreksi memakai versi matrix yang berlaku saat update ini dibuat, bukan versi terbaru
  const versionById = new Map(matrices.flatMap((m) => m.versions).map((v) => [v.id, v]));
  const versions = update.values.flatMap((val) => versionById.get(val.matrix_version_id) ?? []);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Koreksi Update Minggu ke-${update.week_no}`}
        description={`${poc.customer_name}, periode ${formatDate(update.period_start)} s.d. ${formatDate(update.period_end)}.`}
      />
      <Panel>
        <WeeklyForm
          action={saveWeeklyUpdate.bind(null, poc.id, update.id)}
          weekNo={update.week_no}
          versions={versions}
          existing={update}
          defaultStart={update.period_start}
          defaultEnd={update.period_end}
          cancelHref={`/poc/${poc.id}?tab=update`}
        />
      </Panel>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { saveWeeklyUpdate } from "@/app/(app)/poc/actions";
import { PageHeader, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import { addDays, todayWib } from "@/lib/format";
import { getMatrices, getPoc, getWeeklyUpdates } from "@/lib/queries";
import { WeeklyForm } from "../weekly-form";

export const metadata: Metadata = { title: "Update mingguan" };

export default async function NewWeeklyUpdatePage(props: PageProps<"/poc/[id]/update/baru">) {
  const user = await requireUser();
  const poc = await getPoc(Number((await props.params).id));
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) redirect(`/poc/${poc.id}`);

  const [matrices, updates] = await Promise.all([getMatrices(poc.id), getWeeklyUpdates(poc.id)]);
  const versions = matrices.filter((m) => m.is_active).map((m) => m.current);
  if (versions.length === 0) redirect(`/poc/${poc.id}?tab=matrix`);

  const last = updates[0];
  const start = last ? addDays(last.period_end, 1) : (poc.start_date ?? todayWib());
  const weekNo = (last?.week_no ?? 0) + 1;

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Update Minggu ke-${weekNo}`} description={poc.customer_name} />
      <Panel>
        <WeeklyForm
          action={saveWeeklyUpdate.bind(null, poc.id, null)}
          weekNo={weekNo}
          versions={versions}
          defaultStart={start}
          defaultEnd={addDays(start, 6)}
          cancelHref={`/poc/${poc.id}?tab=update`}
        />
      </Panel>
    </div>
  );
}

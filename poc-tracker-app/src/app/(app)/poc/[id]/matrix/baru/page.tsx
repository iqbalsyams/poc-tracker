import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPoc } from "@/lib/queries";
import { saveMatrix } from "@/app/(app)/poc/actions";
import { MatrixForm } from "../matrix-form";

export const metadata: Metadata = { title: "Tambah matrix" };

export default async function NewMatrixPage(props: PageProps<"/poc/[id]/matrix/baru">) {
  const user = await requireUser();
  const poc = await getPoc(Number((await props.params).id));
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) redirect(`/poc/${poc.id}?tab=matrix`);
  const [{ max_week }] = await query<{ max_week: number }>(
    "select coalesce(max(week_no), 0) as max_week from weekly_update where poc_id = $1",
    [poc.id],
  );
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tambah Matrix" description={poc.customer_name} />
      <Panel>
        <MatrixForm
          action={saveMatrix.bind(null, poc.id, null)}
          current={null}
          hasUpdates={max_week > 0}
          nextWeek={max_week + 1}
          cancelHref={`/poc/${poc.id}?tab=matrix`}
        />
      </Panel>
    </div>
  );
}

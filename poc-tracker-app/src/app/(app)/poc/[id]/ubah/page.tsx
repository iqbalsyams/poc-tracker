import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { canEditPoc, requireUser } from "@/lib/auth";
import { getPoc, listActiveCpms } from "@/lib/queries";
import { updatePoc } from "@/app/(app)/poc/actions";
import { PocForm } from "../../poc-form";

export const metadata: Metadata = { title: "Ubah POC" };

export default async function EditPocPage(props: PageProps<"/poc/[id]/ubah">) {
  const { id } = await props.params;
  const user = await requireUser();
  const poc = await getPoc(Number(id));
  if (!poc) notFound();
  if (!canEditPoc(user, poc)) redirect(`/poc/${poc.id}`);
  const cpms = await listActiveCpms();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Ubah POC: ${poc.customer_name}`} />
      <Panel>
        <PocForm
          action={updatePoc.bind(null, poc.id)}
          poc={poc}
          isAdmin={user.role === "admin"}
          cpms={cpms}
          currentUserId={user.id}
          cancelHref={`/poc/${poc.id}`}
        />
      </Panel>
    </div>
  );
}

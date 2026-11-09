import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listActiveCpms } from "@/lib/queries";
import { createPoc } from "@/app/(app)/poc/actions";
import { PocForm } from "../poc-form";

export const metadata: Metadata = { title: "Tambah POC" };

export default async function NewPocPage() {
  const user = await requireUser();
  const cpms = await listActiveCpms();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tambah POC" description="Setelah disimpan, Anda diarahkan ke halaman matrix untuk mengisi target POC." />
      <Panel>
        <PocForm action={createPoc} isAdmin={user.role === "admin"} cpms={cpms} currentUserId={user.id} cancelHref="/" />
      </Panel>
    </div>
  );
}

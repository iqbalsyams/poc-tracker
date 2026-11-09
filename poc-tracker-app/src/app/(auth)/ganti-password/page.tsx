import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Ganti password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-[22px] leading-[30px] font-bold text-ink">Ganti Password</h1>
        <p className="mt-2 text-sm text-muted">
          {user.must_change_password
            ? "Password Anda masih password sementara dari Admin. Buat password sendiri sebelum lanjut, supaya semua perubahan di audit trail benar-benar atas nama Anda."
            : `Masuk sebagai ${user.email}.`}
        </p>
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <ChangePasswordForm />
        </div>
        {!user.must_change_password && (
          <p className="mt-4 text-sm">
            <Link href="/" className="font-medium text-accent underline underline-offset-2">
              Kembali ke daftar POC
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

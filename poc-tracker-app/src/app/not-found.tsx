import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-[22px] leading-[30px] font-bold text-ink">Halaman Tidak Ditemukan</h1>
      <p className="mt-2 text-sm text-muted">POC atau halaman yang Anda buka tidak ada, atau tautannya salah.</p>
      <p className="mt-4 text-sm">
        <Link href="/" className="font-medium text-accent underline underline-offset-2">
          Kembali ke daftar POC
        </Link>
      </p>
    </main>
  );
}

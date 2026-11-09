"use client";

import { Alert, Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4 py-6">
      <Alert>
        <p className="font-medium">Halaman ini gagal dimuat.</p>
        <p className="mt-1">
          {error.message.startsWith("Anda tidak punya akses")
            ? error.message
            : "Biasanya karena koneksi ke database terputus. Coba muat ulang; kalau tetap gagal, laporkan ke Admin beserta waktu kejadiannya."}
        </p>
        {error.digest && <p className="mt-1">Kode error: {error.digest}</p>}
      </Alert>
      <Button onClick={reset}>Coba Muat Ulang</Button>
    </div>
  );
}

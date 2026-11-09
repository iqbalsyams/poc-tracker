"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Seperti useActionState, tetapi form dikirim lewat onSubmit, bukan prop `action`.
 * Prop `action` membuat React mengosongkan form setelah action selesai, termasuk saat
 * server mengembalikan error validasi, sehingga isian user hilang.
 */
export function useFormAction<S>(action: (state: S | undefined, fd: FormData) => Promise<S | undefined>) {
  const [state, dispatch, pending] = useActionState<S | undefined, FormData>(action, undefined);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(() => dispatch(fd));
  }
  return { state, onSubmit, pending };
}

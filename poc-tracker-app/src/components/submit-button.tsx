"use client";

import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pending,
  pendingText = "Menyimpan...",
  variant = "primary",
}: {
  children: React.ReactNode;
  pending: boolean;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

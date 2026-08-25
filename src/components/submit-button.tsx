"use client";

import { useFormStatus } from "react-dom";

/** Knows it is submitting without the page having to track it. */
export function SubmitButton({
  children,
  pendingLabel = "…",
  disabled,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </button>
  );
}

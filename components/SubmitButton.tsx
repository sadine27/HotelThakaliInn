"use client";

/* Disables + relabels itself while its form's action is in flight. Without
   this, a click that gets no visible response (the page hasn't re-rendered
   yet) reads as "did nothing" and invites a second click -- which is how two
   near-simultaneous inserts of the same email raced past the pre-insert
   uniqueness check and surfaced a raw D1 constraint error instead of the
   normal "already in use" notice. */
import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Every section reachable from the admin, in one place — the per-page "← Back"
   links were the only way to get anywhere else, which is the "hard to
   navigate" complaint. Accounts is always shown; /admin/accounts already
   redirects non-owner/developer roles away, so the nav doesn't need to know
   the signed-in role too. */
const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/requests", label: "Booking requests" },
  { href: "/admin/messages", label: "Enquiries" },
  { href: "/admin/content", label: "Pages, rooms & photos" },
  { href: "/admin/settings", label: "Contact & facts" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/accounts", label: "Accounts" },
];

export default function AdminNav() {
  const pathname = usePathname();
  /* Nothing to sign in to yet on the login screen — showing a nav to every
     signed-in-only page there is not a shortcut, just a wall of dead ends. */
  if (!pathname || pathname === "/admin/login") return null;

  return (
    <nav className="adm-nav">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

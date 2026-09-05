"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Every section reachable from the admin, in one place — the per-page "← Back"
   links were the only way to get anywhere else, which is the "hard to
   navigate" complaint.
 *
 * `managers` marks a link only an owner or developer can open. Both of those
 * pages still guard themselves — this is not the check, it is the difference
 * between a menu of things you can do and a menu with two dead ends in it. */
const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/requests", label: "Booking requests" },
  { href: "/admin/messages", label: "Enquiries" },
  { href: "/admin/content", label: "Pages, rooms & photos" },
  { href: "/admin/settings", label: "Contact & facts" },
  { href: "/admin/audit", label: "Audit log", managers: true },
  { href: "/admin/accounts", label: "Accounts", managers: true },
];

export default function AdminNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const manager = role === "owner" || role === "developer";
  /* Nothing to sign in to yet on the login screen — showing a nav to every
     signed-in-only page there is not a shortcut, just a wall of dead ends. */
  if (!pathname || pathname === "/admin/login") return null;

  return (
    <nav className="adm-nav">
      {LINKS.filter((l) => manager || !l.managers).map((l) => (
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

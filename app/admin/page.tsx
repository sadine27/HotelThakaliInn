import Link from "next/link";
import { redirect } from "next/navigation";
import { endSession, requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Admin() {
  await requireSession();

  async function signOut() {
    "use server";
    /* Yes, even here. Not because signing out an intruder is a loss, but because
       "requireSession() first, every action, no exceptions" is a rule that only
       works if it has no exceptions to remember. */
    await requireSession();
    await endSession();
    redirect("/admin/login");
  }

  return (
    <div className="adm-page">
      <h1>Manage the site</h1>
      <p className="adm-sub">Everything here is live the moment you save it</p>

      <nav className="adm-hub">
        {/* Above Enquiries: this is the one that costs money to miss. */}
        <Link href="/admin/requests">
          <strong>Booking requests</strong>
          <span>Direct requests from the booking page, by arrival date</span>
        </Link>
        <Link href="/admin/messages">
          <strong>Enquiries</strong>
          <span>Messages sent from the contact form</span>
        </Link>
        <Link href="/admin/settings">
          <strong>Contact details &amp; property facts</strong>
          <span>Address, phone, email, arrival distances, what every room has</span>
        </Link>
        <Link href="/admin/content">
          <strong>Pages, rooms &amp; photos</strong>
          <span>The words and pictures on every page</span>
        </Link>
      </nav>

      <form action={signOut} className="adm-signout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}

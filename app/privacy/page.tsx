import Link from "next/link";
import { settings } from "@/lib/content";

/* Reads the contact email out of D1, like every other page that prints it. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy | Hotel Thakali Inn",
  description:
    "What Hotel Thakali Inn's website records about a visit, why, how long it is kept, and how to ask for it to be removed.",
};

/* Written because the site started keeping visitor addresses in September 2026,
 * and holding one without saying so is the part that actually has legal weight
 * — under the EU/UK GDPR, which reaches European guests, and under Nepal's
 * Individual Privacy Act 2075. There was no privacy page at all before this.
 *
 * Deliberately in plain sentences rather than the usual nine screens of
 * headings: a policy nobody finishes reading protects nobody. If what the site
 * does ever changes, this page changes in the same commit — the four places
 * that claimed "no location" and were left behind for a while are exactly the
 * failure this note exists to prevent. */

export default async function Privacy() {
  const config = await settings();
  const email = config.email ?? "hotelthakaliinn1@gmail.com";

  return (
    <div className="legal">
      <h1>Privacy</h1>
      <p className="legal-lede">
        This page says exactly what this website records, why, and for how long. It is short
        because there is not much of it.
      </p>

      <h2>When you send us something</h2>
      <p>
        The contact form and the booking form keep what you typed into them — your name, your
        email address or phone number, your dates, and your message — so that we can answer you.
        They are stored in the hotel&rsquo;s own database and emailed to the front desk. They are
        not sent to any advertiser, analytics company, or anyone else.
      </p>

      <h2>When you just read a page</h2>
      <p>
        Every page opened here is counted. Along with the page and the date, we record:
      </p>
      <ul>
        <li>the country, city and internet provider the request came from, which Cloudflare tells us;</li>
        <li>whether you are on a phone, a tablet or a computer, and which browser family;</li>
        <li>the website that linked you here, if one did — the site&rsquo;s name only, never the page;</li>
        <li>
          a short code that is the same for one device and browser across pages, so we can tell
          whether ten page views were ten people or one person reading ten pages;
        </li>
        <li>your IP address.</li>
      </ul>
      <p>
        There is <strong>no cookie</strong>, no tracking pixel, no Google Analytics, no Meta pixel
        and nothing that can follow you to another website. Everything above is recorded by this
        site, stays on this site&rsquo;s own database, and is read only by the hotel.
      </p>

      <h2>How long it is kept</h2>
      <p>
        The <strong>IP address is deleted after one year</strong>, automatically. The rest — which
        pages were read, from which countries, on what — is kept indefinitely, because it is how
        the hotel understands its own website and it identifies nobody once the address is gone.
      </p>
      <p>
        Enquiries and booking requests are kept for as long as they are useful to answer, and are
        deleted on request.
      </p>

      <h2>Who can see it</h2>
      <p>
        Only people with an account on the hotel&rsquo;s admin, which is a short list of named
        individuals. The IP address is stricter still: only the site&rsquo;s developer can reveal
        one, or an owner given that permission for 24 hours, and <strong>every single time an
        address is revealed it is written to an audit log</strong> with the name of the person who
        looked.
      </p>

      <h2>Why we hold it at all</h2>
      <p>
        To see which parts of the website are useful and which are ignored, to know which
        countries our guests come from, and to be able to investigate abuse — a flood of fake
        enquiries, or someone attempting to break into the admin.
      </p>

      <h2>Asking for it to be removed</h2>
      <p>
        Write to <a href={`mailto:${email}`}>{email}</a> and we will delete what we hold about
        you. You do not have to give a reason. If you want to know what that is first, ask and we
        will tell you.
      </p>

      <p className="legal-foot">
        Last changed 5 September 2026. <Link href="/contact">Contact the hotel</Link>.
      </p>
    </div>
  );
}

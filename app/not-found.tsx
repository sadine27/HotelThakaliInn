import Link from "next/link";

export const metadata = {
  title: "Not found | Hotel Thakali Inn",
};

/* The address is wrong, which is the reader's mistake and not worth an apology.
   One line saying so and one way back — the dial and the dock are drawn by the
   layout, so this page does not have to offer navigation of its own. */
export default function NotFound() {
  return (
    <div className="stop">
      <p className="stop-code">404</p>
      <h1 className="stop-line">There is no page at that address.</h1>
      <Link className="stop-back" href="/">
        Back to the front desk
      </Link>
    </div>
  );
}

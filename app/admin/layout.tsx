/* No session check here, on purpose. A layout guard protects the HTML and none
 * of the Server Actions — Next.js does not run layouts for an action or a route
 * handler — which is the middleware-auth footgun in a different costume. So the
 * check lives where the work happens, and there is exactly one rule to remember:
 * requireSession() is the first line of every admin page and every action. */
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin | Hotel Thakali Inn",
  /* Belt and braces with the Disallow in app/robots.ts. Neither is a security
     control — force-dynamic is, because it keeps these pages out of dist/client
     where they would be served as public static assets. */
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <AdminNav />
      {children}
    </div>
  );
}

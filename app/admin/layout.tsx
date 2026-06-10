import type { Metadata } from "next";

// Keep the admin panel out of search engines entirely. Combined with the
// X-Robots-Tag header set on /admin in middleware and on every /api/admin
// response (lib/admin-auth.ts adminJson), the panel is never indexed.
export const metadata: Metadata = {
  title: "CoderPay Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

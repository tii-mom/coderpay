import type { Metadata } from "next";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070A12",
};

// Keep the admin panel out of search engines entirely. Combined with the
// X-Robots-Tag header set on /admin in middleware and on every /api/admin
// response (lib/admin-auth.ts adminJson), the panel is never indexed.
export const metadata: Metadata = {
  title: "CoderPay Admin",
  manifest: "/admin-manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "CP Admin",
    statusBarStyle: "default",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}


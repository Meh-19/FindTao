import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

// The discover page itself is a client component (it reads user state), so its
// metadata lives here in a server layout wrapper.
const title = "Discover stores";
const description =
  "Discover trusted Taobao, Weidian and Yupoo sellers. Browse curated stores by category and trust score, and follow the ones you like.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/discover` },
  openGraph: { title: `${title} · FindTao`, description, url: `${SITE_URL}/discover`, type: "website" },
  twitter: { card: "summary", title: `${title} · FindTao`, description },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

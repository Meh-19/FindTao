import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

// The browse/search page is a client component; its metadata lives in this
// server layout wrapper.
const title = "Search finds";
const description =
  "Search finds across Taobao, Weidian, 1688 and Xianyu. Compare sellers of the same item, check QC photos, and hand off to your shopping agent.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/browse` },
  openGraph: { title: `${title} · FindTao`, description, url: `${SITE_URL}/browse`, type: "website" },
  twitter: { card: "summary", title: `${title} · FindTao`, description },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

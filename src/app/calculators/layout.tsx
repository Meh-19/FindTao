import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

const title = "Haul calculators";
const description =
  "Volumetric weight, shipping-cost estimate, and currency conversion for reps — all client-side, no sign-in.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/calculators` },
  openGraph: { title: `${title} · FindTao`, description, url: `${SITE_URL}/calculators`, type: "website" },
  twitter: { card: "summary", title: `${title} · FindTao`, description },
};

export default function CalculatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

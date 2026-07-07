import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/Nav";
import { AuthModal } from "@/components/AuthModal";
import { CartPanel } from "@/components/CartPanel";
import { Topbar, StatusBar, BottomNav, Toasts } from "@/components/Chrome";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Browse Taobao, Weidian, 1688 and Xianyu finds from anywhere. Plan hauls, check QC photos, and hand off to your shopping agent in one click.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FindTao — find it, QC it, hand it to your agent",
  description: DESCRIPTION,
  openGraph: {
    title: "FindTao",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "FindTao",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "FindTao",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flow-bg fixed inset-x-0 top-0 z-50 h-0.5" />
        <div className="aurora" aria-hidden="true">
          <i /><i /><i />
        </div>
        <StoreProvider>
          <div className="min-h-screen md:flex">
            <Nav />
            <div className="min-w-0 flex-1 pb-14 md:pb-8">
              <Topbar />
              <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8">{children}</main>
              <footer className="border-t border-white/5 py-6">
                <p className="mx-auto max-w-6xl px-4 text-xs text-mist-500 md:px-8">
                  FindTao is a discovery tool. Purchases happen on the agent you choose — we never
                  handle payments. Outbound agent links may include our referral code, which funds
                  the site; prices are unchanged.
                </p>
              </footer>
            </div>
          </div>
          <CartPanel />
          <AuthModal />
          <Toasts />
          <StatusBar />
          <BottomNav />
        </StoreProvider>
      </body>
    </html>
  );
}

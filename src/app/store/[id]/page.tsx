import { Suspense } from "react";
import type { Metadata } from "next";
import { STORES } from "@/data/stores";
import { StoreView } from "@/components/StoreView";
import { serverSupabase } from "@/lib/serverSupabase";
import { SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return STORES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = serverSupabase();
  const { data } = sb
    ? await sb.from("store_directory").select("name, blurb").eq("id", id).maybeSingle()
    : { data: null };
  if (!data) return { title: "Store" };
  const title = data.name as string;
  const description =
    (data.blurb as string) ||
    `Browse ${title}'s catalog on FindTao — check QC photos and hand items to your shopping agent.`;
  const url = `${SITE_URL}/store/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · FindTao`, description, url, type: "website" },
    twitter: { card: "summary", title: `${title} · FindTao`, description },
  };
}

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <StoreView id={id} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { ItemDetail } from "@/components/ItemDetail";
import { serverSupabase } from "@/lib/serverSupabase";
import { SITE_URL } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = serverSupabase();
  const { data } = sb
    ? await sb.from("catalog_items").select("title, store_name, price_cny").eq("id", id).maybeSingle()
    : { data: null };
  if (!data) return { title: "Item" };
  const title = data.title as string;
  const description = `${title} from ${data.store_name} · ¥${data.price_cny} — check QC photos and buy via your shopping agent on FindTao.`;
  const url = `${SITE_URL}/item/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · FindTao`, description, url, type: "website" },
    twitter: { card: "summary", title: `${title} · FindTao`, description },
  };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}

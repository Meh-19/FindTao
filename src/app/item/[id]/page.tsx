import { notFound } from "next/navigation";
import { CATALOG, getItem } from "@/data/catalog";
import { ItemDetail } from "@/components/ItemDetail";

export function generateStaticParams() {
  return CATALOG.map((item) => ({ id: item.id }));
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getItem(id);
  if (!item) notFound();
  return <ItemDetail item={item} />;
}

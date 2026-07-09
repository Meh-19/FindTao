import { ItemDetail } from "@/components/ItemDetail";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}

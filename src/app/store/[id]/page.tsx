import { Suspense } from "react";
import { STORES } from "@/data/stores";
import { StoreView } from "@/components/StoreView";

export function generateStaticParams() {
  return STORES.map((s) => ({ id: s.id }));
}

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <StoreView id={id} />
    </Suspense>
  );
}

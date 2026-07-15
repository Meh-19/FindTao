import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeSharedItems, formatShared, type SharedHaul } from "@/lib/shareHaul";
import { HaulPreview } from "@/components/HaulPreview";
import { SharedItemGrid } from "@/components/SharedItemGrid";
import { formatMoney } from "@/lib/currency";

// Shares are snapshots that can change; never statically cache the page.
export const dynamic = "force-dynamic";

async function getShare(slug: string): Promise<SharedHaul | null> {
  const sb = serverSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("shared_hauls").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  // Link to the owner's public profile if they have one published.
  let ownerProfileHandle: string | null = null;
  if (data.owner_id) {
    const { data: prof } = await sb
      .from("public_profiles")
      .select("handle")
      .eq("user_id", data.owner_id)
      .eq("public", true)
      .maybeSingle();
    ownerProfileHandle = (prof?.handle as string | undefined) ?? null;
  }
  return {
    slug: data.slug,
    ownerName: data.owner_name ?? "Anonymous",
    ownerImage: data.owner_image ?? null,
    ownerProfileHandle,
    kind: data.kind === "cart" ? "cart" : "haul",
    name: data.name ?? "Haul",
    items: sanitizeSharedItems(data.data),
    totalCny: Number(data.total_cny) || 0,
    unitCount: data.unit_count ?? 0,
    weightG: data.weight_g ?? 0,
    currency: data.currency ?? "USD",
    rate: Number(data.rate) || 0,
    public: !!data.public,
  };
}

function storeNames(haul: SharedHaul): string[] {
  return [...new Set(haul.items.map((i) => i.storeName).filter(Boolean))];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const haul = await getShare(slug);
  if (!haul) return { title: "Not found — FindTao" };
  const stores = storeNames(haul);
  const kindLabel = haul.kind === "cart" ? "cart" : "haul";
  const title = `${haul.ownerName}'s ${kindLabel}${stores.length ? ` — ${stores.slice(0, 3).join(", ")}` : ""}`;
  const description = `${haul.unitCount} item${haul.unitCount === 1 ? "" : "s"} · ${formatMoney(
    haul.totalCny,
    "CNY",
  )} ${formatShared(haul.totalCny, haul.currency, haul.rate)} · ~${(haul.weightG / 1000).toFixed(1)}kg — shared on FindTao`;
  // Next auto-attaches the sibling opengraph-image route as og:image.
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/5 bg-ink-900/60 py-2">
      <p className="text-sm font-bold text-mist-100">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-mist-500">{label}</p>
    </div>
  );
}

export default async function SharedHaulPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const haul = await getShare(slug);
  if (!haul) notFound();

  const kindLabel = haul.kind === "cart" ? "Shared cart" : "Shared haul";
  const stores = storeNames(haul);

  return (
    <div className="fade-up mx-auto max-w-2xl py-6">
      <div className="overflow-hidden rounded-none border border-white/10 bg-ink-800/80">
        <div className="flow-bg h-1" />
        <div className="p-6">
          <div className="flex items-center gap-3">
            {haul.ownerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={haul.ownerImage}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <span className="flow-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                {haul.ownerName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mist-500">{kindLabel}</p>
              {haul.ownerProfileHandle ? (
                <Link
                  href={`/u/${haul.ownerProfileHandle}`}
                  className="truncate text-sm font-semibold text-mist-100 transition-colors hover:text-neon-300 hover:underline"
                >
                  {haul.ownerName}
                </Link>
              ) : (
                <p className="truncate text-sm font-semibold text-mist-100">{haul.ownerName}</p>
              )}
            </div>
          </div>

          {haul.kind !== "cart" && (
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-mist-100">{haul.name}</h1>
          )}
          {stores.length > 0 && (
            <p className="mt-1 text-sm text-mist-400">
              {stores.slice(0, 4).join(" · ")}
              {stores.length > 4 ? ` +${stores.length - 4} more` : ""}
            </p>
          )}

          <HaulPreview
            items={haul.items}
            className="mx-auto mt-5 aspect-square w-full max-w-[15rem] rounded-none border border-white/5"
          />

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Items" value={String(haul.unitCount)} />
            <Stat label="Total" value={formatMoney(haul.totalCny, "CNY")} />
            <Stat label="Est. weight" value={`~${(haul.weightG / 1000).toFixed(1)}kg`} />
          </div>
          <p className="mt-1.5 text-center text-xs text-mist-500">
            ≈ {formatShared(haul.totalCny, haul.currency, haul.rate)} total
          </p>

          <SharedItemGrid items={haul.items} currency={haul.currency} rate={haul.rate} />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-mist-500">
        <Link href="/" className="text-neon-300 hover:text-neon-400">
          Plan and share your own haul on FindTao →
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeSharedItems, type SharedHaul } from "@/lib/shareHaul";
import { HaulPreview } from "@/components/HaulPreview";
import { proxiedImg } from "@/lib/yupoo";
import { formatMoney } from "@/lib/currency";
import { CloneHaulButton } from "./CloneHaulButton";

// Shares are snapshots that can change; never statically cache the page.
export const dynamic = "force-dynamic";

async function getShare(slug: string): Promise<SharedHaul | null> {
  const sb = serverSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("shared_hauls").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return {
    slug: data.slug,
    ownerName: data.owner_name ?? "Anonymous",
    name: data.name ?? "Haul",
    items: sanitizeSharedItems(data.data),
    totalCny: Number(data.total_cny) || 0,
    unitCount: data.unit_count ?? 0,
    weightG: data.weight_g ?? 0,
    public: !!data.public,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const haul = await getShare(slug);
  if (!haul) return { title: "Haul not found — FindTao" };
  const title = `${haul.name} — a haul by ${haul.ownerName}`;
  const description = `${haul.unitCount} item${haul.unitCount === 1 ? "" : "s"} · ${formatMoney(
    haul.totalCny,
    "CNY",
  )} · ~${(haul.weightG / 1000).toFixed(1)}kg — shared on FindTao`;
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

  return (
    <div className="fade-up mx-auto max-w-lg py-6">
      <div className="overflow-hidden rounded-none border border-white/10 bg-ink-800/80">
        <div className="flow-bg h-1" />
        <div className="p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mist-500">Shared haul</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-mist-100">{haul.name}</h1>
          <p className="mt-0.5 text-sm text-mist-400">
            by <span className="font-medium text-mist-200">{haul.ownerName}</span>
          </p>

          <HaulPreview
            items={haul.items}
            className="mx-auto mt-5 aspect-square w-full max-w-[16rem] rounded-none border border-white/5"
          />

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Items" value={String(haul.unitCount)} />
            <Stat label="Total" value={formatMoney(haul.totalCny, "CNY")} />
            <Stat label="Est. weight" value={`~${(haul.weightG / 1000).toFixed(1)}kg`} />
          </div>

          <CloneHaulButton items={haul.items} name={haul.name} />

          <div className="mt-5 space-y-1.5">
            {haul.items.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="flex items-center gap-3 rounded-none border border-white/5 bg-ink-900/60 p-2"
              >
                {item.image && item.imgHost ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxiedImg(item.image, item.imgHost)}
                    alt=""
                    className="h-10 w-12 shrink-0 rounded-none border border-white/5 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-none border border-white/5 bg-ink-700 text-mist-500">
                    <ImageOff size={13} aria-hidden="true" />
                  </span>
                )}
                <p className="line-clamp-1 min-w-0 flex-1 text-xs font-medium text-mist-100" title={item.title}>
                  {item.title}
                </p>
                {item.qty > 1 && (
                  <span className="rounded-none bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">
                    ×{item.qty}
                  </span>
                )}
                <span className="text-[11px] tabular-nums text-mist-500">
                  {item.priceCny !== null ? formatMoney(item.priceCny * item.qty, "CNY") : "—"}
                </span>
              </div>
            ))}
          </div>
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

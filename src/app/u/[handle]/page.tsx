import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Shirt, Store } from "lucide-react";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeCollection, sanitizeProfileStores, type CollectionPiece, type PublicProfile } from "@/lib/profile";
import { proxiedImg } from "@/lib/yupoo";
import { StarRating } from "@/components/StarRating";

// Profiles are editable snapshots; never statically cache.
export const dynamic = "force-dynamic";

async function getProfile(handle: string): Promise<PublicProfile | null> {
  const sb = serverSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("public_profiles")
    .select("*")
    .eq("handle", handle)
    .eq("public", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    handle: data.handle,
    displayName: data.display_name ?? "Anonymous",
    image: data.image ?? null,
    bio: data.bio ?? "",
    showCollection: !!data.show_collection,
    showStores: !!data.show_stores,
    collection: sanitizeCollection(data.collection),
    stores: sanitizeProfileStores(data.stores),
  };
}

/** Public link for a collection piece — album → its Yupoo page, catalog → item page, else its stored url. */
function pieceHref(p: CollectionPiece): string | null {
  const album = p.id.match(/^album:([a-z0-9-]+):(\d+)$/i);
  if (album) return `https://${album[1]}.x.yupoo.com/albums/${album[2]}`;
  const cat = p.id.match(/^cat:(.+)$/);
  if (cat) return `/item/${cat[1]}`;
  return p.url || null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) return { title: "Profile not found — FindTao" };
  const count = profile.collection.length;
  const title = `${profile.displayName}'s profile — FindTao`;
  const description = profile.bio || `${count} piece${count === 1 ? "" : "s"} in their collection on FindTao`;
  return { title, description, openGraph: { title, description, type: "website" } };
}

function CollectionPieceCard({ piece }: { piece: CollectionPiece }) {
  const href = pieceHref(piece);
  const src = piece.image && piece.imgHost ? proxiedImg(piece.image, piece.imgHost) : piece.image;
  const external = href?.startsWith("http");

  const inner = (
    <>
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink-700">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Shirt size={22} aria-hidden="true" className="text-white/40" />
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium text-mist-100" title={piece.title}>
          {piece.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {piece.size && (
            <span className="border border-mist-300/40 bg-mist-100/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-mist-100">
              Size {piece.size}
            </span>
          )}
          {piece.rating > 0 && <StarRating value={piece.rating} size={12} />}
        </div>
        {piece.storeName && <p className="mt-1 truncate text-[11px] text-mist-500">{piece.storeName}</p>}
        {piece.review && <p className="mt-1.5 line-clamp-4 text-xs text-mist-300">{piece.review}</p>}
      </div>
    </>
  );

  const cls = "group block overflow-hidden border border-white/5 bg-ink-800/80 transition-colors hover:border-white/20";
  if (!href) return <div className={cls}>{inner}</div>;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  return (
    <div className="fade-up mx-auto max-w-3xl py-6">
      <div className="overflow-hidden rounded-none border border-white/10 bg-ink-800/80">
        <div className="flow-bg h-1" />
        <div className="p-6">
          <div className="flex items-center gap-4">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="" className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover" />
            ) : (
              <span className="flow-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mist-500">FindTao profile</p>
              <h1 className="truncate font-display text-2xl font-bold tracking-tight text-mist-100">
                {profile.displayName}
              </h1>
            </div>
          </div>
          {profile.bio && <p className="mt-3 whitespace-pre-line text-sm text-mist-300">{profile.bio}</p>}
        </div>
      </div>

      {profile.showCollection && profile.collection.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
            <Shirt size={14} aria-hidden="true" /> Collection ({profile.collection.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {profile.collection.map((piece) => (
              <CollectionPieceCard key={piece.id} piece={piece} />
            ))}
          </div>
        </section>
      )}

      {profile.showStores && profile.stores.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.15em] text-mist-500">
            <Store size={14} aria-hidden="true" /> Followed stores ({profile.stores.length})
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profile.stores.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border border-white/5 bg-ink-800/80 px-3 py-2.5 transition-colors hover:border-white/20"
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-9 w-9 shrink-0 rounded-none border border-white/5 object-cover" />
                ) : (
                  <span className="flow-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-none text-xs font-bold text-white">
                    {s.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-mist-100">{s.name}</span>
                  {s.categories.length > 0 && (
                    <span className="block truncate text-[11px] text-mist-500">{s.categories.join(" · ")}</span>
                  )}
                </span>
                <ExternalLink size={13} aria-hidden="true" className="shrink-0 text-mist-500" />
              </a>
            ))}
          </div>
        </section>
      )}

      {(!profile.showCollection || profile.collection.length === 0) &&
        (!profile.showStores || profile.stores.length === 0) && (
          <p className="mt-6 border border-dashed border-ink-500 px-4 py-10 text-center text-sm text-mist-400">
            This profile doesn&apos;t have anything to show yet.
          </p>
        )}

      <p className="mt-6 text-center text-xs text-mist-500">
        <Link href="/" className="text-neon-300 hover:text-neon-400">
          Build your own collection on FindTao →
        </Link>
      </p>
    </div>
  );
}

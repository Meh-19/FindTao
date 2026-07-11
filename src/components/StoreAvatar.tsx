/**
 * Store avatar: the uploaded profile picture when set (dev panel → Supabase
 * Storage), otherwise the two-letter abbreviation box. `className` carries the
 * per-site sizing/rounding/shadow (e.g. "h-11 w-11 rounded-none text-xs").
 */
export function StoreAvatar({
  store,
  className = "",
}: {
  store: { name: string; image?: string | null };
  className?: string;
}) {
  if (store.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={store.image} alt="" className={`shrink-0 object-cover ${className}`} />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-bold text-white ${className}`}
      style={{ background: "#1a1a1a" }}
    >
      {store.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

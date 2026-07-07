import type { CatalogItem } from "@/data/catalog";

const CATEGORY_LABEL: Record<CatalogItem["category"], string> = {
  jacket: "Jacket",
  hoodie: "Knit / hoodie",
  tee: "Tee",
  pants: "Pants",
  shoes: "Shoes",
  bag: "Bag",
  accessory: "Accessory",
};

/** Placeholder tile — swapped for proxied marketplace images once the data pipeline exists. */
export function Thumb({
  item,
  className = "",
  label = true,
}: {
  item: CatalogItem;
  className?: string;
  label?: boolean;
}) {
  return (
    <div
      className={`tile-shimmer flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${item.hue[0]}, ${item.hue[1]})` }}
    >
      {label && (
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
          {CATEGORY_LABEL[item.category]}
        </span>
      )}
    </div>
  );
}
